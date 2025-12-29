type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };

export interface MockUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface MockCartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export interface MockCart {
  items: MockCartItem[];
  currency: string;
}

type FetchInput = RequestInfo | URL;
type FetchInit = RequestInit | undefined;

interface MockResponseSpec {
  status?: number;
  headers?: Record<string, string>;
  body?: JsonValue;
}

const ENV_USE_MOCK = String(import.meta.env?.VITE_USE_MOCK ?? 'false').toLowerCase();
const IS_DEV = Boolean(import.meta.env?.DEV);

export const exampleUser: MockUser = {
  id: 'user_001',
  name: 'Dev User',
  email: 'dev.user@example.com',
  avatarUrl: 'https://example.com/avatar/dev-user.png'
};

export const exampleCart: MockCart = {
  currency: 'USD',
  items: [
    {
      id: 'ci_001',
      productId: 'p_001',
      name: 'Mock T-Shirt',
      price: 19.99,
      quantity: 2,
      imageUrl: 'https://example.com/products/tshirt.png'
    },
    {
      id: 'ci_002',
      productId: 'p_002',
      name: 'Mock Sneakers',
      price: 79.0,
      quantity: 1,
      imageUrl: 'https://example.com/products/sneakers.png'
    }
  ]
};

export function shouldUseMock(): boolean {
  return IS_DEV && ENV_USE_MOCK === 'true';
}

function isAbsoluteHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function normalizePathname(input: FetchInput): { pathname: string; method: string } {
  const method = 'GET';
  if (typeof input === 'string') {
    if (isAbsoluteHttpUrl(input)) {
      const u = new URL(input);
      return { pathname: u.pathname, method };
    }
    try {
      const u = new URL(input, 'http://localhost');
      return { pathname: u.pathname, method };
    } catch {
      return { pathname: input, method };
    }
  }

  if (typeof URL !== 'undefined' && input instanceof URL) {
    return { pathname: input.pathname, method };
  }

  if (typeof Request !== 'undefined' && input instanceof Request) {
    const u = new URL(input.url);
    return { pathname: u.pathname, method: input.method || method };
  }

  try {
    const anyInput = input as any;
    const url = String(anyInput?.url ?? anyInput ?? '');
    if (url) {
      const u = new URL(url, 'http://localhost');
      return { pathname: u.pathname, method: String(anyInput?.method ?? method) };
    }
  } catch {
    // ignore
  }

  return { pathname: '/', method };
}

function toRequestMethod(input: FetchInput, init: FetchInit): string {
  const initMethod = init?.method;
  if (initMethod) return String(initMethod).toUpperCase();
  if (typeof Request !== 'undefined' && input instanceof Request) return String(input.method || 'GET').toUpperCase();
  return 'GET';
}

function jsonResponse(spec: MockResponseSpec): Response {
  const status = spec.status ?? 200;
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    ...spec.headers
  });
  const body = spec.body === undefined ? null : spec.body;
  return new Response(JSON.stringify(body), { status, headers });
}

function notFound(): Response {
  return jsonResponse({ status: 404, body: { error: 'Not Found' } });
}

function unauthorized(): Response {
  return jsonResponse({ status: 401, body: { error: 'Unauthorized' } });
}

function methodNotAllowed(): Response {
  return jsonResponse({ status: 405, body: { error: 'Method Not Allowed' } });
}

function parseJsonBody(init: FetchInit): unknown | undefined {
  const body = init?.body;
  if (body == null) return undefined;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function handleAuthMe(method: string): Response {
  if (method !== 'GET') return methodNotAllowed();
  return jsonResponse({ status: 200, body: exampleUser });
}

function handleCart(method: string, init: FetchInit): Response {
  if (method === 'GET') {
    return jsonResponse({ status: 200, body: exampleCart });
  }
  if (method === 'POST') {
    const payload = parseJsonBody(init) as any;
    const item = payload?.item as Partial<MockCartItem> | undefined;
    if (!item?.productId || !item?.name || typeof item?.price !== 'number') {
      return jsonResponse({ status: 400, body: { error: 'Invalid item payload' } });
    }
    const newItem: MockCartItem = {
      id: item.id ?? `ci_${Math.random().toString(16).slice(2)}`,
      productId: String(item.productId),
      name: String(item.name),
      price: Number(item.price),
      quantity: typeof item.quantity === 'number' && item.quantity > 0 ? Math.floor(item.quantity) : 1,
      imageUrl: item.imageUrl ? String(item.imageUrl) : undefined
    };
    const next: MockCart = {
      ...exampleCart,
      items: [...exampleCart.items, newItem]
    };
    return jsonResponse({ status: 201, body: next });
  }
  return methodNotAllowed();
}

function handleSession(method: string): Response {
  if (method !== 'GET') return methodNotAllowed();
  return jsonResponse({
    status: 200,
    body: {
      dev: true,
      mock: true,
      user: exampleUser
    }
  });
}

export function mockFetch(input: FetchInput, init?: FetchInit): Promise<Response> {
  if (!IS_DEV) {
    return Promise.resolve(
      jsonResponse({
        status: 500,
        body: { error: 'Mock layer is development-only' }
      })
    );
  }

  const { pathname } = normalizePathname(input);
  const method = toRequestMethod(input, init);

  if (pathname === '/auth/me') {
    return Promise.resolve(handleAuthMe(method));
  }

  if (pathname === '/cart') {
    return Promise.resolve(handleCart(method, init));
  }

  if (pathname === '/session') {
    return Promise.resolve(handleSession(method));
  }

  if (pathname === '/auth/logout') {
    if (method !== 'POST') return Promise.resolve(methodNotAllowed());
    return Promise.resolve(jsonResponse({ status: 200, body: { ok: true } }));
  }

  if (pathname === '/auth/login') {
    if (method !== 'POST') return Promise.resolve(methodNotAllowed());
    return Promise.resolve(jsonResponse({ status: 200, body: { ok: true, user: exampleUser } }));
  }

  if (pathname === '/auth/require') {
    if (method !== 'GET') return Promise.resolve(methodNotAllowed());
    return Promise.resolve(unauthorized());
  }

  return Promise.resolve(notFound());
}

let originalFetch: typeof globalThis.fetch | null = null;
let installed = false;

export function installMockLayer(): { restore: () => void; installed: boolean } {
  const canUse = shouldUseMock();
  if (!canUse) {
    return {
      installed: false,
      restore: () => {
        // no-op
      }
    };
  }

  if (installed) {
    return {
      installed: true,
      restore: () => restoreMockLayer()
    };
  }

  if (typeof globalThis.fetch !== 'function') {
    return {
      installed: false,
      restore: () => {
        // no-op
      }
    };
  }

  originalFetch = globalThis.fetch.bind(globalThis);
  const fallbackFetch = originalFetch;

  globalThis.fetch = (async (input: FetchInput, init?: FetchInit) => {
    const { pathname } = normalizePathname(input);

    const handledPaths = new Set<string>(['/auth/me', '/cart', '/session', '/auth/login', '/auth/logout', '/auth/require']);
    if (handledPaths.has(pathname)) {
      return mockFetch(input, init);
    }

    return fallbackFetch(input as any, init as any);
  }) as typeof globalThis.fetch;

  installed = true;

  return {
    installed: true,
    restore: () => restoreMockLayer()
  };
}

export function restoreMockLayer(): void {
  if (!installed) return;
  if (originalFetch) {
    globalThis.fetch = originalFetch;
  }
  originalFetch = null;
  installed = false;
}