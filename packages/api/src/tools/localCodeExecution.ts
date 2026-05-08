import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { z } from 'zod';
import { CodeExecutionToolDefinition } from '@librechat/agents';
import { tool } from '@langchain/core/tools';
import { Tools } from 'librechat-data-provider';

export const LOCAL_CODE_EXECUTION_PREFIX = 'local://';
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_PYTHON_AUTO_INSTALLS = 3;
const DEFAULT_PIP_INSTALL_TIMEOUT_MS = 120_000;
const JS_WRAPPER_FILE = '__librechat_exec.js';
const PYTHON_WRAPPER_FILE = '__librechat_exec.py';
const PYTHON_CACHE_DIRECTORY = '__pycache__';
const PYTHON_VENV_DIRECTORY = '.venv';
const DEFAULT_PYTHON_COMMANDS = ['python3', 'python'] as const;
const MISSING_MODULE_PATTERN = /(?:ModuleNotFoundError|ImportError): No module named ['"]([^'"]+)['"]/;
const PACKAGE_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;
const PYTHON_PACKAGE_OVERRIDES: Readonly<Record<string, string>> = {
  bs4: 'beautifulsoup4',
  cv2: 'opencv-python-headless',
  Crypto: 'pycryptodome',
  docx: 'python-docx',
  dotenv: 'python-dotenv',
  fitz: 'PyMuPDF',
  PIL: 'Pillow',
  pptx: 'python-pptx',
  sklearn: 'scikit-learn',
  yaml: 'PyYAML',
};
const CODE_EXECUTION_LANGUAGE_OPTIONS = [
  'py',
  'js',
  'ts',
  'c',
  'cpp',
  'java',
  'php',
  'rs',
  'go',
  'd',
  'f90',
  'r',
  'bash',
] as const;
const LocalCodeExecutionToolSchema = z.object({
  lang: z
    .enum(CODE_EXECUTION_LANGUAGE_OPTIONS)
    .describe(CodeExecutionToolDefinition.schema.properties.lang.description),
  code: z.string().describe(CodeExecutionToolDefinition.schema.properties.code.description),
  args: z
    .array(z.string())
    .optional()
    .describe(CodeExecutionToolDefinition.schema.properties.args.description),
});

type CodeExecutionRuntimePreference = 'auto' | 'local' | 'remote';
type ResolvedLanguage = 'javascript' | 'python';

export type CodeExecutionRuntime = 'local' | 'remote' | 'unavailable';

export interface LocalCodeExecutionInputFile {
  filename: string;
  localPath: string;
}

export interface LoadLocalCodeExecutionInputsResult {
  files: LocalCodeExecutionInputFile[];
  cleanup?: () => Promise<void>;
}

export interface SandboxInputFile {
  filename: string;
  sourcePath: string;
}

export interface SandboxOutputFile {
  absolutePath: string;
  bytes: number;
  name: string;
  relativePath: string;
}

interface LocalExecutionCommandResult {
  exitCode: number | null;
  installedPackages?: string[];
  stderr: string;
  stdout: string;
  timedOut: boolean;
}

interface LocalExecutionResult {
  artifact?: {
    files: Array<{
      local_path: string;
      name: string;
    }>;
  };
  content: string;
}

export interface PythonExecutionEnvironment {
  command: string;
  env: NodeJS.ProcessEnv;
  packageInstallationEnabled: boolean;
}

export interface PythonPackageInstallResult extends LocalExecutionCommandResult {
  packageName: string;
}

const createSnapshotValue = (stats: { mtimeMs: number; size: number }): string =>
  `${stats.size}:${stats.mtimeMs}`;

export interface CreateLocalCodeExecutionToolParams {
  loadInputs?: () => Promise<LoadLocalCodeExecutionInputsResult>;
  projectRoot: string;
  timeoutMs?: number;
}

const dedupeFileNames = (files: SandboxInputFile[]): SandboxInputFile[] => {
  const seen = new Map<string, number>();

  return files.map((file) => {
    const baseName = path.basename(file.filename) || 'file';
    const currentCount = seen.get(baseName) ?? 0;

    if (currentCount === 0) {
      seen.set(baseName, 1);
      return {
        ...file,
        filename: baseName,
      };
    }

    seen.set(baseName, currentCount + 1);
    const extension = path.extname(baseName);
    const stem = extension ? baseName.slice(0, -extension.length) : baseName;

    return {
      ...file,
      filename: `${stem}-${currentCount + 1}${extension}`,
    };
  });
};

const parseRuntimePreference = (value?: string): CodeExecutionRuntimePreference => {
  if (value === 'local' || value === 'remote') {
    return value;
  }

  return 'auto';
};

const trimOutput = (value: string, maxLength = 12_000): string => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}\n...[truncated]`;
};

const parseEnabledFlag = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value == null || value.trim().length === 0) {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

const parsePositiveInteger = (value: string | undefined, defaultValue: number): number => {
  if (value == null || value.trim().length === 0) {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
};

const isMissingCommandError = (error: unknown): error is NodeJS.ErrnoException =>
  error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT';

const getVirtualEnvironmentPythonPath = (sandboxPath: string): string =>
  path.join(
    sandboxPath,
    PYTHON_VENV_DIRECTORY,
    process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
  );

const getPythonBaseEnv = (extraEnv?: NodeJS.ProcessEnv): NodeJS.ProcessEnv => ({
  ...process.env,
  ...extraEnv,
  PIP_CACHE_DIR:
    process.env.CODE_EXECUTION_PIP_CACHE_DIR ?? path.join(os.tmpdir(), 'librechat-pip-cache'),
  PYTHONNOUSERSITE: '1',
});

export const getPythonCommandCandidates = (
  preferredCommand = process.env.CODE_EXECUTION_PYTHON_BIN,
): string[] => {
  const preferred = preferredCommand?.trim();
  const commands = preferred ? [preferred, ...DEFAULT_PYTHON_COMMANDS] : [...DEFAULT_PYTHON_COMMANDS];
  return Array.from(new Set(commands));
};

export const isPythonPackageInstallationEnabled = (
  value = process.env.CODE_EXECUTION_ALLOW_PIP_INSTALLS,
): boolean => parseEnabledFlag(value, true);

export const getMaxPythonAutoInstalls = (
  value = process.env.CODE_EXECUTION_MAX_PIP_INSTALLS,
): number => parsePositiveInteger(value, DEFAULT_MAX_PYTHON_AUTO_INSTALLS);

export const getPythonPackageInstallTimeoutMs = (
  value = process.env.CODE_EXECUTION_PIP_INSTALL_TIMEOUT_MS,
): number => parsePositiveInteger(value, DEFAULT_PIP_INSTALL_TIMEOUT_MS);

export const resolveMissingPythonPackageName = (stderr: string): string | null => {
  const match = stderr.match(MISSING_MODULE_PATTERN);
  const moduleName = match?.[1]?.split('.')[0];

  if (!moduleName) {
    return null;
  }

  const packageName = PYTHON_PACKAGE_OVERRIDES[moduleName] ?? moduleName;
  return PACKAGE_NAME_PATTERN.test(packageName) ? packageName : null;
};

const normalizeLanguage = (
  language: string,
  projectRoot: string,
  code: string,
): { code: string; language: ResolvedLanguage } => {
  const normalized = language.trim().toLowerCase();

  if (normalized === 'python' || normalized === 'py') {
    return { language: 'python', code };
  }

  if (normalized === 'javascript' || normalized === 'js' || normalized === 'node') {
    return { language: 'javascript', code };
  }

  if (normalized === 'typescript' || normalized === 'ts') {
    const requireFromProject = createRequire(path.join(projectRoot, 'package.json'));
    let typescriptModule: typeof import('typescript');

    try {
      typescriptModule = requireFromProject('typescript') as typeof import('typescript');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`TypeScript execution requires the "typescript" package. ${message}`);
    }

    const transpiled = typescriptModule.transpileModule(code, {
      compilerOptions: {
        esModuleInterop: true,
        module: typescriptModule.ModuleKind.CommonJS,
        target: typescriptModule.ScriptTarget.ES2020,
      },
    });

    return {
      language: 'javascript',
      code: transpiled.outputText,
    };
  }

  throw new Error(
    `Unsupported language "${language}". Use JavaScript, TypeScript, or Python for execute_code.`,
  );
};

const listSandboxFiles = async (
  directoryPath: string,
  rootPath = directoryPath,
): Promise<SandboxOutputFile[]> => {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const files: SandboxOutputFile[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listSandboxFiles(absolutePath, rootPath)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const stats = await fs.stat(absolutePath);
    files.push({
      absolutePath,
      bytes: stats.size,
      name: path.basename(absolutePath),
      relativePath: path.relative(rootPath, absolutePath),
    });
  }

  return files;
};

const buildExecutionSummary = ({
  exitCode,
  generatedFiles,
  installedPackages = [],
  stderr,
  stdout,
  timedOut,
  timeoutMs,
}: {
  exitCode: number | null;
  generatedFiles: SandboxOutputFile[];
  installedPackages?: string[];
  stderr: string;
  stdout: string;
  timedOut: boolean;
  timeoutMs: number;
}): string => {
  const sections: string[] = [];

  if (timedOut) {
    sections.push(`Execution timed out after ${Math.ceil(timeoutMs / 1000)} seconds.`);
  } else if (exitCode === 0) {
    sections.push('Execution completed successfully.');
  } else {
    sections.push(`Execution failed with exit code ${exitCode ?? 'unknown'}.`);
  }

  const normalizedStdout = stdout.trim();
  if (normalizedStdout) {
    sections.push(`Stdout:\n\`\`\`\n${trimOutput(normalizedStdout)}\n\`\`\``);
  }

  const normalizedStderr = stderr.trim();
  if (normalizedStderr) {
    sections.push(`Stderr:\n\`\`\`\n${trimOutput(normalizedStderr)}\n\`\`\``);
  }

  if (generatedFiles.length > 0) {
    sections.push(`Generated files:\n${generatedFiles.map((file) => `- ${file.relativePath}`).join('\n')}`);
  }

  if (installedPackages.length > 0) {
    sections.push(`Installed Python packages:\n${installedPackages.map((name) => `- ${name}`).join('\n')}`);
  }

  if (sections.length === 1 && exitCode === 0) {
    sections.push('No console output or files were produced.');
  }

  return sections.join('\n\n');
};

const runCommand = ({
  args,
  command,
  cwd,
  env,
  timeoutMs,
}: {
  args: string[];
  command: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
}): Promise<LocalExecutionCommandResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      reject(error);
    });

    child.on('close', (exitCode) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      resolve({
        exitCode,
        stderr,
        stdout,
        timedOut,
      });
    });
  });

const runCommandWithFallback = async ({
  commandCandidates,
  cwd,
  env,
  filePath,
  timeoutMs,
}: {
  commandCandidates: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  filePath: string;
  timeoutMs: number;
}): Promise<LocalExecutionCommandResult> => {
  let lastError: unknown;

  for (const command of commandCandidates) {
    try {
      return await runCommand({
        args: [filePath],
        command,
        cwd,
        env,
        timeoutMs,
      });
    } catch (error) {
      if (!isMissingCommandError(error)) {
        throw error;
      }

      lastError = error;
    }
  }

  throw lastError ?? new Error('No available execution command was found.');
};

const runPythonCommand = ({
  command,
  cwd,
  env,
  filePath,
  timeoutMs,
}: {
  command: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  filePath: string;
  timeoutMs: number;
}): Promise<LocalExecutionCommandResult> =>
  runCommand({
    args: [filePath],
    command,
    cwd,
    env,
    timeoutMs,
  });

const createPythonVirtualEnvironment = async ({
  command,
  sandboxPath,
  timeoutMs,
}: {
  command: string;
  sandboxPath: string;
  timeoutMs: number;
}): Promise<string> => {
  const venvPath = path.join(sandboxPath, PYTHON_VENV_DIRECTORY);
  const env = getPythonBaseEnv();

  await fs.rm(venvPath, { recursive: true, force: true });
  const venvResult = await runCommand({
    args: ['-m', 'venv', '--system-site-packages', venvPath],
    command,
    cwd: sandboxPath,
    env,
    timeoutMs,
  });

  if (venvResult.exitCode === 0 && !venvResult.timedOut) {
    return getVirtualEnvironmentPythonPath(sandboxPath);
  }

  await fs.rm(venvPath, { recursive: true, force: true });
  const virtualenvResult = await runCommand({
    args: ['-m', 'virtualenv', '--system-site-packages', venvPath],
    command,
    cwd: sandboxPath,
    env,
    timeoutMs,
  });

  if (virtualenvResult.exitCode === 0 && !virtualenvResult.timedOut) {
    return getVirtualEnvironmentPythonPath(sandboxPath);
  }

  throw new Error(
    [
      'Python package installation requires venv or virtualenv support.',
      venvResult.stderr.trim(),
      virtualenvResult.stderr.trim(),
    ]
      .filter(Boolean)
      .join('\n'),
  );
};

export const preparePythonExecutionEnvironment = async ({
  packageInstallationEnabled = isPythonPackageInstallationEnabled(),
  sandboxPath,
  timeoutMs = 30_000,
}: {
  packageInstallationEnabled?: boolean;
  sandboxPath: string;
  timeoutMs?: number;
}): Promise<PythonExecutionEnvironment> => {
  let lastError: unknown;

  for (const command of getPythonCommandCandidates()) {
    try {
      if (!packageInstallationEnabled) {
        const result = await runCommand({
          args: ['--version'],
          command,
          cwd: sandboxPath,
          env: getPythonBaseEnv(),
          timeoutMs,
        });

        if (result.exitCode === 0 && !result.timedOut) {
          return {
            command,
            env: getPythonBaseEnv(),
            packageInstallationEnabled: false,
          };
        }

        lastError = new Error(result.stderr || result.stdout || `${command} is not available.`);
        continue;
      }

      const pythonPath = await createPythonVirtualEnvironment({
        command,
        sandboxPath,
        timeoutMs,
      });
      const venvPath = path.join(sandboxPath, PYTHON_VENV_DIRECTORY);

      return {
        command: pythonPath,
        env: getPythonBaseEnv({
          PATH: `${path.dirname(pythonPath)}${path.delimiter}${process.env.PATH ?? ''}`,
          VIRTUAL_ENV: venvPath,
        }),
        packageInstallationEnabled: true,
      };
    } catch (error) {
      lastError = error;

      if (!isMissingCommandError(error)) {
        continue;
      }
    }
  }

  throw lastError ?? new Error('No available Python runtime was found.');
};

export const installPythonPackage = async ({
  environment,
  packageName,
  sandboxPath,
  timeoutMs = getPythonPackageInstallTimeoutMs(),
}: {
  environment: PythonExecutionEnvironment;
  packageName: string;
  sandboxPath: string;
  timeoutMs?: number;
}): Promise<PythonPackageInstallResult> => {
  const result = await runCommand({
    args: ['-m', 'pip', 'install', '--disable-pip-version-check', packageName],
    command: environment.command,
    cwd: sandboxPath,
    env: environment.env,
    timeoutMs,
  });

  return {
    ...result,
    packageName,
  };
};

export const runPythonFileWithPackageInstallation = async ({
  environment,
  filePath,
  maxInstallAttempts = getMaxPythonAutoInstalls(),
  sandboxPath,
  timeoutMs,
}: {
  environment: PythonExecutionEnvironment;
  filePath: string;
  maxInstallAttempts?: number;
  sandboxPath: string;
  timeoutMs: number;
}): Promise<LocalExecutionCommandResult> => {
  const installedPackages: string[] = [];
  const attemptedPackages = new Set<string>();
  let result = await runPythonCommand({
    command: environment.command,
    cwd: sandboxPath,
    env: environment.env,
    filePath,
    timeoutMs,
  });

  while (
    environment.packageInstallationEnabled &&
    !result.timedOut &&
    result.exitCode !== 0 &&
    installedPackages.length < maxInstallAttempts
  ) {
    const packageName = resolveMissingPythonPackageName(result.stderr);

    if (packageName == null || attemptedPackages.has(packageName)) {
      break;
    }

    attemptedPackages.add(packageName);
    const installResult = await installPythonPackage({
      environment,
      packageName,
      sandboxPath,
    });

    if (installResult.timedOut || installResult.exitCode !== 0) {
      return {
        ...result,
        installedPackages,
        stderr: [
          result.stderr,
          `Failed to install Python package "${packageName}".`,
          installResult.stdout.trim() ? `pip stdout:\n${installResult.stdout.trim()}` : '',
          installResult.stderr.trim() ? `pip stderr:\n${installResult.stderr.trim()}` : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
      };
    }

    installedPackages.push(packageName);
    result = await runPythonCommand({
      command: environment.command,
      cwd: sandboxPath,
      env: environment.env,
      filePath,
      timeoutMs,
    });
  }

  return {
    ...result,
    installedPackages,
  };
};

const buildJavaScriptWrapper = ({
  code,
  projectRoot,
  sandboxPath,
}: {
  code: string;
  projectRoot: string;
  sandboxPath: string;
}) => {
  const packageJsonPath = path.join(projectRoot, 'package.json');

  return `const { createRequire } = require('module');
const require = createRequire(${JSON.stringify(packageJsonPath)});
process.chdir(${JSON.stringify(sandboxPath)});

(async () => {
${code}
})().catch((error) => {
  console.error(error?.stack ?? String(error));
  process.exitCode = 1;
});
`;
};

const writeExecutionFile = async ({
  code,
  language,
  projectRoot,
  sandboxPath,
}: {
  code: string;
  language: ResolvedLanguage;
  projectRoot: string;
  sandboxPath: string;
}): Promise<string> => {
  if (language === 'javascript') {
    const filePath = path.join(sandboxPath, JS_WRAPPER_FILE);
    await fs.writeFile(filePath, buildJavaScriptWrapper({ code, projectRoot, sandboxPath }), 'utf8');
    return filePath;
  }

  const filePath = path.join(sandboxPath, PYTHON_WRAPPER_FILE);
  await fs.writeFile(filePath, code, 'utf8');
  return filePath;
};

export const prepareSandbox = async ({
  inputFiles,
  sandboxPath,
}: {
  inputFiles: SandboxInputFile[];
  sandboxPath: string;
}): Promise<Map<string, string>> => {
  const dataDirectoryPath = path.join(sandboxPath, 'mnt', 'data');
  await fs.mkdir(dataDirectoryPath, { recursive: true });

  const snapshot = new Map<string, string>();
  const normalizedFiles = dedupeFileNames(inputFiles);

  for (const file of normalizedFiles) {
    const targetPath = path.join(dataDirectoryPath, file.filename);
    await fs.copyFile(file.sourcePath, targetPath);
    const stats = await fs.stat(targetPath);
    snapshot.set(path.relative(sandboxPath, targetPath), createSnapshotValue(stats));
  }

  return snapshot;
};

export const collectGeneratedFiles = async ({
  beforeState,
  excludedFiles = new Set<string>(),
  excludedPathPrefixes = [],
  sandboxPath,
}: {
  beforeState: Map<string, string>;
  excludedFiles?: Set<string>;
  excludedPathPrefixes?: string[];
  sandboxPath: string;
}): Promise<SandboxOutputFile[]> => {
  const files = await listSandboxFiles(sandboxPath);
  const generatedFiles: SandboxOutputFile[] = [];

  for (const file of files) {
    if (excludedFiles.has(file.relativePath)) {
      continue;
    }

    if (
      excludedPathPrefixes.some(
        (prefix) => file.relativePath === prefix || file.relativePath.startsWith(`${prefix}${path.sep}`),
      )
    ) {
      continue;
    }

    const currentStats = await fs.stat(file.absolutePath);
    const previousState = beforeState.get(file.relativePath);
    if (previousState == null) {
      generatedFiles.push(file);
      continue;
    }

    if (previousState !== createSnapshotValue(currentStats)) {
      generatedFiles.push(file);
    }
  }

  return generatedFiles;
};

const executeLocalCode = async ({
  code,
  inputFiles,
  language,
  projectRoot,
  timeoutMs,
}: {
  code: string;
  inputFiles: SandboxInputFile[];
  language: ResolvedLanguage;
  projectRoot: string;
  timeoutMs: number;
}): Promise<LocalExecutionResult> => {
  const sandboxPath = await fs.mkdtemp(path.join(os.tmpdir(), 'librechat-exec-'));

  try {
    const beforeState = await prepareSandbox({ inputFiles, sandboxPath });
    const executionFilePath = await writeExecutionFile({
      code,
      language,
      projectRoot,
      sandboxPath,
    });
    const result =
      language === 'python'
        ? await runPythonFileWithPackageInstallation({
            environment: await preparePythonExecutionEnvironment({ sandboxPath }),
            filePath: executionFilePath,
            sandboxPath,
            timeoutMs,
          })
        : await runCommandWithFallback({
            commandCandidates: [process.execPath],
            cwd: sandboxPath,
            env: process.env,
            filePath: executionFilePath,
            timeoutMs,
          });
    const generatedFiles = await collectGeneratedFiles({
      beforeState,
      excludedFiles: new Set([JS_WRAPPER_FILE, PYTHON_WRAPPER_FILE]),
      excludedPathPrefixes: [PYTHON_CACHE_DIRECTORY, PYTHON_VENV_DIRECTORY],
      sandboxPath,
    });

    if (generatedFiles.length === 0) {
      await fs.rm(sandboxPath, { recursive: true, force: true });
    }

    return {
      artifact:
        generatedFiles.length > 0
          ? {
              files: generatedFiles.map((file) => ({
                local_path: file.absolutePath,
                name: file.name,
              })),
            }
          : undefined,
      content: buildExecutionSummary({
        exitCode: result.exitCode,
        generatedFiles,
        installedPackages: result.installedPackages,
        stderr: result.stderr,
        stdout: result.stdout,
        timedOut: result.timedOut,
        timeoutMs,
      }),
    };
  } catch (error) {
    await fs.rm(sandboxPath, { recursive: true, force: true }).catch(() => undefined);
    const message = error instanceof Error ? error.message : String(error);

    return {
      content: `Execution failed before completion.\n\nStderr:\n\`\`\`\n${trimOutput(message)}\n\`\`\``,
    };
  }
};

export const createLocalCodeExecutionFileIdentifier = (fileId: string): string =>
  `${LOCAL_CODE_EXECUTION_PREFIX}${fileId}`;

export const isLocalCodeExecutionFileIdentifier = (fileIdentifier?: string): boolean =>
  fileIdentifier?.startsWith(LOCAL_CODE_EXECUTION_PREFIX) === true;

export const resolveCodeExecutionRuntime = ({
  codeApiKey,
  preferredRuntime = process.env.CODE_EXECUTION_RUNTIME,
}: {
  codeApiKey?: string | null;
  preferredRuntime?: string;
}): CodeExecutionRuntime => {
  const runtimePreference = parseRuntimePreference(preferredRuntime);

  if (runtimePreference === 'local') {
    return 'local';
  }

  if (runtimePreference === 'remote') {
    return codeApiKey ? 'remote' : 'unavailable';
  }

  return codeApiKey ? 'remote' : 'local';
};

export const buildLocalCodeToolContext = (
  fileNames: string[],
  includeSpreadsheetHint = true,
): string => {
  const uniqueFileNames = Array.from(
    new Set(
      fileNames
        .map((name) => (typeof name === 'string' && name.length > 0 ? path.basename(name) : ''))
        .filter(Boolean),
    ),
  );
  const lines = [
    `- Note: The "${Tools.execute_code}" tool is running in the local runtime for this conversation.`,
    '- Use relative file paths like "./mnt/data/<filename>" instead of "/mnt/data/<filename>".',
    '- If a Python import is missing, the runtime can install the missing package into an isolated sandbox and rerun the code.',
  ];

  if (includeSpreadsheetHint) {
    lines.push('- For spreadsheet work in JavaScript, `require("xlsx")` is available.');
  }

  if (uniqueFileNames.length === 0) {
    lines.push('- No files are currently loaded into the code environment.');
    return lines.join('\n');
  }

  lines.push('- Available files:');
  for (const fileName of uniqueFileNames) {
    lines.push(`\t- ./mnt/data/${fileName}`);
  }

  return lines.join('\n');
};

export const createLocalCodeExecutionTool = ({
  loadInputs,
  projectRoot,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: CreateLocalCodeExecutionToolParams) =>
  tool(
    async ({ code, lang }) => {
      const loadedInputs = (await loadInputs?.()) ?? { files: [] };

      try {
        const normalized = normalizeLanguage(lang, projectRoot, code);
        const result = await executeLocalCode({
          code: normalized.code,
          inputFiles: loadedInputs.files.map((file) => ({
            filename: file.filename,
            sourcePath: file.localPath,
          })),
          language: normalized.language,
          projectRoot,
          timeoutMs,
        });
        return [result.content, result.artifact];
      } finally {
        await loadedInputs.cleanup?.();
      }
    },
    {
      description: CodeExecutionToolDefinition.description,
      name: CodeExecutionToolDefinition.name,
      responseFormat: 'content_and_artifact',
      schema: LocalCodeExecutionToolSchema,
    },
  );
