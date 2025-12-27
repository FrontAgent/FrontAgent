import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ICartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  variant?: string;
}

interface ICartStore {
  items: ICartItem[];
  totalItems: number;
  totalPrice: number;
  addItem: (item: Omit<ICartItem, 'quantity'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
}

export const useCartStore = create<ICartStore>()(
  persist(
    (set, get) => ({
      items: [],
      totalItems: 0,
      totalPrice: 0,

      addItem: (item) => {
        const { items } = get();
        const existingItem = items.find((i) => i.id === item.id);

        if (existingItem) {
          set({
            items: items.map((i) =>
              i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
            ),
          });
        } else {
          set({
            items: [...items, { ...item, quantity: 1 }],
          });
        }
      },

      removeItem: (id) => {
        const { items } = get();
        set({
          items: items.filter((item) => item.id !== id),
        });
      },

      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id);
          return;
        }

        const { items } = get();
        set({
          items: items.map((item) =>
            item.id === id ? { ...item, quantity } : item
          ),
        });
      },

      clearCart: () => {
        set({
          items: [],
        });
      },

      getTotalItems: () => {
        const { items } = get();
        return items.reduce((total, item) => total + item.quantity, 0);
      },

      getTotalPrice: () => {
        const { items } = get();
        return items.reduce((total, item) => total + item.price * item.quantity, 0);
      },
    }),
    {
      name: 'cart-storage',
      partialize: (state) => ({ items: state.items }),
    }
  )
);