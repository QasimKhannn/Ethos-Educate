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
}

/** Default subfolder the agent is instructed to write deliverables into. */
export const COWORK_OUTPUT_DIR = 'output';

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

  constructor({ root, projectId, quotaBytes }: CoworkWorkspaceOptions) {
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
      const abs = path.join(absDir, entry.name);
      const rel = toPosix(path.relative(this.basePath, abs));
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
  async writeFile(relPath: string, data: Buffer): Promise<void> {
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
    await fs.writeFile(target, data);
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
}

export default CoworkWorkspaceService;
