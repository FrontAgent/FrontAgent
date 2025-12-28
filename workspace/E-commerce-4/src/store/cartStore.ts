import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  color?: string;
  size?: string;
  selected?: boolean;
}

interface CartState {
  items: CartItem[];
  totalItems: number;
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getTotalPrice: () => number;
  getTotalItems: () => number;
  selectAll: (selected: boolean) => void;
  toggleItemSelection: (id: string) => void;
  getSelectedItems: () => CartItem[];
  getSelectedCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      totalItems: 0,

      addItem: (item: CartItem) => {
        set((state) => {
          const existingItem = state.items.find(
            (i) => i.id === item.id && i.color === item.color && i.size === item.size
          );

          let updatedItems;
          if (existingItem) {
            updatedItems = state.items.map((i) =>
              i.id === item.id && i.color === item.color && i.size === item.size
                ? { ...i, quantity: i.quantity + item.quantity }
                : i
            );
          } else {
            updatedItems = [...state.items, { ...item, selected: false }];
          }

          return {
            items: updatedItems,
            totalItems: updatedItems.reduce((total, i) => total + i.quantity, 0),
          };
        });
      },

      removeItem: (id: string) => {
        set((state) => {
          const updatedItems = state.items.filter((item) => item.id !== id);
          return {
            items: updatedItems,
            totalItems: updatedItems.reduce((total, item) => total + item.quantity, 0),
          };
        });
      },

      updateQuantity: (id: string, quantity: number) => {
        set((state) => {
          const updatedItems = state.items.map((item) =>
            item.id === id ? { ...item, quantity } : item
          );
          return {
            items: updatedItems,
            totalItems: updatedItems.reduce((total, item) => total + item.quantity, 0),
          };
        });
      },

      clearCart: () => {
        set({ items: [], totalItems: 0 });
      },

      getTotalPrice: () => {
        const { items } = get();
        return items.reduce((total, item) => total + item.price * item.quantity, 0);
      },

      getTotalItems: () => {
        const { items } = get();
        return items.reduce((total, item) => total + item.quantity, 0);
      },

      selectAll: (selected: boolean) => {
        set((state) => {
          const updatedItems = state.items.map((item) => ({ ...item, selected }));
          return {
            items: updatedItems,
            totalItems: updatedItems.reduce((total, item) => total + item.quantity, 0),
          };
        });
      },

      toggleItemSelection: (id: string) => {
        set((state) => {
          const updatedItems = state.items.map((item) =>
            item.id === id ? { ...item, selected: !item.selected } : item
          );
          return {
            items: updatedItems,
            totalItems: updatedItems.reduce((total, item) => total + item.quantity, 0),
          };
        });
      },

      getSelectedItems: () => {
        const { items } = get();
        return items.filter((item) => item.selected);
      },

      getSelectedCount: () => {
        const { items } = get();
        return items.filter((item) => item.selected).reduce((total, item) => total + item.quantity, 0);
      },
    }),
    {
      name: 'cart-storage',
    }
  )
);
