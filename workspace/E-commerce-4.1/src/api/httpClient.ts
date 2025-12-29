import { getAccessToken } from '../stores/authStore';
import { installMockLayer } from '../mocks/mockServer';

// mock 覆盖策略为“命中已注册 mock 路由才拦截，否则透传真实请求”。
if (import.meta.env.DEV && String(import.meta.env.VITE_USE_MOCK).toLowerCase() === 'true') installMockLayer();

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;
  public readonly requestId?: string;

  constructor(params: { statusCode: number; message: string; details?: unknown; requestId?: string }) {
    super(params.message);
    this.name = 'ApiError';
    this.statusCode = params.statusCode;
    this.details = params.details;
    this.requestId = params.requestId;
  }
}

export type QueryParams =
  | Record<
      string,
      | string
      | number
      | boolean
      | null
      | undefined
      | (string | number | boolean | null | undefined)[]
    >
  | URLSearchParams;

export type RequestOptions = {
  method?: HttpMethod;
  url: string;
  query?: QueryParams;
  body?: unknown;
  headers?: Record<string, string | undefined>;
  signal?: AbortSignal;
};

type UnauthorizedHandler = (error: ApiError) => void | Promise<void>;

let unauthorizedHandler: UnauthorizedHandler | undefined;

export function setUnauthorizedHandler(fn?: UnauthorizedHandler) {
  unauthorizedHandler = fn;
}

function getBaseURL(): string {
  const env = (import.meta as any)?.env as Record<string, any> | undefined;
  const base = (env?.VITE_API_BASE_URL ?? '') as string;
  return typeof base === 'string' ? base : '';
}

function isAbsoluteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function joinUrl(base: string, path: string): string {
  if (!base) return path;
  if (!path) return base;
  const b = base.endsWith('/') ? base.slice(0, -1) : base;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

function buildQueryString(query?: QueryParams): string {
  if (!query) return '';
  if (query instanceof URLSearchParams) {
    const qs = query.toString();
    return qs ? `?${qs}` : '';
  }
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null) continue;
        sp.append(key, String(item));
      }
      continue;
    }
    sp.set(key, String(value));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

function getHeader(headers: Headers, name: string): string | undefined {
  const v = headers.get(name);
  return v ?? undefined;
}

function looksLikeJsonContentType(contentType: string | undefined): boolean {
  if (!contentType) return false;
  const ct = contentType.toLowerCase();
  return ct.includes('application/json') || ct.includes('+json');
}

function normalizeErrorMessage(input: unknown): string | undefined {
  if (typeof input === 'string' && input.trim()) return input;
  if (input && typeof input === 'object') {
    const obj = input as any;
    const msg = obj.message ?? obj.error ?? obj.msg;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return undefined;
}

async function safeReadBody(response: Response): Promise<{ data: unknown; isJson: boolean }> {
  const contentType = response.headers.get('content-type') ?? undefined;
  const isJson = looksLikeJsonContentType(contentType);
  if (response.status === 204) return { data: null, isJson };

  if (isJson) {
    try {
      const json = await response.json();
      return { data: json, isJson: true };
    } catch {
      try {
        const text = await response.text();
        return { data: text, isJson: false };
      } catch {
        return { data: null, isJson: false };
      }
    }
  }

  try {
    const text = await response.text();
    return { data: text, isJson: false };
  } catch {
    return { data: null, isJson: false };
  }
}

function extractRequestId(headers: Headers): string | undefined {
  return (
    getHeader(headers, 'x-request-id') ||
    getHeader(headers, 'x-requestid') ||
    getHeader(headers, 'request-id') ||
    getHeader(headers, 'trace-id') ||
    getHeader(headers, 'x-trace-id')
  );
}

function mapStatusToMessage(status: number): string {
  if (status === 401) return 'Unauthorized';
  if (status === 403) return 'Forbidden';
  if (status === 404) return 'Not Found';
  if (status === 408) return 'Request Timeout';
  if (status === 429) return 'Too Many Requests';
  if (status >= 500) return 'Server Error';
  return 'Request Failed';
}

export async function request<T>(options: RequestOptions): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase() as HttpMethod;
  const baseURL = getBaseURL();
  const urlWithBase = isAbsoluteUrl(options.url) ? options.url : joinUrl(baseURL, options.url);
  const qs = buildQueryString(options.query);
  const finalUrl = `${urlWithBase}${qs}`;

  const headers: Record<string, string> = {
    Accept: 'application/json, text/plain, */*',
  };

  const token = getAccessToken?.();
  if (typeof token === 'string' && token.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }

  if (options.headers) {
    for (const [k, v] of Object.entries(options.headers)) {
      if (v === undefined) continue;
      headers[k] = v;
    }
  }

  const init: RequestInit = {
    method,
    headers,
    signal: options.signal,
  };

  const hasBody = options.body !== undefined && options.body !== null && method !== 'GET' && method !== 'DELETE';
  if (hasBody) {
    const contentTypeKey = Object.keys(headers).find((k) => k.toLowerCase() === 'content-type');
    const contentType = contentTypeKey ? headers[contentTypeKey] : undefined;

    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const isUrlEncoded = typeof URLSearchParams !== 'undefined' && options.body instanceof URLSearchParams;
    const isBlob = typeof Blob !== 'undefined' && options.body instanceof Blob;
    const isArrayBuffer = typeof ArrayBuffer !== 'undefined' && options.body instanceof ArrayBuffer;

    if (isFormData) {
      if (contentTypeKey) delete headers[contentTypeKey];
      init.body = options.body as any;
    } else if (isUrlEncoded) {
      if (!contentType) headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
      init.body = (options.body as URLSearchParams).toString();
    } else if (isBlob || isArrayBuffer) {
      init.body = options.body as any;
    } else if (typeof options.body === 'string') {
      if (!contentType) headers['Content-Type'] = 'text/plain;charset=UTF-8';
      init.body = options.body;
    } else {
      if (!contentType) headers['Content-Type'] = 'application/json;charset=UTF-8';
      init.body = JSON.stringify(options.body);
    }
  }

  let response: Response;
  try {
    response = await fetch(finalUrl, init);
  } catch (err: any) {
    const message = typeof err?.message === 'string' && err.message.trim() ? err.message : 'Network Error';
    throw new ApiError({ statusCode: 0, message, details: err });
  }

  const requestId = extractRequestId(response.headers);
  const { data } = await safeReadBody(response);

  if (!response.ok) {
    const statusCode = response.status;
    const message = normalizeErrorMessage(data) ?? mapStatusToMessage(statusCode);

    const apiError = new ApiError({
      statusCode,
      message,
      details: data,
      requestId,
    });

    if ((statusCode === 401 || statusCode === 403) && unauthorizedHandler) {
      try {
        await unauthorizedHandler(apiError);
      } catch {
        // ignore unauthorized handler errors
      }
    }

    throw apiError;
  }

  return data as T;
}

export function get<T>(
  url: string,
  options?: Omit<RequestOptions, 'method' | 'url' | 'body'>
): Promise<T> {
  return request<T>({ ...(options ?? {}), method: 'GET', url });
}

export function del<T>(
  url: string,
  options?: Omit<RequestOptions, 'method' | 'url' | 'body'>
): Promise<T> {
  return request<T>({ ...(options ?? {}), method: 'DELETE', url });
}

export function post<T>(
  url: string,
  body?: unknown,
  options?: Omit<RequestOptions, 'method' | 'url' | 'body'>
): Promise<T> {
  return request<T>({ ...(options ?? {}), method: 'POST', url, body });
}

export function put<T>(
  url: string,
  body?: unknown,
  options?: Omit<RequestOptions, 'method' | 'url' | 'body'>
): Promise<T> {
  return request<T>({ ...(options ?? {}), method: 'PUT', url, body });
}

export function patch<T>(
  url: string,
  body?: unknown,
  options?: Omit<RequestOptions, 'method' | 'url' | 'body'>
): Promise<T> {
  return request<T>({ ...(options ?? {}), method: 'PATCH', url, body });
}