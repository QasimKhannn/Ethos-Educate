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

    it('enforces the quota on write', async () => {
      const ws = makeService(120);
      await ws.writeFile('a.bin', Buffer.alloc(100));
      await expect(ws.writeFile('b.bin', Buffer.alloc(50))).rejects.toThrow(/quota exceeded/);
      // Overwriting the existing file within quota still works.
      await expect(ws.writeFile('a.bin', Buffer.alloc(110))).resolves.toBeUndefined();
    });
  });
});
