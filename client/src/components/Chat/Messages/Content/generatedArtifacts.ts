import { ContentTypes } from 'librechat-data-provider';
import type { TMessageContentParts } from 'librechat-data-provider';

export type GeneratedArtifactExpiries = ReadonlyMap<string, Date>;

export type GeneratedDocumentState = Readonly<{
  expiries: GeneratedArtifactExpiries;
  toolCallFileIds: ReadonlySet<string>;
}>;

export type GeneratedDocumentLink = Readonly<{
  filename: string;
  href: string;
  fileId: string;
}>;

export type GeneratedDocumentLinksByExpiry = Readonly<{
  available: GeneratedDocumentLink[];
  expired: GeneratedDocumentLink[];
}>;

const MANAGED_DOCUMENT_LINK_PATTERN = /\/api\/files\/download\/[^/?#\s)"']+\/([^/?#\s)"']+)/g;
const MANAGED_DOCUMENT_MARKDOWN_LINK_PATTERN =
  /\[([^\]\r\n]+)\]\((\/api\/files\/download\/[^/?#\s)"']+\/([^/?#\s)"']+))\)/g;
const AVAILABILITY_PATTERN =
  /Available until\s+(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:\s*UTC|Z)?)/i;
const EXPIRY_MARKER_PATTERN = /<!--\s*ethos-generated-document-expiry\s+({[\s\S]*?})\s*-->/gi;

type ExpiryMarker = {
  expiresAt?: string;
  fileId?: string;
};

type SerializedTextContent = {
  type?: string;
  text?: string;
};

function getSerializedTextContent(value: string): string | null {
  try {
    const parsed = JSON.parse(value) as SerializedTextContent[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return null;
    }

    const text = parsed
      .filter((part) => part != null && part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text as string)
      .join('\n\n');
    return text || null;
  } catch {
    return null;
  }
}

/** Makes legacy Azure MCP content arrays readable in tool details and artifact rendering. */
export function getGeneratedArtifactDisplayText(value: string): string {
  return getSerializedTextContent(value) ?? value;
}

function getPartText(part: TMessageContentParts): string | null {
  if (part.type === ContentTypes.TEXT) {
    if (typeof part.text === 'string') {
      return part.text;
    }

    return part.text?.value ?? null;
  }

  if (part.type !== ContentTypes.TOOL_CALL) {
    return null;
  }

  const toolCall = part[ContentTypes.TOOL_CALL];
  return toolCall != null && 'output' in toolCall && typeof toolCall.output === 'string'
    ? getGeneratedArtifactDisplayText(toolCall.output)
    : null;
}

function parseExpiry(value: string): Date | null {
  const normalized = value
    .trim()
    .replace(/\s+UTC$/i, 'Z')
    .replace(' ', 'T');
  const timestamp = Date.parse(normalized.endsWith('Z') ? normalized : `${normalized}Z`);
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

function addExpiryMarker(expiries: Map<string, Date>, value: string): void {
  let marker: ExpiryMarker;
  try {
    marker = JSON.parse(value) as ExpiryMarker;
  } catch {
    return;
  }

  if (typeof marker.fileId !== 'string' || typeof marker.expiresAt !== 'string') {
    return;
  }

  const expiresAt = parseExpiry(marker.expiresAt);
  if (expiresAt) {
    expiries.set(marker.fileId, expiresAt);
  }
}

export function isGeneratedArtifactExpired(expiresAt?: string | Date, now = Date.now()): boolean {
  if (!expiresAt) {
    return false;
  }

  const timestamp = new Date(expiresAt).getTime();
  return Number.isFinite(timestamp) && timestamp <= now;
}

/** Extracts safe, managed document links from a tool result for direct UI rendering. */
export function getGeneratedDocumentLinks(
  output: string | null | undefined,
): GeneratedDocumentLink[] {
  if (!output) {
    return [];
  }

  const normalizedOutput = getGeneratedArtifactDisplayText(output);
  const documents = new Map<string, GeneratedDocumentLink>();
  for (const match of normalizedOutput.matchAll(MANAGED_DOCUMENT_MARKDOWN_LINK_PATTERN)) {
    const filename = match[1]?.trim();
    const href = match[2];
    const encodedFileId = match[3];
    if (!filename || !href || !encodedFileId) {
      continue;
    }

    try {
      const fileId = decodeURIComponent(encodedFileId);
      documents.set(fileId, { filename, href, fileId });
    } catch {
      continue;
    }
  }

  return [...documents.values()];
}

/** Separates a tool result's managed downloads into the two states displayed in chat. */
export function splitGeneratedDocumentLinksByExpiry(
  documents: readonly GeneratedDocumentLink[],
  expiries: GeneratedArtifactExpiries | undefined,
  now = Date.now(),
): GeneratedDocumentLinksByExpiry {
  const available: GeneratedDocumentLink[] = [];
  const expired: GeneratedDocumentLink[] = [];

  for (const document of documents) {
    if (isGeneratedArtifactExpired(expiries?.get(document.fileId), now)) {
      expired.push(document);
      continue;
    }

    available.push(document);
  }

  return { available, expired };
}

/**
 * Generated document links are retained in prior chat messages alongside their
 * "Available until" notice. Reading that persisted message data lets expired
 * documents render cleanly even after the underlying blob and file record are removed.
 */
export function getGeneratedDocumentState(
  content: Array<TMessageContentParts | undefined> | undefined,
): GeneratedDocumentState {
  const expiries = new Map<string, Date>();
  const toolCallFileIds = new Set<string>();

  for (const part of content ?? []) {
    if (!part) {
      continue;
    }

    const text = getPartText(part);
    if (!text) {
      continue;
    }

    if (part.type === ContentTypes.TOOL_CALL) {
      for (const document of getGeneratedDocumentLinks(text)) {
        toolCallFileIds.add(document.fileId);
      }
    }

    for (const marker of text.matchAll(EXPIRY_MARKER_PATTERN)) {
      if (marker[1]) {
        addExpiryMarker(expiries, marker[1]);
      }
    }

    const availability = text.match(AVAILABILITY_PATTERN);
    const expiresAt = availability?.[1] ? parseExpiry(availability[1]) : null;
    if (!expiresAt) {
      continue;
    }

    for (const match of text.matchAll(MANAGED_DOCUMENT_LINK_PATTERN)) {
      const fileId = match[1] ? decodeURIComponent(match[1]) : '';
      if (fileId) {
        expiries.set(fileId, expiresAt);
      }
    }
  }

  return { expiries, toolCallFileIds };
}

export function getGeneratedDocumentExpiries(
  content: Array<TMessageContentParts | undefined> | undefined,
): GeneratedArtifactExpiries {
  return getGeneratedDocumentState(content).expiries;
}
