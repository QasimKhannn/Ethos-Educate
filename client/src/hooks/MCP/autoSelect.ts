import type { MCPServersListResponse } from 'librechat-data-provider';

const MIN_TOKEN_LENGTH = 4;
const MIN_DESCRIPTION_TOKEN_LENGTH = 6;
const MAX_COMPOUND_WORDS = 4;

const IGNORED_TOKENS = new Set([
  '365',
  'api',
  'app',
  'apps',
  'build',
  'create',
  'created',
  'creating',
  'connector',
  'connectors',
  'convert',
  'converted',
  'converting',
  'data',
  'doc',
  'docs',
  'document',
  'documents',
  'drive',
  'file',
  'files',
  'find',
  'generate',
  'generated',
  'generating',
  'get',
  'google',
  'integration',
  'list',
  'make',
  'making',
  'mcp',
  'microsoft',
  'office',
  'read',
  'reading',
  'run',
  'search',
  'server',
  'service',
  'tool',
  'tools',
  'turn',
  'use',
  'write',
  'writing',
  'workspace',
]);

type PromptIndex = {
  compact: string;
  padded: string;
  words: Set<string>;
};

type AutoSelectParams = {
  prompt: string;
  servers?: MCPServersListResponse | null;
  selectedServers?: string[];
};

const normalizeText = (value: string): string =>
  value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const getWords = (value: string): string[] => {
  const normalized = normalizeText(value);
  return normalized.length === 0 ? [] : normalized.split(/\s+/);
};

const createPromptIndex = (prompt: string): PromptIndex => {
  const words = getWords(prompt);
  const normalized = words.join(' ');
  return {
    compact: words.join(''),
    padded: ` ${normalized} `,
    words: new Set(words),
  };
};

const isMeaningfulToken = (token: string, minLength: number): boolean =>
  token.length >= minLength && !IGNORED_TOKENS.has(token) && !/^\d+$/.test(token);

const isMeaningfulPhrase = (words: string[]): boolean =>
  words.length > 1 && words.some((word) => isMeaningfulToken(word, MIN_TOKEN_LENGTH));

const collectCompoundAliases = (words: string[], minTokenLength: number, aliases: Set<string>) => {
  for (let start = 0; start < words.length - 1; start++) {
    let compact = words[start];
    const endLimit = Math.min(words.length, start + MAX_COMPOUND_WORDS);

    for (let end = start + 1; end < endLimit; end++) {
      compact += words[end];
      if (isMeaningfulToken(compact, minTokenLength)) {
        aliases.add(compact);
      }
    }
  }
};

const collectAliases = (
  value: string | undefined,
  minTokenLength: number,
  includeCompoundAliases = false,
): string[] => {
  if (!value) {
    return [];
  }

  const words = getWords(value);
  if (words.length === 0) {
    return [];
  }

  const aliases = new Set<string>();
  if (isMeaningfulPhrase(words)) {
    aliases.add(words.join(' '));
  }

  const compact = words.join('');
  if (isMeaningfulToken(compact, minTokenLength)) {
    aliases.add(compact);
  }

  for (const word of words) {
    if (isMeaningfulToken(word, minTokenLength)) {
      aliases.add(word);
    }
  }

  if (includeCompoundAliases) {
    collectCompoundAliases(words, minTokenLength, aliases);
  }

  return [...aliases];
};

const collectDescriptionAliases = (value: string | undefined): string[] => {
  const aliases = new Set(collectAliases(value, MIN_DESCRIPTION_TOKEN_LENGTH));
  const words = value ? getWords(value) : [];

  for (let start = 0; start < words.length - 1; start++) {
    let compact = words[start];
    let includesIgnoredWord = IGNORED_TOKENS.has(words[start]);
    const endLimit = Math.min(words.length, start + MAX_COMPOUND_WORDS);

    for (let end = start + 1; end < endLimit; end++) {
      compact += words[end];
      includesIgnoredWord ||= IGNORED_TOKENS.has(words[end]);

      if (!includesIgnoredWord && isMeaningfulToken(compact, MIN_DESCRIPTION_TOKEN_LENGTH)) {
        aliases.add(compact);
      }
    }
  }

  return [...aliases];
};

const promptContainsAlias = (prompt: PromptIndex, alias: string): boolean => {
  if (alias.includes(' ')) {
    return prompt.padded.includes(` ${alias} `);
  }

  return prompt.words.has(alias) || (alias.length >= 6 && prompt.compact.includes(alias));
};

const serverMatchesPrompt = (
  prompt: PromptIndex,
  serverName: string,
  server: MCPServersListResponse[string],
): boolean => {
  const identityAliases = [
    ...collectAliases(serverName, MIN_TOKEN_LENGTH, true),
    ...collectAliases(server.title, MIN_TOKEN_LENGTH, true),
  ];

  for (const alias of identityAliases) {
    if (promptContainsAlias(prompt, alias)) {
      return true;
    }
  }

  const descriptionAliases = collectDescriptionAliases(server.description);
  for (const alias of descriptionAliases) {
    if (promptContainsAlias(prompt, alias)) {
      return true;
    }
  }

  return false;
};

const requiresUserAuthentication = (server: MCPServersListResponse[string]): boolean =>
  server.requiresOAuth === true ||
  server.apiKey?.source === 'user' ||
  Object.keys(server.customUserVars ?? {}).length > 0;

export const getAutoSelectedMCPServerNames = ({
  prompt,
  servers,
  selectedServers = [],
}: AutoSelectParams): string[] => {
  if (!servers || prompt.trim().length === 0) {
    return [];
  }

  const selected = new Set(selectedServers);
  const promptIndex = createPromptIndex(prompt);
  const matches: string[] = [];

  for (const [serverName, server] of Object.entries(servers)) {
    if (
      server.chatMenu === false ||
      server.consumeOnly ||
      requiresUserAuthentication(server) ||
      selected.has(serverName)
    ) {
      continue;
    }

    if (serverMatchesPrompt(promptIndex, serverName, server)) {
      matches.push(serverName);
    }
  }

  return matches;
};
