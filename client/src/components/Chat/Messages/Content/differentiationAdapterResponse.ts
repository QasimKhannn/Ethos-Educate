type JsonValue = JsonObject | JsonValue[] | boolean | null | number | string;

type JsonObject = {
  [key: string]: JsonValue;
};

export type DifferentiationComparisonRow = {
  adapted: string;
  change: string;
  original: string;
};

export type AdaptedStudentCopy = {
  html?: string;
  plainText: string;
  title: string;
};

export type DifferentiationDownload = {
  filename: string;
  url: string;
};

export type DifferentiationAdapterResponse = {
  adaptedStudentCopy: AdaptedStudentCopy;
  comparisonRows: DifferentiationComparisonRow[];
  download?: DifferentiationDownload;
  learningObjective?: string;
  responseType: 'differentiation_adapter';
  teacherReviewFlags: string[];
};

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: JsonValue | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function parseComparisonRows(value: JsonValue | undefined): DifferentiationComparisonRow[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const rows: DifferentiationComparisonRow[] = [];
  for (const row of value) {
    if (!isJsonObject(row)) {
      return null;
    }

    const original = asNonEmptyString(row.original);
    const adapted = asNonEmptyString(row.adapted);
    const change = asNonEmptyString(row.change);
    if (!original || !adapted || !change) {
      return null;
    }

    rows.push({ original, adapted, change });
  }

  return rows;
}

function parseTeacherReviewFlags(value: JsonValue | undefined): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const flags: string[] = [];
  for (const flag of value) {
    const parsedFlag = asNonEmptyString(flag);
    if (!parsedFlag) {
      return null;
    }
    flags.push(parsedFlag);
  }

  return flags;
}

function parseDownload(value: JsonValue | undefined): DifferentiationDownload | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isJsonObject(value)) {
    return null;
  }

  const filename = asNonEmptyString(value.filename);
  const url = asNonEmptyString(value.url);
  return filename && url ? { filename, url } : null;
}

function getStructuredResponseText(value: string): string {
  const trimmedValue = value.trim();
  const fencedMatch = trimmedValue.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  return fencedMatch?.[1]?.trim() ?? trimmedValue;
}

export function parseDifferentiationAdapterResponse(
  value: string,
): DifferentiationAdapterResponse | null {
  try {
    const parsed: unknown = JSON.parse(getStructuredResponseText(value));
    if (!isJsonObject(parsed) || parsed.responseType !== 'differentiation_adapter') {
      return null;
    }

    if (!isJsonObject(parsed.adaptedStudentCopy)) {
      return null;
    }

    const title = asNonEmptyString(parsed.adaptedStudentCopy.title);
    const plainText = asNonEmptyString(parsed.adaptedStudentCopy.plainText);
    const html = asNonEmptyString(parsed.adaptedStudentCopy.html);
    const comparisonRows = parseComparisonRows(parsed.comparisonRows);
    const teacherReviewFlags = parseTeacherReviewFlags(parsed.teacherReviewFlags);
    const download = parseDownload(parsed.download);

    if (!title || !plainText || !comparisonRows || !teacherReviewFlags || download === null) {
      return null;
    }

    const learningObjective = asNonEmptyString(parsed.learningObjective) ?? undefined;
    return {
      adaptedStudentCopy: { title, plainText, ...(html ? { html } : {}) },
      comparisonRows,
      ...(download ? { download } : {}),
      ...(learningObjective ? { learningObjective } : {}),
      responseType: 'differentiation_adapter',
      teacherReviewFlags,
    };
  } catch {
    return null;
  }
}

export function getCompleteAdaptedStudentPlainText({
  title,
  plainText,
}: AdaptedStudentCopy): string {
  const normalizedPlainText = plainText.trim();
  const firstLine = normalizedPlainText.split(/\r?\n/, 1)[0]?.trim().toLocaleLowerCase();
  if (firstLine === title.trim().toLocaleLowerCase()) {
    return normalizedPlainText;
  }

  return `${title.trim()}\n\n${normalizedPlainText}`;
}

export function escapeStudentCopyHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function createStudentCopyHtml(studentCopy: AdaptedStudentCopy): string {
  if (studentCopy.html?.trim()) {
    return studentCopy.html;
  }

  return studentCopy.plainText
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeStudentCopyHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
}
