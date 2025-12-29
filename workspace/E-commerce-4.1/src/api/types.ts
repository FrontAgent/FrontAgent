export interface ApiError {
  name: string;
  message: string;
  statusCode: number;
  details?: unknown;
  requestId?: string;
  cause?: unknown;
}

export class ApiErrorImpl extends Error implements ApiError {
  public statusCode: number;
  public details?: unknown;
  public requestId?: string;
  public override cause?: unknown;

  constructor(params: ApiError) {
    super(params.message);
    this.name = params.name || 'ApiError';
    this.statusCode = params.statusCode;
    this.details = params.details;
    this.requestId = params.requestId;
    this.cause = params.cause;

    if (typeof (Error as any).captureStackTrace === 'function') {
      (Error as any).captureStackTrace(this, ApiErrorImpl);
    }
  }
}

export type ApiResponse<T> = {
  data?: T;
  meta?: unknown;
  error?: unknown;
} & Record<string, unknown>;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

const toStatusCode = (v: unknown, fallback = 0): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
};

const getFirstString = (...vals: unknown[]): string | undefined => {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim() !== '') return v;
  }
  return undefined;
};

export const isApiError = (e: unknown): e is ApiError => {
  if (!isRecord(e)) return false;

  const nameOk = typeof e.name === 'string' && e.name.trim() !== '';
  const messageOk = typeof e.message === 'string';
  const statusOk = typeof e.statusCode === 'number' && Number.isFinite(e.statusCode);

  return nameOk && messageOk && statusOk;
};

export const normalizeError = (e: unknown): ApiError => {
  if (isApiError(e)) return e;

  if (e instanceof ApiErrorImpl) {
    return {
      name: e.name,
      message: e.message,
      statusCode: e.statusCode,
      details: e.details,
      requestId: e.requestId,
      cause: e.cause
    };
  }

  if (e instanceof Error) {
    const anyErr = e as unknown as Record<string, unknown>;
    const statusCode = toStatusCode(
      (anyErr.statusCode as unknown) ??
        (anyErr.status as unknown) ??
        (anyErr.code as unknown) ??
        (anyErr.responseStatus as unknown),
      0
    );

    const requestId = getFirstString(
      anyErr.requestId,
      anyErr.requestID,
      anyErr['x-request-id'],
      anyErr['xRequestId']
    );

    const details =
      anyErr.details ??
      anyErr.detail ??
      anyErr.data ??
      anyErr.response ??
      anyErr.payload ??
      undefined;

    const cause = (e as any).cause;

    return {
      name: typeof e.name === 'string' && e.name ? e.name : 'Error',
      message: typeof e.message === 'string' ? e.message : 'Unknown error',
      statusCode,
      details,
      requestId,
      cause
    };
  }

  if (typeof e === 'string') {
    return {
      name: 'ApiError',
      message: e,
      statusCode: 0
    };
  }

  if (isRecord(e)) {
    const statusCode = toStatusCode(
      e.statusCode ?? e.status ?? e.code ?? e.responseStatus,
      0
    );

    const message =
      getFirstString(
        e.message,
        e.error_description,
        e.errorDescription,
        e.error_message,
        e.errorMessage,
        e.title
      ) ?? 'Unknown error';

    const name =
      getFirstString(e.name, e.error, e.type) ??
      (statusCode ? 'ApiError' : 'UnknownError');

    const requestId = getFirstString(
      e.requestId,
      (e as any).requestID,
      e['x-request-id'],
      (e as any).xRequestId
    );

    const details =
      e.details ??
      e.detail ??
      e.errors ??
      e.issues ??
      e.meta ??
      e.data ??
      e.payload ??
      undefined;

    return {
      name,
      message,
      statusCode,
      details,
      requestId,
      cause: undefined
    };
  }

  return {
    name: 'ApiError',
    message: 'Unknown error',
    statusCode: 0,
    details: e
  };
};