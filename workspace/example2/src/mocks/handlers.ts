import { http, HttpResponse, type HttpHandler } from 'msw';

type JsonObject = Record<string, unknown>;

type Role = 'user' | 'admin';

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  role: Role;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: 'USD' | 'CNY' | 'EUR';
  imageUrl?: string;
  stock: number;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'canceled';

export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  nameSnapshot: string;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
  currency: Product['currency'];
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

interface AuthTokenPayload {
  sub: string;
  email: string;
  name: string;
  role: Role;
  iat: number;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

interface AuthResponse {
  token: string;
  user: Omit<User, 'password'>;
}

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: JsonObject;
  };
}

const nowIso = () => new Date().toISOString();

const base64UrlEncode = (input: string): string => {
  const b64 = typeof btoa === 'function' ? btoa(input) : Buffer.from(input, 'utf-8').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const base64UrlDecode = (input: string): string => {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  return typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('utf-8');
};

const createMockJwt = (payload: AuthTokenPayload): string => {
  const header = { alg: 'none', typ: 'JWT' };
  return `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}.`;
};

const parseMockJwt = (token: string): AuthTokenPayload | null => {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    return JSON.parse(base64UrlDecode(parts[1])) as AuthTokenPayload;
  } catch {
    return null;
  }
};

const toPublicUser = (user: User): Omit<User, 'password'> => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...rest } = user;
  return rest;
};

const jsonError = (status: number, code: string, message: string, details?: JsonObject) => {
  const body: ErrorResponse = { error: { code, message, details } };
  return HttpResponse.json(body, { status });
};

const getBearerToken = (request: Request): string | null => {
  const auth = request.headers.get('Authorization') ?? request.headers.get('authorization');
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
};

const requireAuth = (request: Request): AuthTokenPayload | null => {
  const token = getBearerToken(request);
  if (!token) return null;
  return parseMockJwt(token);
};

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
};

type DataStore = {
  users: User[];
  products: Product[];
  orders: Order[];
};

const initStore = (): DataStore => {
  const createdAt = nowIso();
  const updatedAt = createdAt;

  const users: User[] = [
    {
      id: 'u_admin',
      email: 'admin@example.com',
      password: 'admin123',
      name: 'Admin',
      role: 'admin',
      createdAt,
    },
    {
      id: 'u_user',
      email: 'user@example.com',
      password: 'user123',
      name: 'User',
      role: 'user',
      createdAt,
    },
  ];

  const products: Product[] = [
    {
      id: 'p_1',
      name: 'Wireless Mouse',
      description: 'Ergonomic wireless mouse with adjustable DPI.',
      price: 19.99,
      currency: 'USD',
      imageUrl: 'https://picsum.photos/seed/mouse/640/480',
      stock: 120,
      createdAt,
      updatedAt,
    },
    {
      id: 'p_2',
      name: 'Mechanical Keyboard',
      description: 'Tactile mechanical keyboard with RGB backlight.',
      price: 89.0,
      currency: 'USD',
      imageUrl: 'https://picsum.photos/seed/keyboard/640/480',
      stock: 60,
      createdAt,
      updatedAt,
    },
    {
      id: 'p_3',
      name: 'USB-C Hub',
      description: '7-in-1 USB-C hub with HDMI and card reader.',
      price: 34.5,
      currency: 'USD',
      imageUrl: 'https://picsum.photos/seed/hub/640/480',
      stock: 200,
      createdAt,
      updatedAt,
    },
  ];

  const orders: Order[] = [
    {
      id: 'o_1',
      userId: 'u_user',
      items: [
        {
          productId: 'p_1',
          quantity: 2,
          unitPrice: 19.99,
          nameSnapshot: 'Wireless Mouse',
        },
      ],
      total: 39.98,
      currency: 'USD',
      status: 'paid',
      createdAt,
      updatedAt,
    },
  ];

  return { users, products, orders };
};

const store: DataStore = initStore();

const findUserByEmail = (email: string) => store.users.find((u) => u.email.toLowerCase() === email.toLowerCase());

const validateEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const safeJson = async <T>(request: Request): Promise<T | null> => {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
};

export const handlers: HttpHandler[] = [
  http.post('/auth/login', async ({ request }) => {
    const body = await safeJson<LoginRequest>(request);
    if (!body) return jsonError(400, 'BAD_REQUEST', 'Invalid JSON body');
    const { email, password } = body;

    if (!email || !password) {
      return jsonError(400, 'VALIDATION_ERROR', 'Email and password are required');
    }

    const user = findUserByEmail(email);
    if (!user || user.password !== password) {
      return jsonError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const payload: AuthTokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
    };

    const response: AuthResponse = {
      token: createMockJwt(payload),
      user: toPublicUser(user),
    };

    return HttpResponse.json(response, { status: 200 });
  }),

  http.post('/auth/register', async ({ request }) => {
    const body = await safeJson<RegisterRequest>(request);
    if (!body) return jsonError(400, 'BAD_REQUEST', 'Invalid JSON body');

    const { email, password, name } = body;
    if (!email || !password || !name) {
      return jsonError(400, 'VALIDATION_ERROR', 'Email, password and name are required');
    }
    if (!validateEmail(email)) {
      return jsonError(400, 'VALIDATION_ERROR', 'Invalid email format', { email });
    }
    if (password.length < 6) {
      return jsonError(400, 'VALIDATION_ERROR', 'Password must be at least 6 characters');
    }
    if (findUserByEmail(email)) {
      return jsonError(409, 'CONFLICT', 'Email already registered');
    }

    const createdAt = nowIso();
    const user: User = {
      id: generateId(),
      email,
      password,
      name,
      role: 'user',
      createdAt,
    };
    store.users.push(user);

    const payload: AuthTokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
    };

    const response: AuthResponse = {
      token: createMockJwt(payload),
      user: toPublicUser(user),
    };

    return HttpResponse.json(response, { status: 201 });
  }),

  http.get('/products', ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.trim().toLowerCase() ?? '';
    const limitParam = url.searchParams.get('limit');
    const offsetParam = url.searchParams.get('offset');

    const limit = limitParam ? Math.max(0, Math.min(200, Number(limitParam))) : 50;
    const offset = offsetParam ? Math.max(0, Number(offsetParam)) : 0;

    const filtered = q
      ? store.products.filter((p) => `${p.name} ${p.description}`.toLowerCase().includes(q))
      : store.products;

    const page = filtered.slice(offset, offset + limit);

    return HttpResponse.json(
      {
        data: page,
        meta: {
          total: filtered.length,
          limit,
          offset,
          q: q || null,
        },
      },
      { status: 200 },
    );
  }),

  http.get('/orders', ({ request }) => {
    const auth = requireAuth(request);
    if (!auth) return jsonError(401, 'UNAUTHORIZED', 'Missing or invalid Authorization header');

    const url = new URL(request.url);
    const status = (url.searchParams.get('status')?.trim() ?? '') as OrderStatus | '';
    const mine = url.searchParams.get('mine');

    const isMine = mine === 'true' || mine === null;

    let orders = store.orders.slice();

    if (auth.role !== 'admin' || isMine) {
      orders = orders.filter((o) => o.userId === auth.sub);
    }

    if (status) {
      const allowed: OrderStatus[] = ['pending', 'paid', 'shipped', 'delivered', 'canceled'];
      if (!allowed.includes(status)) return jsonError(400, 'VALIDATION_ERROR', 'Invalid status filter', { status });
      orders = orders.filter((o) => o.status === status);
    }

    orders.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    return HttpResponse.json({ data: orders }, { status: 200 });
  }),

  http.get('/orders/:id', ({ params, request }) => {
    const auth = requireAuth(request);
    if (!auth) return jsonError(401, 'UNAUTHORIZED', 'Missing or invalid Authorization header');

    const id = String(params.id);
    const order = store.orders.find((o) => o.id === id);
    if (!order) return jsonError(404, 'NOT_FOUND', 'Order not found');

    if (auth.role !== 'admin' && order.userId !== auth.sub) {
      return jsonError(403, 'FORBIDDEN', 'You do not have access to this order');
    }

    return HttpResponse.json({ data: order }, { status: 200 });
  }),
];