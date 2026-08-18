import type {
  ToolStatus,
  RubricSummary,
  ExtractedDocument,
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

export const listRubrics = () => request<RubricSummary[]>('/public/rubrics');

export const fetchToolStatus = () => request<ToolStatus>('/public/gradings/status');

export const submitForGrading = (body: GradingRequestBody) =>
  request<GradingResponse>('/public/gradings', { method: 'POST', body });

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
