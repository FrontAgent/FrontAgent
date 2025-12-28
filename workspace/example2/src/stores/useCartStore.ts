import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem } from '../api/types';

type CartItemKey = Pick<CartItem, 'productId'> & Partial<Pick<CartItem, 'variantId'>>;

const normalizeQty = (qty: number) => {
  if (!Number.isFinite(qty)) return 1;
  return Math.max(1, Math.floor(qty));
};

const getItemKey = (item: CartItemKey) => `${item.productId}::${item.variantId ?? ''}`;

const sameItem = (a: CartItemKey, b: CartItemKey) => getItemKey(a) === getItemKey(b);

export type CartStoreState = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (item: CartItemKey) => void;
  updateQty: (item: CartItemKey, qty: number) => void;
  clear: () => void;
};

export const useCartStore = create<CartStoreState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => {
        const qty = normalizeQty((item as CartItem).qty ?? 1);
        set((state) => {
          const idx = state.items.findIndex((it) => sameItem(it, item));
          if (idx >= 0) {
            const next = state.items.slice();
            const currentQty = normalizeQty((next[idx] as CartItem).qty ?? 1);
            next[idx] = { ...next[idx], ...item, qty: currentQty + qty };
            return { items: next };
          }
          return { items: [...state.items, { ...item, qty }] };
        });
      },
      removeItem: (item) => {
        set((state) => ({
          items: state.items.filter((it) => !sameItem(it, item)),
        }));
      },
      updateQty: (item, qty) => {
        if (!Number.isFinite(qty)) return;
        if (qty <= 0) {
          get().removeItem(item);
          return;
        }
        const nextQty = normalizeQty(qty);
        set((state) => {
          const idx = state.items.findIndex((it) => sameItem(it, item));
          if (idx < 0) return state;
          const next = state.items.slice();
          next[idx] = { ...next[idx], qty: nextQty };
          return { items: next };
        });
      },
      clear: () => set({ items: [] }),
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