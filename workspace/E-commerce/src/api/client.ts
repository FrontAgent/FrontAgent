import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export type ApiError = {
  message: string;
  status?: number;
  code?: string;
  details?: unknown;
};

type Maybe<T> = T | null | undefined;

function getEnvApiBaseUrl(): string {
  const fromVite = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) as Maybe<string>;
  return (fromVite || '').toString();
}

function safeGetTokenFromGlobals(): string | null {
  try {
    const t = globalThis?.localStorage?.getItem?.('token');
    if (typeof t === 'string' && t) return t;
  } catch {
    // ignore
  }
  return null;
}

function triggerLogoutPlaceholder(): void {
  try {
    globalThis.localStorage?.removeItem?.('token');
    globalThis.dispatchEvent?.(new CustomEvent('auth:logout', { detail: { reason: 'unauthorized' } }));
  } catch {
    // ignore
  }
}

function normalizeAxiosError(error: unknown): ApiError {
  const fallback: ApiError = { message: 'Request failed' };

  if (!axios.isAxiosError(error)) {
    if (error instanceof Error) return { message: error.message };
    if (typeof error === 'string') return { message: error };
    return fallback;
  }

  const axErr = error as AxiosError<any>;
  const status = axErr.response?.status;

  const data = axErr.response?.data;
  const message =
    (typeof data?.message === 'string' && data.message) ||
    (typeof data?.error === 'string' && data.error) ||
    (typeof axErr.message === 'string' && axErr.message) ||
    fallback.message;

  const code = (typeof data?.code === 'string' && data.code) || undefined;
  const details = data?.details ?? data ?? undefined;

  return { message, status, code, details };
}

const baseURL = getEnvApiBaseUrl();

export const apiClient: AxiosInstance = axios.create({
  baseURL: baseURL || undefined,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = safeGetTokenFromGlobals();
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: unknown) => {
    const apiError = normalizeAxiosError(error);

    if (apiError.status === 401) {
      triggerLogoutPlaceholder();
    }

    return Promise.reject(apiError);
  },
);

export type RequestConfig = AxiosRequestConfig;

export async function request<T = unknown>(config: RequestConfig): Promise<T> {
  const res = await apiClient.request<T>(config);
  return res.data;
}

export async function get<T = unknown>(url: string, config?: RequestConfig): Promise<T> {
  return request<T>({ ...(config ?? {}), method: 'GET', url });
}

export async function post<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
  return request<T>({ ...(config ?? {}), method: 'POST', url, data });
}

export async function put<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
  return request<T>({ ...(config ?? {}), method: 'PUT', url, data });
}

export async function patch<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
  return request<T>({ ...(config ?? {}), method: 'PATCH', url, data });
}

export async function del<T = unknown>(url: string, config?: RequestConfig): Promise<T> {
  return request<T>({ ...(config ?? {}), method: 'DELETE', url });
}
