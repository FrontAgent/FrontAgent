export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions<TBody = unknown> {
  method?: HttpMethod;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: TBody;
  signal?: AbortSignal;
  baseUrl?: string;
  credentials?: RequestCredentials;
}

export interface HttpErrorDetails<T = unknown> {
  status: number;
  statusText: string;
  url: string;
  data?: T;
}

export class HttpError<T = unknown> extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly url: string;
  public readonly data?: T;

  constructor(details: HttpErrorDetails<T>) {
    super(`HTTP ${details.status} ${details.statusText}`);
    this.name = 'HttpError';
    this.status = details.status;
    this.statusText = details.statusText;
    this.url = details.url;
    this.data = details.data;
  }
}

function buildUrl(path: string, baseUrl?: string, query?: RequestOptions['query']): string {
  const isAbsolute = /^https?:\/\//i.test(path);
  const url = new URL(isAbsolute ? path : `${(baseUrl ?? '').replace(/\/+$/, '')}${path.startsWith('/') ? '' : '/'}${path}`);

  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === null || v === undefined) continue;
      url.searchParams.set(k, String(v));
    }
  }

  return url.toString();
}

function isJsonResponse(res: Response): boolean {
  const ct = res.headers.get('content-type') ?? '';
  return ct.includes('application/json') || ct.includes('+json');
}

function isJsonBody(body: unknown): body is Record<string, unknown> | unknown[] {
  if (body === null || body === undefined) return false;
  if (typeof body === 'string') return false;
  if (typeof body === 'object') return true;
  return false;
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as unknown as T;
  if (isJsonResponse(res)) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

export interface HttpClient {
  request<TResponse = unknown, TBody = unknown>(path: string, options?: RequestOptions<TBody>): Promise<TResponse>;
  get<TResponse = unknown>(path: string, options?: Omit<RequestOptions<never>, 'method' | 'body'>): Promise<TResponse>;
  post<TResponse = unknown, TBody = unknown>(path: string, body?: TBody, options?: Omit<RequestOptions<TBody>, 'method' | 'body'>): Promise<TResponse>;
  put<TResponse = unknown, TBody = unknown>(path: string, body?: TBody, options?: Omit<RequestOptions<TBody>, 'method' | 'body'>): Promise<TResponse>;
  patch<TResponse = unknown, TBody = unknown>(path: string, body?: TBody, options?: Omit<RequestOptions<TBody>, 'method' | 'body'>): Promise<TResponse>;
  del<TResponse = unknown>(path: string, options?: Omit<RequestOptions<never>, 'method' | 'body'>): Promise<TResponse>;
}

export const httpClient: HttpClient = {
  async request<TResponse = unknown, TBody = unknown>(path: string, options: RequestOptions<TBody> = {}): Promise<TResponse> {
    const method = (options.method ?? 'GET') as HttpMethod;
    const url = buildUrl(path, options.baseUrl, options.query);

    const headers: Record<string, string> = {
      ...(options.headers ?? {}),
    };

    let body: BodyInit | undefined;

    if (options.body !== undefined) {
      if (options.body instanceof FormData) {
        body = options.body;
      } else if (isJsonBody(options.body)) {
        if (!headers['Content-Type'] && !headers['content-type']) headers['Content-Type'] = 'application/json';
        body = JSON.stringify(options.body);
      } else {
        body = options.body as unknown as BodyInit;
      }
    }

    const res = await fetch(url, {
      method,
      headers,
      body,
      signal: options.signal,
      credentials: options.credentials ?? 'include',
    });

    if (!res.ok) {
      let data: unknown = undefined;
      try {
        data = await parseResponse(res);
      } catch {
        data = undefined;
      }
      throw new HttpError({
        status: res.status,
        statusText: res.statusText,
        url,
        data,
      });
    }

    return await parseResponse<TResponse>(res);
  },

  get<TResponse = unknown>(path: string, options: Omit<RequestOptions<never>, 'method' | 'body'> = {}) {
    return this.request<TResponse, never>(path, { ...options, method: 'GET' });
  },

  post<TResponse = unknown, TBody = unknown>(
    path: string,
    body?: TBody,
    options: Omit<RequestOptions<TBody>, 'method' | 'body'> = {},
  ) {
    return this.request<TResponse, TBody>(path, { ...options, method: 'POST', body });
  },

  put<TResponse = unknown, TBody = unknown>(
    path: string,
    body?: TBody,
    options: Omit<RequestOptions<TBody>, 'method' | 'body'> = {},
  ) {
    return this.request<TResponse, TBody>(path, { ...options, method: 'PUT', body });
  },

  patch<TResponse = unknown, TBody = unknown>(
    path: string,
    body?: TBody,
    options: Omit<RequestOptions<TBody>, 'method' | 'body'> = {},
  ) {
    return this.request<TResponse, TBody>(path, { ...options, method: 'PATCH', body });
  },

  del<TResponse = unknown>(path: string, options: Omit<RequestOptions<never>, 'method' | 'body'> = {}) {
    return this.request<TResponse, never>(path, { ...options, method: 'DELETE' });
  },
};

export const request = httpClient.request.bind(httpClient);
export const get = httpClient.get.bind(httpClient);
export const post = httpClient.post.bind(httpClient);
export const put = httpClient.put.bind(httpClient);
export const patch = httpClient.patch.bind(httpClient);
export const del = httpClient.del.bind(httpClient);

export const API_PATHS = {
  auth: {
    me: '/auth/me',
    login: '/auth/login',
    logout: '/auth/logout',
  },
  users: {
    base: '/users',
    me: '/users/me',
  },
  cart: {
    base: '/cart',
    items: '/cart/items',
  },
} as const;

export type ApiPaths = typeof API_PATHS;

export interface AuthMeResponse {
  id: string;
  email?: string;
  name?: string;
}

export interface User {
  id: string;
  email?: string;
  name?: string;
}

export interface CartItem {
  sku: string;
  quantity: number;
}

export interface Cart {
  items: CartItem[];
}

export interface UsersApi {
  me(): Promise<User>;
  getById(id: string): Promise<User>;
}

export interface CartApi {
  getCart(): Promise<Cart>;
  addItem(item: CartItem): Promise<Cart>;
  clear(): Promise<Cart>;
}

export const usersApi: UsersApi = {
  me() {
    return get<User>(API_PATHS.users.me);
  },
  getById(id: string) {
    const safeId = encodeURIComponent(id);
    return get<User>(`${API_PATHS.users.base}/${safeId}`);
  },
};

export const cartApi: CartApi = {
  getCart() {
    return get<Cart>(API_PATHS.cart.base);
  },
  addItem(item: CartItem) {
    return post<Cart, CartItem>(API_PATHS.cart.items, item);
  },
  clear() {
    return del<Cart>(API_PATHS.cart.base);
  },
};

export interface AuthApi {
  me(): Promise<AuthMeResponse>;
}

export const authApi: AuthApi = {
  me() {
    return get<AuthMeResponse>(API_PATHS.auth.me);
  },
};