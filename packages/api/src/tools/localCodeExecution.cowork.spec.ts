// cowork — tests for the work-in-place + clean-env executor options (Slice 1).
// Runs real python (available in CI/sandbox). Pip installs disabled for speed/determinism.
import * as os from 'os';
import * as path from 'path';
import { promises as fs } from 'fs';
import { buildCleanEnv, executeLocalCode } from './localCodeExecution';

const SECRET_KEY = 'COWORK_TEST_SECRET';
const SECRET_VAL = 'do-not-leak';

describe('cowork executor options', () => {
  let prevPip: string | undefined;

  beforeAll(() => {
    prevPip = process.env.CODE_EXECUTION_ALLOW_PIP_INSTALLS;
    process.env.CODE_EXECUTION_ALLOW_PIP_INSTALLS = 'false'; // run python directly, no venv
    process.env[SECRET_KEY] = SECRET_VAL;
  });

  afterAll(() => {
    if (prevPip == null) {
      delete process.env.CODE_EXECUTION_ALLOW_PIP_INSTALLS;
    } else {
      process.env.CODE_EXECUTION_ALLOW_PIP_INSTALLS = prevPip;
    }
    delete process.env[SECRET_KEY];
  });

  describe('buildCleanEnv', () => {
    it('keeps operational vars and drops app secrets', () => {
      const clean = buildCleanEnv();
      expect(clean.PATH ?? clean.Path).toBeDefined();
      expect(clean[SECRET_KEY]).toBeUndefined();
      // CODE_EXECUTION_* config is allowed through (prefix allowlist)
      expect(clean.CODE_EXECUTION_ALLOW_PIP_INSTALLS).toBe('false');
    });
  });

  describe('executeLocalCode — work-in-place (workingDir)', () => {
    it('runs in the given dir, persists it, removes only the wrapper, and (cleanEnv) hides secrets', async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cowork-ws-'));
      try {
        const code = [
          'import os',
          "open('out.txt', 'w').write('hi')",
          "print('SECRET=' + str(os.environ.get('" + SECRET_KEY + "')))",
        ].join('\n');

        const res = await executeLocalCode({
          code,
          inputFiles: [],
          language: 'python',
          projectRoot: os.tmpdir(),
          timeoutMs: 30_000,
          workingDir: dir,
          cleanEnv: true,
        });

        // wrote into the workspace dir
        expect(await fs.readFile(path.join(dir, 'out.txt'), 'utf8')).toBe('hi');
        // dir was NOT deleted (work-in-place)
        await expect(fs.stat(dir)).resolves.toBeDefined();
        // wrapper cleaned up
        await expect(fs.stat(path.join(dir, '__librechat_exec.py'))).rejects.toBeDefined();
        // secret was stripped by cleanEnv
        expect(res.content).toContain('SECRET=None');
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    }, 40_000);

    it('without cleanEnv, the child still sees process env (default behavior unchanged)', async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cowork-ws-'));
      try {
        const code =
          "import os\nprint('SECRET=' + str(os.environ.get('" + SECRET_KEY + "')))";
        const res = await executeLocalCode({
          code,
          inputFiles: [],
          language: 'python',
          projectRoot: os.tmpdir(),
          timeoutMs: 30_000,
          workingDir: dir,
          // cleanEnv omitted → today's behavior
        });
        expect(res.content).toContain(`SECRET=${SECRET_VAL}`);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    }, 40_000);
  });

  describe('executeLocalCode — default temp sandbox path still works', () => {
    it('executes and returns stdout', async () => {
      const res = await executeLocalCode({
        code: "print('hello-default-path')",
        inputFiles: [],
        language: 'python',
        projectRoot: os.tmpdir(),
        timeoutMs: 30_000,
      });
      expect(res.content).toContain('hello-default-path');
    }, 40_000);
  });
});
