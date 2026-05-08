const ERROR_CODES = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INVALID_INPUT: 'INVALID_INPUT',
  NOT_FOUND: 'NOT_FOUND',
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  REQUEST_FAILED: 'REQUEST_FAILED',
};

const DEFAULT_ERROR_CONFIG = {
  [ERROR_CODES.AUTH_REQUIRED]: {
    status: 401,
    message: 'Your connection has expired or needs to be signed in again.',
    action: 'Reconnect your account and try again.',
  },
  [ERROR_CODES.PERMISSION_DENIED]: {
    status: 403,
    message: "You don't have access to do that.",
    action: 'Check your access or ask an administrator for help.',
  },
  [ERROR_CODES.INVALID_INPUT]: {
    status: 400,
    message: 'Some information for this request is missing or invalid.',
    action: 'Review the details and try again.',
  },
  [ERROR_CODES.NOT_FOUND]: {
    status: 404,
    message: "We couldn't find what you asked for.",
    action: 'Check the name or ID and try again.',
  },
  [ERROR_CODES.REQUEST_TIMEOUT]: {
    status: 504,
    message: 'This request took too long to finish.',
    action: 'Please try again in a moment.',
  },
  [ERROR_CODES.SERVICE_UNAVAILABLE]: {
    status: 503,
    message: 'The connected service is unavailable right now.',
    action: 'Please wait a moment and try again.',
  },
  [ERROR_CODES.REQUEST_FAILED]: {
    status: 500,
    message: "We couldn't complete your request.",
    action: 'Please try again. If it keeps happening, contact support.',
  },
};

const AUTH_PATTERNS = [
  '401',
  'auth failed',
  'authentication',
  'authorization',
  'login again',
  'log in again',
  'oauth',
  'sign in',
  'token expired',
  'unauthorized',
];
const PERMISSION_PATTERNS = [
  '403',
  'access denied',
  'forbidden',
  'insufficient permissions',
  'missing scopes',
  'not allowed',
  'permission denied',
  'user mismatch',
];
const INVALID_INPUT_PATTERNS = [
  '400',
  'bad request',
  'invalid',
  'malformed',
  'message id required',
  'missing',
  'required',
  'validation',
  'zod',
];
const NOT_FOUND_PATTERNS = [
  '404',
  "couldn't find",
  'does not exist',
  'missing conversation',
  'no active flow',
  'not completed',
  'not found',
];
const TIMEOUT_PATTERNS = [
  '408',
  '504',
  'aborted',
  'deadline exceeded',
  'etimedout',
  'timed out',
  'timeout',
];
const SERVICE_PATTERNS = [
  '502',
  '503',
  'connect',
  'connection reset',
  'econnreset',
  'enotfound',
  'external service',
  'failed to fetch',
  'network',
  'service unavailable',
  'temporarily unavailable',
  'upstream',
];

function getErrorMessage(error) {
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message || '';
  }
  if (error && typeof error === 'object' && typeof error.message === 'string') {
    return error.message;
  }
  return '';
}

function includesPattern(message, patterns) {
  const normalizedMessage = message.toLowerCase();
  return patterns.some((pattern) => normalizedMessage.includes(pattern));
}

function inferErrorCode(error, fallbackCode = ERROR_CODES.REQUEST_FAILED) {
  let statusCode;
  if (typeof error?.statusCode === 'number') {
    statusCode = error.statusCode;
  } else if (typeof error?.status === 'number') {
    statusCode = error.status;
  }
  const message = getErrorMessage(error);

  if (statusCode === 401 || includesPattern(message, AUTH_PATTERNS)) {
    return ERROR_CODES.AUTH_REQUIRED;
  }
  if (statusCode === 403 || includesPattern(message, PERMISSION_PATTERNS)) {
    return ERROR_CODES.PERMISSION_DENIED;
  }
  if (statusCode === 400 || includesPattern(message, INVALID_INPUT_PATTERNS)) {
    return ERROR_CODES.INVALID_INPUT;
  }
  if (statusCode === 404 || includesPattern(message, NOT_FOUND_PATTERNS)) {
    return ERROR_CODES.NOT_FOUND;
  }
  if (statusCode === 408 || statusCode === 504 || includesPattern(message, TIMEOUT_PATTERNS)) {
    return ERROR_CODES.REQUEST_TIMEOUT;
  }
  if (statusCode === 502 || statusCode === 503 || includesPattern(message, SERVICE_PATTERNS)) {
    return ERROR_CODES.SERVICE_UNAVAILABLE;
  }

  return fallbackCode;
}

function createErrorPayload(error, options = {}) {
  const code = options.code ?? inferErrorCode(error, options.fallbackCode);
  const defaults = DEFAULT_ERROR_CONFIG[code] ?? DEFAULT_ERROR_CONFIG[ERROR_CODES.REQUEST_FAILED];
  const message = options.message ?? defaults.message;
  const action = options.action ?? defaults.action;
  const status = options.status ?? defaults.status;

  return {
    success: false,
    status,
    code,
    message,
    action,
    error: message,
  };
}

function createUserErrorText(error, options = {}) {
  const payload = createErrorPayload(error, options);
  return `${payload.message} ${payload.action}`.trim();
}

function createToolErrorOutput(error, options = {}) {
  return `Error: ${createUserErrorText(error, options)}`;
}

function sendErrorResponse(res, error, options = {}) {
  const payload = createErrorPayload(error, options);
  return res.status(payload.status).json({
    code: payload.code,
    message: payload.message,
    action: payload.action,
    error: payload.error,
    success: false,
  });
}

module.exports = {
  ERROR_CODES,
  createErrorPayload,
  createToolErrorOutput,
  createUserErrorText,
  inferErrorCode,
  sendErrorResponse,
};
