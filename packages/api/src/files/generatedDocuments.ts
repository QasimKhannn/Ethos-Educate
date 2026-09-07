import {
  DEFAULT_GENERATED_FILE_RETENTION_MINUTES,
  formatGeneratedFileRetentionDuration,
  getGeneratedFileRetentionExpiry,
} from './generatedFileRetention';

export const GENERATED_DOCUMENT_RETENTION_HOURS = DEFAULT_GENERATED_FILE_RETENTION_MINUTES / 60;
export const GENERATED_DOCUMENT_RETENTION_DAYS = GENERATED_DOCUMENT_RETENTION_HOURS / 24;

const GENERATED_DOCUMENT_MARKER = 'ethos-generated-document';
const GENERATED_DOCUMENT_RETENTION_NOTICE =
  /This document expires after [^.]+ and will be deleted\./gi;
const MARKER_PATTERN = new RegExp(
  `<!--\\s*${GENERATED_DOCUMENT_MARKER}\\s+({[\\s\\S]*?})\\s*-->`,
  'gi',
);

export type GeneratedDocumentArtifact = {
  filename: string;
  mimeType: string;
  sourceUrl: string;
};

type GeneratedDocumentMarker = {
  filename?: string;
  mimeType?: string;
  url?: string;
};

export type GeneratedDocumentExtraction = {
  documents: GeneratedDocumentArtifact[];
  text: string;
};

function normalizeFilename(value: string): string | null {
  const filename = value
    .trim()
    .replace(/[\\/]+/g, '_')
    .replace(/[\r\n\0]/g, '');
  return filename.length > 0 ? filename : null;
}

function parseMarker(value: string): GeneratedDocumentArtifact | null {
  let marker: GeneratedDocumentMarker;
  try {
    marker = JSON.parse(value) as GeneratedDocumentMarker;
  } catch {
    return null;
  }

  if (typeof marker.url !== 'string' || typeof marker.filename !== 'string') {
    return null;
  }

  const filename = normalizeFilename(marker.filename);
  if (!filename) {
    return null;
  }

  try {
    const sourceUrl = new URL(marker.url);
    if (sourceUrl.protocol !== 'http:' && sourceUrl.protocol !== 'https:') {
      return null;
    }

    return {
      filename,
      mimeType:
        typeof marker.mimeType === 'string' && marker.mimeType.trim().length > 0
          ? marker.mimeType.trim()
          : 'application/octet-stream',
      sourceUrl: sourceUrl.toString(),
    };
  } catch {
    return null;
  }
}

function removeSourceDocumentLink(text: string, sourceUrl: string): string {
  const escapedUrl = sourceUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const linePattern = new RegExp(`^.*\\[[^\\]\\r\\n]+\\]\\(${escapedUrl}\\).*(?:\\r?\\n|$)`, 'gm');
  return text.replace(linePattern, '');
}

function normalizeText(value: string): string {
  return value.replace(/\n{3,}/g, '\n\n').trim();
}

function removeGeneratedDocumentRetentionNotice(value: string): string {
  return value.replace(GENERATED_DOCUMENT_RETENTION_NOTICE, '');
}

export function extractGeneratedDocumentArtifacts(content: string): GeneratedDocumentExtraction {
  const documents: GeneratedDocumentArtifact[] = [];
  let text = content;

  for (const match of content.matchAll(MARKER_PATTERN)) {
    const artifact = parseMarker(match[1]);
    text = text.replace(match[0], '');
    if (!artifact) {
      continue;
    }

    documents.push(artifact);
    text = removeSourceDocumentLink(text, artifact.sourceUrl);
  }

  return { documents, text: normalizeText(removeGeneratedDocumentRetentionNotice(text)) };
}

export function getGeneratedDocumentRetentionExpiry(now: number = Date.now()): Date {
  return getGeneratedFileRetentionExpiry(now);
}

export function formatGeneratedDocumentExpiry(date: Date): string {
  return `${date
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, ' UTC')}`;
}

export function buildManagedDocumentText({
  sourceText,
  documents,
  expiresAt,
}: {
  sourceText: string;
  documents: Array<{ downloadPath: string; fileId: string; filename: string }>;
  expiresAt: Date;
}): string {
  const documentLinks = documents
    .map(
      ({ downloadPath, fileId, filename }) =>
        `[${filename}](${downloadPath})\n<!-- ethos-generated-document-expiry ${JSON.stringify({
          expiresAt: expiresAt.toISOString(),
          fileId,
        })} -->`,
    )
    .join('\n');
  const availability = `Available until ${formatGeneratedDocumentExpiry(expiresAt)}. This document expires after ${formatGeneratedFileRetentionDuration()} and will be deleted. After expiry, generate a new copy.`;

  return [sourceText, documentLinks, availability].filter(Boolean).join('\n\n');
}
