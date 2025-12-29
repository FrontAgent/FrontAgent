import { create } from 'zustand';

export type CartItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
};

type CartState = {
  items: CartItem[];
};

type CartActions = {
  addItem: (item: Omit<CartItem, 'quantity'> & Partial<Pick<CartItem, 'quantity'>>, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  hydrateFromStorage: () => void;
  persistToStorage: () => void;
};

type CartDerived = {
  getTotalQuantity: () => number;
  getTotalPrice: () => number;
};

export type CartStore = CartState & CartActions & CartDerived;

const STORAGE_KEY = 'app:cart';

const isBrowser = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const clampSafeQuantity = (q: number) => {
  const n = Number.isFinite(q) ? Math.floor(q) : 0;
  return n;
};

const sanitizeItem = (item: CartItem): CartItem | null => {
  if (!item || typeof item !== 'object') return null;
  if (!item.productId || typeof item.productId !== 'string') return null;
  if (!item.name || typeof item.name !== 'string') return null;

  const price = Number(item.price);
  if (!Number.isFinite(price) || price < 0) return null;

  const quantity = clampSafeQuantity(item.quantity);
  if (quantity <= 0) return null;

  const imageUrl = typeof item.imageUrl === 'string' ? item.imageUrl : undefined;

  return {
    productId: item.productId,
    name: item.name,
    price,
    quantity,
    ...(imageUrl ? { imageUrl } : {}),
  };
};

const readFromStorage = (): CartItem[] => {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return [];
    const itemsRaw = (parsed as { items?: unknown }).items;
    if (!Array.isArray(itemsRaw)) return [];
    const items = itemsRaw
      .map((x) => sanitizeItem(x as CartItem))
      .filter((x): x is CartItem => Boolean(x));
    return items;
  } catch {
    return [];
  }
};

const writeToStorage = (items: CartItem[]) => {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ items }));
  } catch {
    // ignore
  }
};

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],

  addItem: (item, quantity) => {
    const qFromArgs = quantity ?? item.quantity ?? 1;
    const q = clampSafeQuantity(qFromArgs);

    if (q <= 0) {
      get().removeItem(item.productId);
      return;
    }

    set((state) => {
      const existingIndex = state.items.findIndex((x) => x.productId === item.productId);
      const nextItems = [...state.items];

      if (existingIndex >= 0) {
        const existing = nextItems[existingIndex];
        const nextQuantity = clampSafeQuantity(existing.quantity + q);

        if (nextQuantity <= 0) {
          nextItems.splice(existingIndex, 1);
        } else {
          nextItems[existingIndex] = {
            ...existing,
            name: item.name ?? existing.name,
            price: Number.isFinite(Number(item.price)) ? Number(item.price) : existing.price,
            imageUrl: item.imageUrl ?? existing.imageUrl,
            quantity: nextQuantity,
          };
        }
      } else {
        const price = Number(item.price);
        if (!Number.isFinite(price) || price < 0) return state;

        nextItems.push({
          productId: item.productId,
          name: item.name,
          price,
          quantity: q,
          ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
        });
      }

      return { items: nextItems };
    });

    get().persistToStorage();
  },

  removeItem: (productId) => {
    set((state) => ({ items: state.items.filter((x) => x.productId !== productId) }));
    get().persistToStorage();
  },

  updateQuantity: (productId, quantity) => {
    const q = clampSafeQuantity(quantity);

    if (q <= 0) {
      get().removeItem(productId);
      return;
    }

    set((state) => {
      const idx = state.items.findIndex((x) => x.productId === productId);
      if (idx < 0) return state;
      const nextItems = [...state.items];
      nextItems[idx] = { ...nextItems[idx], quantity: q };
      return { items: nextItems };
    });

    get().persistToStorage();
  },

  clearCart: () => {
    set({ items: [] });
    get().persistToStorage();
  },

  hydrateFromStorage: () => {
    const items = readFromStorage();
    set({ items });
  },

  persistToStorage: () => {
    const { items } = get();
    writeToStorage(items);
  },

  getTotalQuantity: () => {
    const { items } = get();
    return items.reduce((sum, it) => sum + (Number.isFinite(it.quantity) ? it.quantity : 0), 0);
  },

  getTotalPrice: () => {
    const { items } = get();
    return items.reduce((sum, it) => {
      const price = Number.isFinite(it.price) ? it.price : 0;
      const qty = Number.isFinite(it.quantity) ? it.quantity : 0;
      return sum + price * qty;
    }, 0);
  },
}));