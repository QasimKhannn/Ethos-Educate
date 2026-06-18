// cowork — unit tests for CoworkWorkspaceService (no DB; operates on a temp dir).
import * as os from 'os';
import * as path from 'path';
import { promises as fs } from 'fs';
import { CoworkWorkspaceService, COWORK_OUTPUT_DIR } from './CoworkWorkspaceService';

describe('CoworkWorkspaceService', () => {
  let root: string;
  const projectId = 'proj_test123';

  const makeService = (quotaBytes?: number) =>
    new CoworkWorkspaceService({ root, projectId, quotaBytes });

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'cowork-ws-'));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  describe('construction', () => {
    it('rejects an empty root', () => {
      expect(() => new CoworkWorkspaceService({ root: '', projectId })).toThrow(/root is required/);
    });

    it('rejects an unsafe projectId', () => {
      expect(() => new CoworkWorkspaceService({ root, projectId: '../escape' })).toThrow(
        /invalid projectId/,
      );
      expect(() => new CoworkWorkspaceService({ root, projectId: 'a/b' })).toThrow(
        /invalid projectId/,
      );
    });
  });

  describe('ensure / getTree', () => {
    it('creates the workspace with an output/ dir', async () => {
      const ws = makeService();
      await ws.ensure();
      const outputStat = await fs.stat(path.join(ws.basePath, COWORK_OUTPUT_DIR));
      expect(outputStat.isDirectory()).toBe(true);
    });

    it('returns directories before files, alphabetical, with relative POSIX paths', async () => {
      const ws = makeService();
      await ws.ensure();
      await ws.writeFile('b.txt', Buffer.from('b'));
      await ws.writeFile('a.txt', Buffer.from('a'));
      await ws.writeFile('output/report.txt', Buffer.from('r'));

      const tree = await ws.getTree();
      expect(tree[0]).toMatchObject({ name: COWORK_OUTPUT_DIR, type: 'directory' });
      const names = tree.map((n) => n.name);
      expect(names).toEqual([COWORK_OUTPUT_DIR, 'a.txt', 'b.txt']);

      const outputNode = tree.find((n) => n.name === COWORK_OUTPUT_DIR);
      expect(outputNode?.children?.[0]).toMatchObject({
        name: 'report.txt',
        path: 'output/report.txt',
        type: 'file',
      });
    });
  });

  describe('path containment', () => {
    it('resolves safe relative paths inside the workspace', () => {
      const ws = makeService();
      const resolved = ws.resolve('output/deck.pptx');
      expect(resolved).toBe(path.join(ws.basePath, 'output', 'deck.pptx'));
    });

    it('rejects parent-escape paths', () => {
      const ws = makeService();
      expect(() => ws.resolve('../secrets.txt')).toThrow(/escapes workspace/);
      expect(() => ws.resolve('output/../../etc/passwd')).toThrow(/escapes workspace/);
    });

    it('strips leading slashes rather than treating them as absolute', () => {
      const ws = makeService();
      expect(ws.resolve('/output/x.txt')).toBe(path.join(ws.basePath, 'output', 'x.txt'));
    });

    it('blocks reads/writes that escape the workspace', async () => {
      const ws = makeService();
      await ws.ensure();
      await expect(ws.readFile('../../etc/hosts')).rejects.toThrow(/escapes workspace/);
      await expect(ws.writeFile('../evil.txt', Buffer.from('x'))).rejects.toThrow(
        /escapes workspace/,
      );
    });
  });

  describe('read / write / delete roundtrip', () => {
    it('writes then reads back identical bytes, creating parent dirs', async () => {
      const ws = makeService();
      const data = Buffer.from('hello cowork');
      await ws.writeFile('nested/dir/file.txt', data);
      const read = await ws.readFile('nested/dir/file.txt');
      expect(read.equals(data)).toBe(true);
    });

    it('deletes a file', async () => {
      const ws = makeService();
      await ws.writeFile('gone.txt', Buffer.from('x'));
      expect(await ws.exists('gone.txt')).toBe(true);
      await ws.deleteFile('gone.txt');
      expect(await ws.exists('gone.txt')).toBe(false);
    });

    it('refuses to delete the workspace root', async () => {
      const ws = makeService();
      await ws.ensure();
      await expect(ws.deleteFile('')).rejects.toThrow(/Refusing to delete/);
    });
  });

  describe('usage / quota', () => {
    it('reports total usage in bytes', async () => {
      const ws = makeService();
      await ws.writeFile('a.bin', Buffer.alloc(100));
      await ws.writeFile('output/b.bin', Buffer.alloc(50));
      expect(await ws.getUsage()).toBe(150);
    });

    it('excludes hidden execution machinery from usage', async () => {
      const ws = makeService();
      await ws.writeFile('visible.bin', Buffer.alloc(100));
      await ws.writeFile('.venv/lib.bin', Buffer.alloc(5000));
      await ws.writeFile('__pycache__/x.pyc', Buffer.alloc(3000));
      await ws.writeFile('__librechat_exec.py', Buffer.from('print(1)'));
      // Only the visible file counts.
      expect(await ws.getUsage()).toBe(100);
    });

    it('enforces the quota on write', async () => {
      const ws = makeService(120);
      await ws.writeFile('a.bin', Buffer.alloc(100));
      await expect(ws.writeFile('b.bin', Buffer.alloc(50))).rejects.toThrow(/quota exceeded/);
      // Overwriting the existing file within quota still works.
      await expect(ws.writeFile('a.bin', Buffer.alloc(110))).resolves.toBeUndefined();
    });
  });

  describe('edit review - staging, apply, undo', () => {
    it('hides .cowork from the tree and excludes it from usage', async () => {
      const ws = makeService();
      await ws.writeFile('doc.md', Buffer.from('hello'));
      await ws.stageProposed('doc.md', Buffer.from('hello world'));
      const tree = await ws.getTree();
      expect(tree.find((n) => n.name === '.cowork')).toBeUndefined();
      // usage counts only the live file (5 bytes), not the staged proposal.
      expect(await ws.getUsage()).toBe(5);
    });

    it('lists staged changes with status and kind, and reads proposed bytes', async () => {
      const ws = makeService();
      await ws.writeFile('notes.md', Buffer.from('v1'));
      await ws.stageProposed('notes.md', Buffer.from('v2')); // modified, text
      await ws.stageProposed('output/new.bin', Buffer.from('x')); // created, binary

      const changes = await ws.listProposedChanges();
      expect(changes).toHaveLength(2);
      expect(changes.find((c) => c.path === 'notes.md')).toMatchObject({
        status: 'modified',
        kind: 'text',
        proposedSize: 2,
        liveSize: 2,
      });
      expect(changes.find((c) => c.path === 'output/new.bin')).toMatchObject({
        status: 'created',
        kind: 'binary',
      });
      expect(await ws.readProposed('notes.md')).toEqual(Buffer.from('v2'));
    });

    it('discards staged proposals (one and all)', async () => {
      const ws = makeService();
      await ws.stageProposed('a.md', Buffer.from('x'));
      await ws.stageProposed('b.md', Buffer.from('y'));
      await ws.discardProposed('a.md');
      expect((await ws.listProposedChanges()).map((c) => c.path)).toEqual(['b.md']);
      await ws.discardAllProposed();
      expect(await ws.listProposedChanges()).toEqual([]);
    });

    it('applies a modified file: promotes it, clears staging, records a checkpoint', async () => {
      const ws = makeService();
      await ws.writeFile('doc.md', Buffer.from('original'));
      await ws.stageProposed('doc.md', Buffer.from('edited'));

      const cp = await ws.applyProposed(['doc.md'], 'edit doc');
      expect((await ws.readFile('doc.md')).toString()).toBe('edited');
      expect(await ws.listProposedChanges()).toEqual([]);
      expect(cp.entries).toEqual([{ path: 'doc.md', hadPrevious: true }]);

      const list = await ws.listCheckpoints();
      expect(list).toHaveLength(1);
      expect(list[0].message).toBe('edit doc');
    });

    it('restores a checkpoint, reverting a modified file to its prior content', async () => {
      const ws = makeService();
      await ws.writeFile('doc.md', Buffer.from('original'));
      await ws.stageProposed('doc.md', Buffer.from('edited'));
      const cp = await ws.applyProposed(['doc.md']);

      await ws.restoreCheckpoint(cp.id);
      expect((await ws.readFile('doc.md')).toString()).toBe('original');
      // The restore itself is snapshotted as a redo checkpoint.
      expect(await ws.listCheckpoints()).toHaveLength(2);
    });

    it('undoes a newly-created applied file by deleting it on restore', async () => {
      const ws = makeService();
      await ws.stageProposed('output/fresh.txt', Buffer.from('new'));
      const cp = await ws.applyProposed();
      expect(await ws.exists('output/fresh.txt')).toBe(true);

      await ws.restoreCheckpoint(cp.id);
      expect(await ws.exists('output/fresh.txt')).toBe(false);
    });

    it('stores, appends, and reads project memory', async () => {
      const ws = makeService();
      expect(await ws.getMemory()).toBe('');
      await ws.setMemory('- prefers concise summaries');
      expect(await ws.getMemory()).toBe('- prefers concise summaries');
      await ws.appendMemory('- uses British spelling');
      const core = await ws.getMemory();
      expect(core).toContain('- prefers concise summaries');
      expect(core).toContain('- uses British spelling');
    });

    it('truncates injected memory to the budget but keeps the full text on disk', async () => {
      const ws = new CoworkWorkspaceService({ root, projectId, memoryCharBudget: 30 });
      const long = ['- one', '- two', '- three', '- four', '- five'].join('\n');
      const { overBudget } = await ws.setMemory(long);
      expect(overBudget).toBe(true);
      expect(await ws.getMemory()).toBe(long); // full text preserved
      const injectable = await ws.getInjectableMemory();
      expect(injectable.length).toBeLessThan(long.length + 60);
      expect(injectable).toContain('memory truncated');
    });

    it('keeps memory out of the tree and the quota', async () => {
      const ws = makeService();
      await ws.writeFile('visible.txt', Buffer.from('hi'));
      await ws.setMemory('- a durable fact');
      await ws.appendMemoryArchive('verbose historical detail');
      const names = (await ws.getTree()).map((n) => n.name);
      expect(names).not.toContain('.cowork');
      expect(await ws.getUsage()).toBe(2); // only visible.txt
      expect(await ws.getMemoryArchive()).toContain('verbose historical detail');
    });

    it('prunes history beyond the checkpoint cap (20)', async () => {
      const ws = makeService();
      await ws.writeFile('f.md', Buffer.from('0'));
      for (let i = 1; i <= 22; i++) {
        await ws.stageProposed('f.md', Buffer.from(String(i)));
        await ws.applyProposed(['f.md'], `edit ${i}`);
      }
      expect(await ws.listCheckpoints()).toHaveLength(20);
    });

    it('rejects unsafe proposed paths', async () => {
      const ws = makeService();
      await expect(ws.stageProposed('../escape.md', Buffer.from('x'))).rejects.toThrow();
      await expect(ws.stageProposed('.cowork/proposed/x', Buffer.from('x'))).rejects.toThrow();
    });

    it('counts applied content against quota but not staging or history', async () => {
      const ws = makeService(50);
      await ws.writeFile('a.bin', Buffer.alloc(30));
      // Staging a large proposal does not trip the quota (it lives under .cowork).
      await ws.stageProposed('a.bin', Buffer.alloc(40));
      await ws.applyProposed(['a.bin']);
      expect(await ws.getUsage()).toBe(40);
    });
  });
});
