// cowork — Per-project server-side workspace for Cowork mode.
//
// This is the persistent file store the Cowork agent reads from and writes to.
// It is intentionally pure (no DB, no Express, no app config): the workspace root
// is injected by the caller, so it unit-tests against a temp dir and can be reused
// by routes, the sandbox file-sync, and scheduled tasks alike.
//
// Security model: every path is resolved and confined to the project's base dir.
// Any attempt to escape (via `..`, absolute paths, etc.) throws before touching disk.

import * as path from 'path';
import { promises as fs } from 'fs';

export type CoworkNodeType = 'file' | 'directory';

export interface CoworkFileNode {
  /** File or directory name (basename). */
  name: string;
  /** POSIX-style path relative to the workspace base (e.g. "output/report.pptx"). */
  path: string;
  type: CoworkNodeType;
  /** Bytes; present for files. */
  size?: number;
  /** ISO timestamp of last modification. */
  modifiedAt?: string;
  /** Present for directories. */
  children?: CoworkFileNode[];
}

export interface CoworkWorkspaceOptions {
  /** Absolute root dir under which every project workspace lives. */
  root: string;
  /** Identifies the per-project subfolder (typically the Project _id). */
  projectId: string;
  /** Optional hard size cap for the whole workspace, in bytes. */
  quotaBytes?: number;
  /** Char budget for the always-injected core memory (defaults to DEFAULT_MEMORY_CHAR_BUDGET). */
  memoryCharBudget?: number;
}

/** Default subfolder the agent is instructed to write deliverables into. */
export const COWORK_OUTPUT_DIR = 'output';

/**
 * Hidden top-level dir holding the edit-review machinery (staged proposals + undo
 * history). Excluded from the file tree, downloads, and the quota total.
 */
export const COWORK_INTERNAL_DIR = '.cowork';
const PROPOSED_DIR = `${COWORK_INTERNAL_DIR}/proposed`;
const HISTORY_DIR = `${COWORK_INTERNAL_DIR}/history`;
const CHECKPOINTS_FILE = `${COWORK_INTERNAL_DIR}/checkpoints.json`;

/** Keep at most this many undo checkpoints; older snapshots are pruned. */
const MAX_CHECKPOINTS = 20;

// --- Project memory (tiered, context-window safe) ----------------------------
const MEMORY_DIR = `${COWORK_INTERNAL_DIR}/memory`;
/** Always-injected, budgeted memory the agent sees every run. */
const MEMORY_CORE_FILE = `${MEMORY_DIR}/core.md`;
/** Never-injected long tail; the agent reads it on demand via execute_code. */
const MEMORY_ARCHIVE_FILE = `${MEMORY_DIR}/archive.md`;
/** Default char budget for injected core memory (~1500 tokens × ~4 chars/token). */
export const DEFAULT_MEMORY_CHAR_BUDGET = 6000;
/** Marker appended when core memory is truncated for injection. */
const MEMORY_TRUNCATION_MARKER = '\n…(memory truncated — older detail is in archive.md)';

/** Extensions we can show a line-level diff for; everything else is treated as binary. */
const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.markdown', '.csv', '.tsv', '.json', '.json5', '.jsonl', '.yaml', '.yml',
  '.xml', '.html', '.htm', '.css', '.scss', '.less', '.js', '.jsx', '.ts', '.tsx', '.mjs',
  '.cjs', '.py', '.rb', '.go', '.rs', '.java', '.kt', '.c', '.h', '.cpp', '.cc', '.cs', '.php',
  '.sh', '.bash', '.zsh', '.sql', '.toml', '.ini', '.cfg', '.conf', '.env', '.log', '.tex',
  '.svg', '.rst', '.gitignore', '.dockerignore',
]);

/** Execution machinery that lives in the workspace but is hidden from the file tree. */
const COWORK_HIDDEN_ENTRIES = new Set([
  COWORK_INTERNAL_DIR,
  '.venv',
  '__pycache__',
  '__librechat_exec.py',
  '__librechat_exec.js',
  '__librechat_ptc.py',
]);

export type CoworkChangeStatus = 'modified' | 'created';
export type CoworkContentKind = 'text' | 'binary';

/** A staged edit awaiting Apply (one per file under .cowork/proposed/). */
export interface CoworkProposedChange {
  /** Live workspace-relative path the proposal targets. */
  path: string;
  /** `modified` if a live file already exists; `created` if it would be a new file. */
  status: CoworkChangeStatus;
  /** Whether a line diff is meaningful (text) or only a metadata card (binary). */
  kind: CoworkContentKind;
  /** Size of the current live file, if it exists. */
  liveSize?: number;
  /** Size of the staged proposed file. */
  proposedSize: number;
}

/** One file captured by a checkpoint, with whether it pre-existed the apply. */
export interface CoworkCheckpointEntry {
  path: string;
  /** True if a pre-apply snapshot was saved (file existed); false if it was newly created. */
  hadPrevious: boolean;
}

/** A restorable point created by each Apply (or by a Restore, for redo). */
export interface CoworkCheckpoint {
  id: string;
  createdAt: string;
  message?: string;
  entries: CoworkCheckpointEntry[];
}

/** projectId must be a single safe path segment — no separators, no dots-only. */
function isSafeProjectId(id: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(id);
}

/** Normalize a user-supplied relative path to POSIX, stripped of leading slashes. */
function normalizeRel(relPath: string): string {
  return relPath.replace(/\\/g, '/').replace(/^\/+/, '');
}

function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

export class CoworkWorkspaceService {
  readonly root: string;
  readonly projectId: string;
  readonly basePath: string;
  readonly quotaBytes?: number;
  readonly memoryCharBudget: number;

  constructor({ root, projectId, quotaBytes, memoryCharBudget }: CoworkWorkspaceOptions) {
    if (!root) {
      throw new Error('CoworkWorkspaceService: root is required');
    }
    if (!projectId || !isSafeProjectId(projectId)) {
      throw new Error(`CoworkWorkspaceService: invalid projectId "${projectId}"`);
    }
    this.root = path.resolve(root);
    this.projectId = projectId;
    this.basePath = path.join(this.root, projectId);
    this.quotaBytes = quotaBytes;
    this.memoryCharBudget =
      memoryCharBudget && memoryCharBudget > 0 ? memoryCharBudget : DEFAULT_MEMORY_CHAR_BUDGET;
  }

  /**
   * Resolve a workspace-relative path to an absolute one, guaranteeing it stays
   * inside the project's base dir. Throws on any containment violation.
   */
  resolve(relPath = ''): string {
    const normalized = normalizeRel(relPath);
    const target = path.resolve(this.basePath, normalized);
    const baseWithSep = this.basePath + path.sep;
    if (target !== this.basePath && !target.startsWith(baseWithSep)) {
      throw new Error('Path escapes workspace boundary');
    }
    return target;
  }

  /** Create the workspace (and its `output/` subdir) if it doesn't exist. */
  async ensure(): Promise<void> {
    await fs.mkdir(path.join(this.basePath, COWORK_OUTPUT_DIR), { recursive: true });
  }

  /** True if a workspace-relative path exists. */
  async exists(relPath = ''): Promise<boolean> {
    try {
      await fs.stat(this.resolve(relPath));
      return true;
    } catch {
      return false;
    }
  }

  /** Recursive file tree, directories first then files, both alphabetical. */
  async getTree(): Promise<CoworkFileNode[]> {
    await this.ensure();
    return this.readDir(this.basePath);
  }

  private async readDir(absDir: string): Promise<CoworkFileNode[]> {
    const entries = await fs.readdir(absDir, { withFileTypes: true });
    const nodes: CoworkFileNode[] = [];

    for (const entry of entries) {
      if (COWORK_HIDDEN_ENTRIES.has(entry.name)) {
        continue;
      }
      const abs = path.join(absDir, entry.name);
      const rel = toPosix(path.relative(this.basePath, abs));
      try {
        if (entry.isDirectory()) {
          nodes.push({
            name: entry.name,
            path: rel,
            type: 'directory',
            children: await this.readDir(abs),
          });
        } else if (entry.isFile()) {
          const stat = await fs.stat(abs);
          nodes.push({
            name: entry.name,
            path: rel,
            type: 'file',
            size: stat.size,
            modifiedAt: stat.mtime.toISOString(),
          });
        }
      } catch (error) {
        // An entry can vanish between readdir and stat (e.g. a temp file removed
        // mid-upload). Skip it instead of failing the whole tree read; consistent
        // with getUsage()'s handling. Re-throw anything that isn't a missing entry.
        if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
          throw error;
        }
      }
    }

    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    return nodes;
  }

  /** Read a file's bytes. */
  async readFile(relPath: string): Promise<Buffer> {
    return fs.readFile(this.resolve(relPath));
  }

  /** Stat a workspace entry. */
  async stat(relPath = ''): Promise<{ size: number; isDirectory: boolean; modifiedAt: string }> {
    const s = await fs.stat(this.resolve(relPath));
    return { size: s.size, isDirectory: s.isDirectory(), modifiedAt: s.mtime.toISOString() };
  }

  /**
   * Write bytes to a workspace-relative path, creating parent dirs as needed.
   * Enforces the quota (if set) against the post-write total.
   */
  async writeFile(relPath: string, data: Buffer | Uint8Array): Promise<void> {
    const target = this.resolve(relPath);
    if (target === this.basePath) {
      throw new Error('Refusing to write to the workspace root itself');
    }

    if (this.quotaBytes != null) {
      const existing = await this.fileSizeOrZero(target);
      const projected = (await this.getUsage()) - existing + data.length;
      if (projected > this.quotaBytes) {
        throw new Error('Workspace quota exceeded');
      }
    }

    await fs.mkdir(path.dirname(target), { recursive: true });
    // Cast Buffer → Uint8Array: Buffer extends Uint8Array at runtime and Node always
    // uses ArrayBuffer (not SharedArrayBuffer) for regular Buffers. The double-cast
    // through unknown is required because TypeScript's strict types no longer accept
    // Buffer directly here (SharedArrayBuffer is part of ArrayBufferLike union).
    await fs.writeFile(target, data as unknown as Uint8Array);
  }

  /** Delete a file or directory (recursively). */
  async deleteFile(relPath: string): Promise<void> {
    const target = this.resolve(relPath);
    if (target === this.basePath) {
      throw new Error('Refusing to delete the workspace root');
    }
    await fs.rm(target, { recursive: true, force: true });
  }

  /** Total size of the workspace in bytes. */
  async getUsage(): Promise<number> {
    return this.dirSize(this.basePath);
  }

  private async dirSize(absDir: string): Promise<number> {
    let total = 0;
    let entries: import('fs').Dirent[];
    try {
      entries = await fs.readdir(absDir, { withFileTypes: true });
    } catch {
      return 0;
    }
    for (const entry of entries) {
      // Hidden machinery (.cowork staging/history, .venv, __pycache__, exec scripts) is
      // internal overhead and never counts toward the user-facing quota — keeping usage
      // consistent with the (also hidden-filtered) file tree.
      if (COWORK_HIDDEN_ENTRIES.has(entry.name)) {
        continue;
      }
      const abs = path.join(absDir, entry.name);
      if (entry.isDirectory()) {
        total += await this.dirSize(abs);
      } else if (entry.isFile()) {
        total += await this.fileSizeOrZero(abs);
      }
    }
    return total;
  }

  private async fileSizeOrZero(abs: string): Promise<number> {
    try {
      return (await fs.stat(abs)).size;
    } catch {
      return 0;
    }
  }

  // -------------------------------------------------------------------------
  // Edit review — staged proposals, Apply, and undo checkpoints.
  // Everything here lives under .cowork/ (hidden from the tree, quota-exempt).
  // New-file *creation* never goes through this; it is only for edits the user
  // reviews before they touch the live file.
  // -------------------------------------------------------------------------

  /** Normalize and reject any path that isn't a clean relative path. */
  private safeRel(relPath: string): string {
    const normalized = normalizeRel(relPath);
    const segments = normalized.split('/');
    if (!normalized || segments.some((s) => s === '' || s === '.' || s === '..')) {
      throw new Error('Invalid path');
    }
    if (segments[0] === COWORK_INTERNAL_DIR) {
      throw new Error('Cannot target internal .cowork path');
    }
    return normalized;
  }

  /** Classify a path as text (line-diffable) or binary, by extension. */
  private classifyKind(relPath: string): CoworkContentKind {
    const ext = path.extname(relPath).toLowerCase();
    return TEXT_EXTENSIONS.has(ext) ? 'text' : 'binary';
  }

  /** Write bytes without quota enforcement — for internal .cowork/ machinery only. */
  private async writeInternal(relPath: string, data: Buffer | Uint8Array): Promise<void> {
    const target = this.resolve(relPath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, data as unknown as Uint8Array);
  }

  /** Recursively list file paths under an absolute dir, relative to it (POSIX). */
  private async listFilesUnder(absDir: string): Promise<string[]> {
    let entries: import('fs').Dirent[];
    try {
      entries = await fs.readdir(absDir, { withFileTypes: true });
    } catch {
      return [];
    }
    const out: string[] = [];
    for (const entry of entries) {
      const abs = path.join(absDir, entry.name);
      if (entry.isDirectory()) {
        const nested = await this.listFilesUnder(abs);
        for (const n of nested) {
          out.push(`${entry.name}/${n}`);
        }
      } else if (entry.isFile()) {
        out.push(entry.name);
      }
    }
    return out;
  }

  /**
   * Stage a proposed new version of a file under `.cowork/proposed/<path>` instead of
   * overwriting the live file. The agent calls this when editing an existing file.
   */
  async stageProposed(relPath: string, data: Buffer | Uint8Array): Promise<void> {
    await this.writeInternal(`${PROPOSED_DIR}/${this.safeRel(relPath)}`, data);
  }

  /** Read a staged proposed file's bytes (for the diff/preview UI). */
  async readProposed(relPath: string): Promise<Buffer> {
    return fs.readFile(this.resolve(`${PROPOSED_DIR}/${this.safeRel(relPath)}`));
  }

  /** List all staged proposals with status/kind/sizes (for the Changes panel). */
  async listProposedChanges(): Promise<CoworkProposedChange[]> {
    const proposedBase = this.resolve(PROPOSED_DIR);
    const rels = await this.listFilesUnder(proposedBase);
    const changes: CoworkProposedChange[] = [];
    for (const rel of rels) {
      const proposedSize = await this.fileSizeOrZero(path.join(proposedBase, rel));
      const liveExists = await this.exists(rel);
      const liveSize = liveExists ? (await this.stat(rel)).size : undefined;
      changes.push({
        path: rel,
        status: liveExists ? 'modified' : 'created',
        kind: this.classifyKind(rel),
        liveSize,
        proposedSize,
      });
    }
    changes.sort((a, b) => a.path.localeCompare(b.path));
    return changes;
  }

  /** Discard one staged proposal. */
  async discardProposed(relPath: string): Promise<void> {
    await fs.rm(this.resolve(`${PROPOSED_DIR}/${this.safeRel(relPath)}`), { force: true });
  }

  /** Discard every staged proposal. */
  async discardAllProposed(): Promise<void> {
    await fs.rm(this.resolve(PROPOSED_DIR), { recursive: true, force: true });
  }

  /**
   * Apply staged proposals (all, or a subset by path) to the live workspace:
   *   1. snapshot the current live version into `.cowork/history/<checkpointId>/`
   *   2. promote each proposed file to its live path (quota-enforced)
   *   3. record + return a checkpoint, pruning old ones.
   * On a mid-batch failure (e.g. quota), a checkpoint for the files already promoted is
   * still recorded so the user can undo them.
   */
  async applyProposed(paths?: string[], message?: string): Promise<CoworkCheckpoint> {
    const all = await this.listProposedChanges();
    const wanted =
      paths && paths.length > 0 ? all.filter((c) => paths.includes(c.path)) : all;
    if (wanted.length === 0) {
      throw new Error('No matching staged changes to apply');
    }

    const checkpoint = this.newCheckpoint(message);
    const entries: CoworkCheckpointEntry[] = [];
    try {
      for (const change of wanted) {
        if (change.status === 'modified') {
          const liveBytes = await this.readFile(change.path);
          await this.writeInternal(`${HISTORY_DIR}/${checkpoint.id}/${change.path}`, liveBytes);
        }
        const proposedBytes = await this.readProposed(change.path);
        await this.writeFile(change.path, proposedBytes);
        await this.discardProposed(change.path);
        entries.push({ path: change.path, hadPrevious: change.status === 'modified' });
      }
    } finally {
      if (entries.length > 0) {
        checkpoint.entries = entries;
        await this.appendCheckpoint(checkpoint);
      }
    }
    return checkpoint;
  }

  /** Newest-first list of undo checkpoints. */
  async listCheckpoints(): Promise<CoworkCheckpoint[]> {
    const all = await this.readCheckpoints();
    return all.slice().reverse();
  }

  /**
   * Restore the workspace to a checkpoint (undo). First snapshots the CURRENT live state
   * of the affected paths into a new checkpoint (so the restore is itself reversible),
   * then puts the snapshotted versions back — deleting files the checkpoint recorded as
   * newly created.
   */
  async restoreCheckpoint(id: string): Promise<CoworkCheckpoint> {
    const all = await this.readCheckpoints();
    const target = all.find((c) => c.id === id);
    if (!target) {
      throw new Error('Checkpoint not found');
    }

    const redo = this.newCheckpoint(`Before restoring ${id}`);
    const redoEntries: CoworkCheckpointEntry[] = [];
    for (const entry of target.entries) {
      const liveExists = await this.exists(entry.path);
      if (liveExists) {
        const liveBytes = await this.readFile(entry.path);
        await this.writeInternal(`${HISTORY_DIR}/${redo.id}/${entry.path}`, liveBytes);
      }
      redoEntries.push({ path: entry.path, hadPrevious: liveExists });
    }
    redo.entries = redoEntries;

    for (const entry of target.entries) {
      if (entry.hadPrevious) {
        const snapBytes = await fs.readFile(this.resolve(`${HISTORY_DIR}/${id}/${entry.path}`));
        await this.writeFile(entry.path, snapBytes);
      } else {
        await fs.rm(this.resolve(entry.path), { force: true });
      }
    }

    await this.appendCheckpoint(redo);
    return redo;
  }

  private newCheckpoint(message?: string): CoworkCheckpoint {
    const id = `cp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return { id, createdAt: new Date().toISOString(), message, entries: [] };
  }

  private async readCheckpoints(): Promise<CoworkCheckpoint[]> {
    try {
      const raw = await fs.readFile(this.resolve(CHECKPOINTS_FILE), 'utf8');
      const parsed = JSON.parse(raw) as { checkpoints?: CoworkCheckpoint[] };
      return Array.isArray(parsed.checkpoints) ? parsed.checkpoints : [];
    } catch {
      return [];
    }
  }

  private async appendCheckpoint(checkpoint: CoworkCheckpoint): Promise<void> {
    const all = await this.readCheckpoints();
    all.push(checkpoint);
    const pruned = await this.pruneCheckpoints(all);
    await this.writeInternal(
      CHECKPOINTS_FILE,
      Buffer.from(JSON.stringify({ checkpoints: pruned }, null, 2)),
    );
  }

  /** Keep the newest MAX_CHECKPOINTS; delete dropped checkpoints' history snapshots. */
  private async pruneCheckpoints(all: CoworkCheckpoint[]): Promise<CoworkCheckpoint[]> {
    if (all.length <= MAX_CHECKPOINTS) {
      return all;
    }
    const drop = all.slice(0, all.length - MAX_CHECKPOINTS);
    for (const cp of drop) {
      await fs.rm(this.resolve(`${HISTORY_DIR}/${cp.id}`), { recursive: true, force: true });
    }
    return all.slice(all.length - MAX_CHECKPOINTS);
  }

  // -------------------------------------------------------------------------
  // Project memory (tiered) — core.md is ALWAYS injected (budget-capped);
  // archive.md is read on demand. Both live under hidden, quota-exempt
  // .cowork/memory/, so they never show in the tree or count toward the quota.
  // -------------------------------------------------------------------------

  /** Read the raw core memory (the always-injected layer); '' if none. */
  async getMemory(): Promise<string> {
    try {
      return await fs.readFile(this.resolve(MEMORY_CORE_FILE), 'utf8');
    } catch {
      return '';
    }
  }

  /** True if the given core-memory text exceeds the injection budget. */
  isMemoryOverBudget(text: string): boolean {
    return text.length > this.memoryCharBudget;
  }

  /**
   * Core memory ready for injection: as-is when within budget, otherwise truncated
   * at a line boundary with a marker. The full text always stays on disk.
   */
  async getInjectableMemory(): Promise<string> {
    const core = await this.getMemory();
    if (core.length <= this.memoryCharBudget) {
      return core;
    }
    const slice = core.slice(0, this.memoryCharBudget);
    const lastNewline = slice.lastIndexOf('\n');
    const trimmed = lastNewline > 0 ? slice.slice(0, lastNewline) : slice;
    return trimmed + MEMORY_TRUNCATION_MARKER;
  }

  /** Replace core memory. Returns whether the stored content exceeds the budget. */
  async setMemory(text: string): Promise<{ overBudget: boolean }> {
    const content = typeof text === 'string' ? text : '';
    await this.writeInternal(MEMORY_CORE_FILE, Buffer.from(content, 'utf8'));
    return { overBudget: this.isMemoryOverBudget(content) };
  }

  /** Append a concise line to core memory. Returns whether it now exceeds the budget. */
  async appendMemory(line: string): Promise<{ overBudget: boolean }> {
    const entry = String(line ?? '').trim();
    if (!entry) {
      return { overBudget: this.isMemoryOverBudget(await this.getMemory()) };
    }
    const current = await this.getMemory();
    const separator = current && !current.endsWith('\n') ? '\n' : '';
    return this.setMemory(`${current}${separator}${entry}\n`);
  }

  /** Read the on-demand archive (never injected); '' if none. */
  async getMemoryArchive(): Promise<string> {
    try {
      return await fs.readFile(this.resolve(MEMORY_ARCHIVE_FILE), 'utf8');
    } catch {
      return '';
    }
  }

  /** Append verbose / overflow detail to the archive. */
  async appendMemoryArchive(text: string): Promise<void> {
    const entry = String(text ?? '').trim();
    if (!entry) {
      return;
    }
    const current = await this.getMemoryArchive();
    const separator = current && !current.endsWith('\n') ? '\n' : '';
    await this.writeInternal(
      MEMORY_ARCHIVE_FILE,
      Buffer.from(`${current}${separator}${entry}\n`, 'utf8'),
    );
  }
}

export default CoworkWorkspaceService;
