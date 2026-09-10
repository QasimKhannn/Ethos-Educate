import { Constants } from 'librechat-data-provider';

export const mcpToolPattern = new RegExp(`^.+${Constants.mcp_delimiter}.+$`);

const knownMCPServerNames = new Map<string, string>([['websearch', 'websearch']]);

/** Creates a stable MCP server identifier that is independent of display-name punctuation. */
export function canonicalizeMCPServerName(serverName: string): string {
  return serverName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Resolves legacy spellings to the exact configured identifier used by known MCP servers. */
export function resolveKnownMCPServerName(serverName: string): string {
  return knownMCPServerNames.get(canonicalizeMCPServerName(serverName)) ?? serverName;
}

/** Rewrites only the server suffix of an MCP tool identifier. */
export function normalizeKnownMCPToolId(toolId: string): string {
  const delimiterIndex = toolId.lastIndexOf(Constants.mcp_delimiter);
  if (delimiterIndex < 0) {
    return toolId;
  }

  const serverNameIndex = delimiterIndex + Constants.mcp_delimiter.length;
  const serverName = toolId.slice(serverNameIndex);
  const resolvedServerName = resolveKnownMCPServerName(serverName);
  return `${toolId.slice(0, serverNameIndex)}${resolvedServerName}`;
}

/** Normalizes and de-duplicates MCP tool identifiers while preserving their selection order. */
export function normalizeKnownMCPToolIds(
  toolIds: Array<string | null | undefined> | undefined,
): Array<string | null | undefined> | undefined {
  if (!toolIds) {
    return undefined;
  }

  const normalizedToolIds: Array<string | null | undefined> = [];
  const seenToolIds = new Set<string>();
  const migratedToolIds = new Set<string>();
  for (const toolId of toolIds) {
    if (typeof toolId !== 'string') {
      normalizedToolIds.push(toolId);
      continue;
    }

    const normalizedToolId = normalizeKnownMCPToolId(toolId);
    const isMigrated = normalizedToolId !== toolId;
    if (
      (isMigrated && seenToolIds.has(normalizedToolId)) ||
      migratedToolIds.has(normalizedToolId)
    ) {
      continue;
    }

    normalizedToolIds.push(normalizedToolId);
    seenToolIds.add(normalizedToolId);
    if (isMigrated) {
      migratedToolIds.add(normalizedToolId);
    }
  }
  return normalizedToolIds;
}

/** Normalizes and de-duplicates persisted MCP server names. */
export function normalizeKnownMCPServerNames(
  serverNames: string[] | undefined,
): string[] | undefined {
  if (!serverNames) {
    return undefined;
  }

  const normalizedServerNames = new Set<string>();
  for (const serverName of serverNames) {
    normalizedServerNames.add(resolveKnownMCPServerName(serverName));
  }
  return Array.from(normalizedServerNames);
}

/** Normalizes MCP tool-option keys and gives an already-canonical key precedence on collision. */
export function normalizeKnownMCPToolOptions<T>(
  toolOptions: Record<string, T> | undefined,
): Record<string, T> | undefined {
  if (!toolOptions) {
    return undefined;
  }

  const normalizedEntries = new Map<string, { isCanonical: boolean; value: T }>();
  for (const [toolId, value] of Object.entries(toolOptions)) {
    const normalizedToolId = normalizeKnownMCPToolId(toolId);
    const isCanonical = normalizedToolId === toolId;
    const currentEntry = normalizedEntries.get(normalizedToolId);
    if (!currentEntry || (isCanonical && !currentEntry.isCanonical)) {
      normalizedEntries.set(normalizedToolId, { isCanonical, value });
    }
  }

  return Object.fromEntries(
    Array.from(normalizedEntries, ([toolId, entry]) => [toolId, entry.value]),
  );
}

/** Compares MCP server names without relying on casing, spaces, hyphens, or underscores. */
export function isMCPServerName(serverName: string, expectedServerName: string): boolean {
  const canonicalServerName = canonicalizeMCPServerName(serverName);
  return (
    canonicalServerName.length > 0 &&
    canonicalServerName === canonicalizeMCPServerName(expectedServerName)
  );
}

/** Matches an MCP tool to its server using the server suffix embedded in the tool name. */
export function isMCPToolFromServer(toolName: string, expectedServerName: string): boolean {
  const delimiterIndex = toolName.lastIndexOf(Constants.mcp_delimiter);
  if (delimiterIndex < 1) {
    return false;
  }

  const serverName = toolName.slice(delimiterIndex + Constants.mcp_delimiter.length);
  return isMCPServerName(serverName, expectedServerName);
}

/**
 * Normalizes a server name to match the pattern ^[a-zA-Z0-9_.-]+$
 * This is required for Azure OpenAI models with Tool Calling
 */
export function normalizeServerName(serverName: string): string {
  // Check if the server name already matches the pattern
  if (/^[a-zA-Z0-9_.-]+$/.test(serverName)) {
    return serverName;
  }

  /** Replace non-matching characters with underscores.
    This preserves the general structure while ensuring compatibility.
    Trims leading/trailing underscores
    */
  const normalized = serverName.replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/^_+|_+$/g, '');

  // If the result is empty (e.g., all characters were non-ASCII and got trimmed),
  // generate a fallback name to ensure we always have a valid function name
  if (!normalized) {
    /** Hash of the original name to ensure uniqueness */
    let hash = 0;
    for (let i = 0; i < serverName.length; i++) {
      hash = (hash << 5) - hash + serverName.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return `server_${Math.abs(hash)}`;
  }

  return normalized;
}

/**
 * Sanitizes a URL by removing query parameters to prevent credential leakage in logs.
 * @param url - The URL to sanitize (string or URL object)
 * @returns The sanitized URL string without query parameters
 */
export function sanitizeUrlForLogging(url: string | URL): string {
  try {
    const urlObj = typeof url === 'string' ? new URL(url) : url;
    return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
  } catch {
    return '[invalid URL]';
  }
}

/**
 * Escapes special regex characters in a string so they are treated literally.
 * @param str - The string to escape
 * @returns The escaped string safe for use in a regex pattern
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generates a URL-friendly server name from a title.
 * Converts to lowercase, replaces spaces with hyphens, removes special characters.
 * @param title - The display title to convert
 * @returns A slug suitable for use as serverName (e.g., "GitHub MCP Tool" → "github-mcp-tool")
 */
export function generateServerNameFromTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Remove consecutive hyphens
    .replace(/^-|-$/g, ''); // Trim leading/trailing hyphens

  return slug || 'mcp-server'; // Fallback if empty
}
