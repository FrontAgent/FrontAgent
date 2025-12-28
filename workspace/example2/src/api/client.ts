import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export type ApiError = {
  message: string;
  status?: number;
  code?: string;
  details?: unknown;
};

type Maybe<T> = T | null | undefined;

function getEnvApiBaseUrl(): string {
  const fromVite = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.API_BASE_URL) as Maybe<string>;
  const fromNode = (typeof process !== 'undefined' && (process as any).env && (process as any).env.API_BASE_URL) as Maybe<string>;
  return (fromVite || fromNode || '').toString();
}

function safeGetTokenFromGlobals(): string | null {
  const g: any = globalThis as any;

  try {
    const authStore = g?.authStore;
    if (authStore) {
      if (typeof authStore.getToken === 'function') {
        const t = authStore.getToken();
        if (typeof t === 'string' && t) return t;
      }
      if (typeof authStore.token === 'string' && authStore.token) return authStore.token;
      if (typeof authStore.accessToken === 'string' && authStore.accessToken) return authStore.accessToken;
    }
  } catch {
    // ignore
  }

  try {
    const tokenUtil = g?.tokenUtil;
    if (tokenUtil && typeof tokenUtil.getToken === 'function') {
      const t = tokenUtil.getToken();
      if (typeof t === 'string' && t) return t;
    }
  } catch {
    // ignore
  }

  try {
    const t = g?.localStorage?.getItem?.('token');
    if (typeof t === 'string' && t) return t;
  } catch {
    // ignore
  }

  return null;
}

function triggerLogoutPlaceholder(): void {
  const g: any = globalThis as any;
  try {
    const authStore = g?.authStore;
    if (authStore && typeof authStore.logout === 'function') {
      authStore.logout();
      return;
    }
  } catch {
    // ignore
  }

  try {
    if (typeof g?.dispatchEvent === 'function') {
      g.dispatchEvent(new CustomEvent('auth:logout', { detail: { reason: 'unauthorized' } }));
      return;
    }
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

  const code = (typeof data?.code === 'string' && data.code) || (typeof data?.errorCode === 'string' && data.errorCode) || undefined;
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
      const headers = (config.headers ?? {}) as any;
      if (!headers.Authorization && !headers.authorization) {
        headers.Authorization = `Bearer ${token}`;
      }
      config.headers = headers;
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

export type { AxiosInstance, AxiosRequestConfig, AxiosResponse };

export type AuthToken = {
  accessToken: string;
  refreshToken?: string;
  tokenType?: 'Bearer';
  expiresAt?: string;
};

export type User = {
  id: string;
  email: string;
  name?: string;
  roles?: string[];
};

export type Product = {
  id: string;
  name: string;
  price: number;
  currency?: string;
  imageUrl?: string;
  description?: string;
  inStock?: boolean;
};

export type CartItem = {
  productId: string;
  quantity: number;
  product?: Product;
};

export type OrderItem = {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  product?: Product;
};

export type Order = {
  id: string;
  status: 'pending' | 'paid' | 'shipped' | 'cancelled' | 'completed' | string;
  createdAt: string;
  totalAmount: number;
  currency?: string;
  items: OrderItem[];
};

import { get, post } from './client';
import type { AuthToken, User } from './types';

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  email: string;
  password: string;
  name?: string;
};

export type AuthResponse = {
  token: AuthToken;
  user: User;
};

export const authApi = {
  login(payload: LoginRequest) {
    return post<AuthResponse>('/auth/login', payload);
  },
  register(payload: RegisterRequest) {
    return post<AuthResponse>('/auth/register', payload);
  },
  me() {
    return get<User>('/auth/me');
  },
};

import { get } from './client';
import type { Order } from './types';

export type ListOrdersParams = {
  page?: number;
  pageSize?: number;
  status?: string;
};

export type Paginated<T> = {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
};

export const ordersApi = {
  list(params?: ListOrdersParams) {
    return get<Paginated<Order>>('/orders', { params });
  },
  detail(orderId: string) {
    return get<Order>(`/orders/${encodeURIComponent(orderId)}`);
  },
};

import { get } from './client';
import type { Product } from './types';

export type ListProductsParams = {
  q?: string;
  page?: number;
  pageSize?: number;
  categoryId?: string;
  sort?: string;
};

export type Paginated<T> = {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
};

export const productsApi = {
  list(params?: ListProductsParams) {
    return get<Paginated<Product>>('/products', { params });
  },
  detail(productId: string) {
    return get<Product>(`/products/${encodeURIComponent(productId)}`);
  },
};