import type {
  ToolStatus,
  RubricSummary,
  ExtractedDocument,
  GradingMode,
  GradingResponse,
  GradingRequestBody,
  EssayGraderApiErrorBody,
} from './types';

const DEFAULT_COGRADER_API_BASE_URL = 'http://localhost:4000/api';

const configuredBaseUrl = import.meta.env.VITE_COGRADER_API_BASE_URL?.trim();
const cograderApiBaseUrl = (configuredBaseUrl || DEFAULT_COGRADER_API_BASE_URL).replace(/\/+$/, '');

export class EssayGraderApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string>;

  constructor(message: string, status: number, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = 'EssayGraderApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: GradingRequestBody;
}

const normalizeApiPath = (path: string) => `${cograderApiBaseUrl}${path}`;

const readJson = async <T>(response: Response): Promise<T | null> => {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const { method = 'GET', body } = options;

  let response: Response;
  try {
    response = await fetch(normalizeApiPath(path), {
      method,
      credentials: 'include',
      cache: 'no-store',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new EssayGraderApiError(
      'Cannot reach the grading service. Check that the co-grader backend is running on port 4000.',
      0,
    );
  }

  const payload = await readJson<T | EssayGraderApiErrorBody>(response);
  if (!response.ok) {
    const error = (payload ?? {}) as EssayGraderApiErrorBody;
    throw new EssayGraderApiError(
      error.message ?? `Request failed (${response.status}).`,
      response.status,
      error.fieldErrors,
    );
  }

  return payload as T;
};

/**
 * @param jurisdiction  A state code such as `US-CA`, or the literal `general`
 *   for rubrics that belong to no state. Omitted returns everything published
 *   — every state's rubrics at once, which is why the picker defaults to
 *   `general` rather than calling this with no argument.
 */
export const listRubrics = (jurisdiction?: string) => {
  const query = jurisdiction ? `?jurisdiction=${encodeURIComponent(jurisdiction)}` : '';
  return request<RubricSummary[]>(`/public/rubrics${query}`);
};

export const fetchToolStatus = () => request<ToolStatus>('/public/gradings/status');

export const submitForGrading = (body: GradingRequestBody) =>
  request<GradingResponse>('/public/gradings', { method: 'POST', body });

/**
 * Read an existing submission in another mode.
 *
 * POST, not GET, because a mode that has not been run yet is a model call
 * that spends the visitor's allowance. A cached mode (see
 * `GradingResponse.availableModes`) returns immediately and costs nothing.
 */
export const runGradingMode = (id: string, mode: GradingMode) =>
  request<GradingResponse>(
    `/public/gradings/${encodeURIComponent(id)}/modes/${encodeURIComponent(mode)}`,
    { method: 'POST' },
  );

export const extractDocument = async (file: File): Promise<ExtractedDocument> => {
  const formData = new FormData();
  formData.append('file', file);

  let response: Response;
  try {
    response = await fetch(normalizeApiPath('/public/extract'), {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      body: formData,
    });
  } catch {
    throw new EssayGraderApiError(
      'Cannot reach the grading service. Check that the co-grader backend is running on port 4000.',
      0,
    );
  }

  const payload = await readJson<ExtractedDocument | EssayGraderApiErrorBody>(response);
  if (!response.ok) {
    const error = (payload ?? {}) as EssayGraderApiErrorBody;
    const message =
      response.status === 413 || /file too large/i.test(error.message ?? '')
        ? 'That file is too large. The limit is 10 MB.'
        : (error.message ?? `Upload failed (${response.status}).`);

    throw new EssayGraderApiError(message, response.status, error.fieldErrors);
  }

  return payload as ExtractedDocument;
};
