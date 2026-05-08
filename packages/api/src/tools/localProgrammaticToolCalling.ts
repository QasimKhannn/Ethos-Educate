import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { z } from 'zod';
import { ProgrammaticToolCallingDefinition } from '@librechat/agents';
import { tool } from '@langchain/core/tools';
import { Constants } from 'librechat-data-provider';
import type { StructuredToolInterface } from '@langchain/core/tools';
import type { LCTool } from '@librechat/agents';
import type {
  LoadLocalCodeExecutionInputsResult,
  PythonExecutionEnvironment,
  SandboxInputFile,
  SandboxOutputFile,
} from './localCodeExecution';
import {
  collectGeneratedFiles,
  getMaxPythonAutoInstalls,
  installPythonPackage,
  preparePythonExecutionEnvironment,
  prepareSandbox,
  resolveMissingPythonPackageName,
} from './localCodeExecution';

const DEFAULT_TIMEOUT_MS = 60_000;
const PYTHON_WRAPPER_FILE = '__librechat_ptc.py';
const PYTHON_CACHE_DIRECTORY = '__pycache__';
const PYTHON_VENV_DIRECTORY = '.venv';
const IMAGE_FILE_REGEX = /\.(jpg|jpeg|png|gif|webp)$/i;
const EMPTY_OUTPUT_MESSAGE = "stdout: Empty. Ensure you're writing output explicitly.\n";
const IMAGE_MESSAGE = 'Image is already displayed to the user';
const OTHER_FILE_MESSAGE = 'File is already downloaded by the user';
const ACCESS_MESSAGE =
  'Note: Files from previous executions are automatically available and can be modified.';
const LOCAL_PATH_GUIDANCE =
  '- Note: The local runtime uses relative sandbox paths like "./mnt/data/<filename>" instead of "/mnt/data/<filename>".';
const PYTHON_PACKAGE_GUIDANCE =
  '- If a Python import is missing, the runtime can install the missing package into an isolated sandbox and rerun the code.';
const LocalProgrammaticToolCallingSchema = z.object({
  code: z
    .string()
    .min(1)
    .describe(ProgrammaticToolCallingDefinition.schema.properties.code.description),
  timeout: z
    .number()
    .int()
    .min(1000)
    .max(300000)
    .default(DEFAULT_TIMEOUT_MS)
    .describe(ProgrammaticToolCallingDefinition.schema.properties.timeout.description),
});

const PYTHON_KEYWORDS = new Set([
  'False',
  'None',
  'True',
  'and',
  'as',
  'assert',
  'async',
  'await',
  'break',
  'class',
  'continue',
  'def',
  'del',
  'elif',
  'else',
  'except',
  'finally',
  'for',
  'from',
  'global',
  'if',
  'import',
  'in',
  'is',
  'lambda',
  'nonlocal',
  'not',
  'or',
  'pass',
  'raise',
  'return',
  'try',
  'while',
  'with',
  'yield',
]);

interface ProgrammaticToolExecutionRequest {
  id: string;
  input?: Record<string, unknown>;
  name: string;
  type?: string;
}

interface ProgrammaticToolExecutionResponse {
  call_id: string;
  error_message?: string;
  is_error: boolean;
  result: unknown;
}

interface ProgrammaticExecutionCommandResult {
  exitCode: number | null;
  installedPackages?: string[];
  stderr: string;
  stdout: string;
  timedOut: boolean;
}

interface LocalProgrammaticExecutionResult {
  artifact?: {
    files: Array<{
      local_path: string;
      name: string;
    }>;
  };
  content: string;
}

type ProgrammaticToolMap = Map<string, StructuredToolInterface & { mcp?: boolean }>;

export interface CreateLocalProgrammaticToolCallingToolParams {
  loadInputs?: () => Promise<LoadLocalCodeExecutionInputsResult>;
  timeoutMs?: number;
}

export const LocalProgrammaticToolCallingDescription = [
  ProgrammaticToolCallingDefinition.description.replaceAll('/mnt/data/', './mnt/data/'),
  LOCAL_PATH_GUIDANCE,
  PYTHON_PACKAGE_GUIDANCE,
].join('\n\n');

export const LocalProgrammaticToolCallingDefinition = {
  ...ProgrammaticToolCallingDefinition,
  description: LocalProgrammaticToolCallingDescription,
} as const;

const trimOutput = (value: string, maxLength = 12_000): string => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}\n...[truncated]`;
};

export const normalizeToPythonIdentifier = (name: string): string => {
  let normalized = name.replace(/[-\s]/g, '_');

  normalized = normalized.replace(/[^a-zA-Z0-9_]/g, '');

  if (/^[0-9]/.test(normalized)) {
    normalized = `_${normalized}`;
  }

  if (PYTHON_KEYWORDS.has(normalized)) {
    normalized = `${normalized}_tool`;
  }

  return normalized;
};

const extractUsedToolNames = (code: string, toolNameMap: Map<string, string>): Set<string> => {
  const usedTools = new Set<string>();

  for (const [pythonName, originalName] of toolNameMap) {
    const escapedName = pythonName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escapedName}\\s*\\(`, 'g');

    if (pattern.test(code)) {
      usedTools.add(originalName);
    }
  }

  return usedTools;
};

const filterToolsByUsage = (toolDefs: LCTool[], code: string): LCTool[] => {
  const toolNameMap = new Map<string, string>();
  for (const toolDef of toolDefs) {
    toolNameMap.set(normalizeToPythonIdentifier(toolDef.name), toolDef.name);
  }

  const usedToolNames = extractUsedToolNames(code, toolNameMap);
  if (usedToolNames.size === 0) {
    return toolDefs;
  }

  return toolDefs.filter((toolDef) => usedToolNames.has(toolDef.name));
};

const isContentBlock = (value: unknown): value is { text?: string; type: string } => {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) {
    return false;
  }

  return typeof (value as { type?: unknown }).type === 'string';
};

const extractTextFromBlock = (value: unknown): string | null => {
  if (!isContentBlock(value)) {
    return null;
  }

  return value.type === 'text' && typeof value.text === 'string' ? value.text : null;
};

const extractTextFromContent = (content: unknown): string | null => {
  if (isContentBlock(content)) {
    return extractTextFromBlock(content);
  }

  if (!Array.isArray(content) || content.length === 0) {
    return null;
  }

  const texts = content.map(extractTextFromBlock).filter((value): value is string => value != null);
  return texts.length > 0 ? texts.join('\n') : null;
};

const maybeParseJson = (value: string): unknown => {
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return value;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
};

export const unwrapProgrammaticToolResponse = (result: unknown, isMCPTool: boolean): unknown => {
  if (!isMCPTool) {
    return result;
  }

  if (Array.isArray(result) && result.length > 0 && result.every(isContentBlock)) {
    const extractedText = extractTextFromContent(result);
    if (extractedText != null) {
      return maybeParseJson(extractedText);
    }
  }

  if (Array.isArray(result) && result.length > 0) {
    const [content] = result;
    if (typeof content === 'string') {
      return maybeParseJson(content);
    }

    const extractedText = extractTextFromContent(content);
    if (extractedText != null) {
      return maybeParseJson(extractedText);
    }

    if (typeof content === 'object' && content != null) {
      return content;
    }
  }

  const extractedText = extractTextFromContent(result);
  if (extractedText != null) {
    return maybeParseJson(extractedText);
  }

  return result;
};

const indentPythonCode = (code: string): string =>
  code
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');

const buildProgrammaticWrapper = ({
  code,
  sandboxPath,
  toolDefs,
}: {
  code: string;
  sandboxPath: string;
  toolDefs: LCTool[];
}): string => {
  const toolFunctions = toolDefs
    .map((toolDef) => {
      const pythonName = normalizeToPythonIdentifier(toolDef.name);
      return `async def ${pythonName}(*args, **kwargs):
    if args:
        raise TypeError("Tool calls must use keyword arguments only.")
    return await _call_tool(${JSON.stringify(toolDef.name)}, kwargs)
`;
    })
    .join('\n');

  return `import asyncio
import json
import os
import sys
import traceback

os.chdir(${JSON.stringify(sandboxPath)})

_request_writer = os.fdopen(3, 'w', buffering=1, encoding='utf-8')
_io_lock = asyncio.Lock()
_call_counter = 0

async def _call_tool(tool_name, tool_input):
    global _call_counter

    _call_counter += 1
    call_id = f"call_{_call_counter}"
    payload = {
        "type": "tool_call",
        "id": call_id,
        "name": tool_name,
        "input": tool_input,
    }

    async with _io_lock:
        await asyncio.to_thread(_request_writer.write, json.dumps(payload) + "\\n")
        await asyncio.to_thread(_request_writer.flush)
        line = await asyncio.to_thread(sys.stdin.readline)

    if not line:
        raise RuntimeError(f"Tool {tool_name} did not return a response.")

    response = json.loads(line)
    if response.get("is_error"):
        raise RuntimeError(response.get("error_message") or f"Tool {tool_name} failed")

    return response.get("result")

${toolFunctions}
async def __user_main__():
${indentPythonCode(code)}

async def __main__():
    await __user_main__()

if __name__ == "__main__":
    try:
        asyncio.run(__main__())
    except Exception:
        traceback.print_exc()
        sys.exit(1)
`;
};

const writeProgrammaticExecutionFile = async ({
  code,
  sandboxPath,
  toolDefs,
}: {
  code: string;
  sandboxPath: string;
  toolDefs: LCTool[];
}): Promise<string> => {
  const filePath = path.join(sandboxPath, PYTHON_WRAPPER_FILE);
  await fs.writeFile(filePath, buildProgrammaticWrapper({ code, sandboxPath, toolDefs }), 'utf8');
  return filePath;
};

const writeJsonLine = async (
  stream: NodeJS.WritableStream,
  payload: ProgrammaticToolExecutionResponse,
): Promise<void> =>
  await new Promise((resolve, reject) => {
    stream.write(`${JSON.stringify(payload)}\n`, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(undefined);
    });
  });

const executeProgrammaticToolCall = async ({
  request,
  toolMap,
}: {
  request: ProgrammaticToolExecutionRequest;
  toolMap: ProgrammaticToolMap;
}): Promise<ProgrammaticToolExecutionResponse> => {
  const tool = toolMap.get(request.name);
  if (!tool) {
    return {
      call_id: request.id,
      error_message: `Tool "${request.name}" not found.`,
      is_error: true,
      result: null,
    };
  }

  try {
    const rawResult = await tool.invoke(request.input ?? {}, {
      metadata: { [Constants.PROGRAMMATIC_TOOL_CALLING]: true },
    });

    return {
      call_id: request.id,
      is_error: false,
      result: unwrapProgrammaticToolResponse(rawResult, tool.mcp === true),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      call_id: request.id,
      error_message: message,
      is_error: true,
      result: null,
    };
  }
};

const runProgrammaticCommandOnce = ({
  cwd,
  environment,
  filePath,
  timeoutMs,
  toolMap,
}: {
  cwd: string;
  environment: PythonExecutionEnvironment;
  filePath: string;
  timeoutMs: number;
  toolMap: ProgrammaticToolMap;
}): Promise<ProgrammaticExecutionCommandResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(environment.command, [filePath], {
      cwd,
      env: environment.env,
      stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
    });

    const requestStream = child.stdio[3] as NodeJS.ReadableStream | null;
    const responseStream = child.stdin;
    if (requestStream == null || responseStream == null) {
      child.kill('SIGKILL');
      reject(new Error('Programmatic execution control channels are not available.'));
      return;
    }

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    let responseQueue = Promise.resolve();
    const pendingResponses = new Set<Promise<void>>();
    const requestReader = readline.createInterface({ input: requestStream });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    const scheduleResponse = (payload: ProgrammaticToolExecutionResponse) => {
      responseQueue = responseQueue.then(() => writeJsonLine(responseStream, payload));
      return responseQueue;
    };

    requestReader.on('line', (line) => {
      let request: ProgrammaticToolExecutionRequest | undefined;

      const responsePromise = (async () => {
        try {
          request = JSON.parse(line) as ProgrammaticToolExecutionRequest;
        } catch (error) {
          throw new Error(
            `Invalid tool call payload: ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        const payload = await executeProgrammaticToolCall({ request, toolMap });
        await scheduleResponse(payload);
      })()
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          if (!request) {
            stderr += `${message}\n`;
            child.kill('SIGKILL');
            return Promise.resolve();
          }

          return scheduleResponse({
            call_id: request?.id ?? randomUUID(),
            error_message: message,
            is_error: true,
            result: null,
          });
        })
        .finally(() => {
          pendingResponses.delete(responsePromise);
        });

      pendingResponses.add(responsePromise);
    });

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
      requestReader.close();
      reject(error);
    });

    child.on('close', () => {
      void (async () => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timer);
        requestReader.close();

        await Promise.allSettled(Array.from(pendingResponses));
        await responseQueue.catch(() => undefined);

        resolve({
          exitCode: child.exitCode,
          stderr,
          stdout,
          timedOut,
        });
      })();
    });
  });

const runProgrammaticCommand = async ({
  cwd,
  filePath,
  timeoutMs,
  toolMap,
}: {
  cwd: string;
  filePath: string;
  timeoutMs: number;
  toolMap: ProgrammaticToolMap;
}): Promise<ProgrammaticExecutionCommandResult> => {
  const environment = await preparePythonExecutionEnvironment({ sandboxPath: cwd });
  const installedPackages: string[] = [];
  const attemptedPackages = new Set<string>();
  let result = await runProgrammaticCommandOnce({
    cwd,
    environment,
    filePath,
    timeoutMs,
    toolMap,
  });

  while (
    environment.packageInstallationEnabled &&
    !result.timedOut &&
    result.exitCode !== 0 &&
    installedPackages.length < getMaxPythonAutoInstalls()
  ) {
    const packageName = resolveMissingPythonPackageName(result.stderr);

    if (packageName == null || attemptedPackages.has(packageName)) {
      break;
    }

    attemptedPackages.add(packageName);
    const installResult = await installPythonPackage({
      environment,
      packageName,
      sandboxPath: cwd,
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
    result = await runProgrammaticCommandOnce({
      cwd,
      environment,
      filePath,
      timeoutMs,
      toolMap,
    });
  }

  return {
    ...result,
    installedPackages,
  };
};

const formatProgrammaticOutput = ({
  generatedFiles,
  installedPackages = [],
  stderr,
  stdout,
}: {
  generatedFiles: SandboxOutputFile[];
  installedPackages?: string[];
  stderr: string;
  stdout: string;
}): string => {
  let formatted = '';

  if (stdout.trim().length > 0) {
    formatted += `stdout:\n${trimOutput(stdout.trim())}\n`;
  } else {
    formatted += EMPTY_OUTPUT_MESSAGE;
  }

  if (stderr.trim().length > 0) {
    formatted += `stderr:\n${trimOutput(stderr.trim())}\n`;
  }

  if (installedPackages.length > 0) {
    formatted += `Installed Python packages:\n${installedPackages.map((name) => `- ${name}`).join('\n')}\n`;
  }

  if (generatedFiles.length > 0) {
    formatted += 'Generated files:\n';

    for (let i = 0; i < generatedFiles.length; i += 1) {
      const file = generatedFiles[i];
      const isImage = IMAGE_FILE_REGEX.test(file.name);
      formatted += `- /mnt/data/${file.name} | ${isImage ? IMAGE_MESSAGE : OTHER_FILE_MESSAGE}`;

      if (i < generatedFiles.length - 1) {
        formatted += generatedFiles.length <= 3 ? ', ' : ',\n';
      }
    }

    formatted += `\n\n${ACCESS_MESSAGE}`;
  }

  return formatted.trim();
};

const executeLocalProgrammaticCode = async ({
  code,
  inputFiles,
  timeoutMs,
  toolDefs,
  toolMap,
}: {
  code: string;
  inputFiles: SandboxInputFile[];
  timeoutMs: number;
  toolDefs: LCTool[];
  toolMap: ProgrammaticToolMap;
}): Promise<LocalProgrammaticExecutionResult> => {
  const sandboxPath = await fs.mkdtemp(path.join(os.tmpdir(), 'librechat-ptc-'));

  try {
    const beforeState = await prepareSandbox({ inputFiles, sandboxPath });
    const executionFilePath = await writeProgrammaticExecutionFile({
      code,
      sandboxPath,
      toolDefs,
    });
    const result = await runProgrammaticCommand({
      cwd: sandboxPath,
      filePath: executionFilePath,
      timeoutMs,
      toolMap,
    });
    const generatedFiles = await collectGeneratedFiles({
      beforeState,
      sandboxPath,
      excludedFiles: new Set([PYTHON_WRAPPER_FILE]),
      excludedPathPrefixes: [PYTHON_CACHE_DIRECTORY, PYTHON_VENV_DIRECTORY],
    });

    if (result.timedOut) {
      throw new Error(`Execution timed out after ${Math.ceil(timeoutMs / 1000)} seconds.`);
    }

    if (result.exitCode !== 0) {
      const messageParts = [`Programmatic execution failed with exit code ${result.exitCode}.`];
      if (result.stdout.trim().length > 0) {
        messageParts.push(`stdout:\n${trimOutput(result.stdout.trim())}`);
      }
      if (result.stderr.trim().length > 0) {
        messageParts.push(`stderr:\n${trimOutput(result.stderr.trim())}`);
      }
      throw new Error(messageParts.join('\n\n'));
    }

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
      content: formatProgrammaticOutput({
        generatedFiles,
        installedPackages: result.installedPackages,
        stderr: result.stderr,
        stdout: result.stdout,
      }),
    };
  } catch (error) {
    await fs.rm(sandboxPath, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
};

export const createLocalProgrammaticToolCallingTool = ({
  loadInputs,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: CreateLocalProgrammaticToolCallingToolParams) =>
  tool(
    async ({ code, timeout }, config) => {
      const loadedInputs = (await loadInputs?.()) ?? { files: [] };
      const toolCall = (config.toolCall ?? {}) as {
        toolDefs?: LCTool[];
        toolMap?: ProgrammaticToolMap;
      };

      try {
        if (!toolCall.toolMap || toolCall.toolMap.size === 0) {
          throw new Error('No toolMap provided for local programmatic tool execution.');
        }

        if (!toolCall.toolDefs || toolCall.toolDefs.length === 0) {
          throw new Error('No tool definitions provided for local programmatic tool execution.');
        }

        const filteredToolDefs = filterToolsByUsage(toolCall.toolDefs, code);
        const result = await executeLocalProgrammaticCode({
          code,
          inputFiles: loadedInputs.files.map((file) => ({
            filename: file.filename,
            sourcePath: file.localPath,
          })),
          timeoutMs: typeof timeout === 'number' && timeout > 0 ? timeout : timeoutMs,
          toolDefs: filteredToolDefs,
          toolMap: toolCall.toolMap,
        });

        return [result.content, result.artifact];
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Programmatic execution failed: ${message}`);
      } finally {
        await loadedInputs.cleanup?.();
      }
    },
    {
      description: LocalProgrammaticToolCallingDefinition.description,
      name: ProgrammaticToolCallingDefinition.name,
      responseFormat: 'content_and_artifact',
      schema: LocalProgrammaticToolCallingSchema,
    },
  );
