import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  buildLocalCodeToolContext,
  createLocalCodeExecutionTool,
  getMaxPythonAutoInstalls,
  getPythonCommandCandidates,
  isPythonPackageInstallationEnabled,
  resolveCodeExecutionRuntime,
  resolveMissingPythonPackageName,
} from './localCodeExecution';

describe('localCodeExecution', () => {
  describe('resolveCodeExecutionRuntime', () => {
    it('prefers remote in auto mode when a code API key exists', () => {
      expect(resolveCodeExecutionRuntime({ codeApiKey: 'key', preferredRuntime: 'auto' })).toBe(
        'remote',
      );
    });

    it('falls back to local in auto mode when no code API key exists', () => {
      expect(resolveCodeExecutionRuntime({ codeApiKey: '', preferredRuntime: 'auto' })).toBe(
        'local',
      );
    });

    it('fails closed when remote mode is forced without a code API key', () => {
      expect(resolveCodeExecutionRuntime({ codeApiKey: '', preferredRuntime: 'remote' })).toBe(
        'unavailable',
      );
    });
  });

  describe('buildLocalCodeToolContext', () => {
    it('includes the local runtime path guidance and spreadsheet hint', () => {
      const context = buildLocalCodeToolContext(['sales.xlsx', 'sales.xlsx', 'notes.csv']);

      expect(context).toContain('./mnt/data/sales.xlsx');
      expect(context).toContain('./mnt/data/notes.csv');
      expect(context).toContain('require("xlsx")');
      expect(context).toContain('local runtime');
    });
  });

  describe('getPythonCommandCandidates', () => {
    it('prefers an explicit python override before the default binaries', () => {
      expect(getPythonCommandCandidates('/usr/local/bin/python-custom')).toEqual([
        '/usr/local/bin/python-custom',
        'python3',
        'python',
      ]);
    });
  });

  describe('python package installation helpers', () => {
    it('defaults package installation on and parses opt-out flags', () => {
      expect(isPythonPackageInstallationEnabled(undefined)).toBe(true);
      expect(isPythonPackageInstallationEnabled('false')).toBe(false);
      expect(isPythonPackageInstallationEnabled('1')).toBe(true);
    });

    it('uses a bounded positive auto-install count', () => {
      expect(getMaxPythonAutoInstalls('5')).toBe(5);
      expect(getMaxPythonAutoInstalls('0')).toBe(3);
    });

    it('maps missing module names to package names', () => {
      expect(resolveMissingPythonPackageName("ModuleNotFoundError: No module named 'bs4'")).toBe(
        'beautifulsoup4',
      );
      expect(resolveMissingPythonPackageName("ImportError: No module named 'custom_pkg'")).toBe(
        'custom_pkg',
      );
    });
  });

  describe('createLocalCodeExecutionTool', () => {
    it('runs JavaScript against staged input files and reports generated outputs', async () => {
      const tempDirectoryPath = await fs.mkdtemp(path.join(os.tmpdir(), 'local-code-test-'));
      const inputFilePath = path.join(tempDirectoryPath, 'input.txt');
      await fs.writeFile(inputFilePath, 'hello world', 'utf8');

      const executeCodeTool = createLocalCodeExecutionTool({
        projectRoot: process.cwd(),
        loadInputs: async () => ({
          files: [{ filename: 'input.txt', localPath: inputFilePath }],
          cleanup: async () => fs.rm(tempDirectoryPath, { recursive: true, force: true }),
        }),
      });

      const rawResult = await executeCodeTool.invoke({
        code: `
const fs = require('fs');
const input = fs.readFileSync('./mnt/data/input.txt', 'utf8');
fs.writeFileSync('output.txt', input.toUpperCase());
console.log('processed');
`,
        lang: 'javascript',
      });
      const result = rawResult as {
        artifact?: { files?: Array<{ name: string }> };
        content: string;
      };

      expect(result.content).toContain('Execution completed successfully.');
      expect(result.content).toContain('processed');
      expect(result.artifact?.files).toHaveLength(1);
      expect(result.artifact?.files?.[0]?.name).toBe('output.txt');
    });
  });
});
