import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, Product } from '../api/types';

type CartItemKey = Pick<CartItem, 'productId'>;

const normalizeQty = (qty: number) => {
  if (!Number.isFinite(qty)) return 1;
  return Math.max(1, Math.floor(qty));
};

const getItemKey = (item: CartItemKey) => item.productId;

const sameItem = (a: CartItemKey, b: CartItemKey) => getItemKey(a) === getItemKey(b);

export type CartStoreState = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (item: CartItemKey) => void;
  updateQuantity: (item: CartItemKey, quantity: number) => void;
  clear: () => void;
  getTotal: () => number;
};

export const useCartStore = create<CartStoreState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => {
        const quantity = normalizeQty(item.quantity ?? 1);
        set((state) => {
          const idx = state.items.findIndex((it) => sameItem(it, item));
          if (idx >= 0) {
            const next = state.items.slice();
            const currentQty = normalizeQty(next[idx].quantity ?? 1);
            next[idx] = { ...next[idx], ...item, quantity: currentQty + quantity };
            return { items: next };
          }
          return { items: [...state.items, { ...item, quantity }] };
        });
      },
      removeItem: (item) => {
        set((state) => ({
          items: state.items.filter((it) => !sameItem(it, item)),
        }));
      },
      updateQuantity: (item, quantity) => {
        if (!Number.isFinite(quantity)) return;
        if (quantity <= 0) {
          get().removeItem(item);
          return;
        }
        const nextQty = normalizeQty(quantity);
        set((state) => {
          const idx = state.items.findIndex((it) => sameItem(it, item));
          if (idx < 0) return state;
          const next = state.items.slice();
          next[idx] = { ...next[idx], quantity: nextQty };
          return { items: next };
        });
      },
      clear: () => set({ items: [] }),
      getTotal: () => {
        const items = get().items;
        return items.reduce((sum, item) => {
          const price = item.product?.price?.amount ?? 0;
          return sum + price * item.quantity;
        }, 0);
      },
    }),
    {
      name: 'cart-store',
      version: 1,
      partialize: (state) => ({ items: state.items }),
      merge: (persisted, current) => {
        const persistedState = (persisted as Partial<CartStoreState>) ?? {};
        const items = Array.isArray(persistedState.items) ? persistedState.items : [];
        return { ...current, ...persistedState, items };
      },
    }
  )
);
