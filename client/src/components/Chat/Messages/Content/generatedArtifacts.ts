import { ContentTypes } from 'librechat-data-provider';
import type { TMessageContentParts } from 'librechat-data-provider';

export type GeneratedArtifactExpiries = ReadonlyMap<string, Date>;

export type GeneratedDocumentLink = Readonly<{
  filename: string;
  href: string;
  fileId: string;
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
    ? toolCall.output
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

  const documents = new Map<string, GeneratedDocumentLink>();
  for (const match of output.matchAll(MANAGED_DOCUMENT_MARKDOWN_LINK_PATTERN)) {
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

/**
 * Generated document links are retained in prior chat messages alongside their
 * "Available until" notice. Reading that persisted message data lets expired
 * documents render cleanly even after the underlying blob and file record are removed.
 */
export function getGeneratedDocumentExpiries(
  content: Array<TMessageContentParts | undefined> | undefined,
): GeneratedArtifactExpiries {
  const expiries = new Map<string, Date>();

  for (const part of content ?? []) {
    if (!part) {
      continue;
    }

    const text = getPartText(part);
    if (!text) {
      continue;
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

  return expiries;
}
