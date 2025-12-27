import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ICartItem {
  id: string;
  productId: string;
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
  addItem: (item: Omit<ICartItem, 'id'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  isInCart: (productId: string) => boolean;
}

export const useCartStore = create<ICartStore>()(
  persist(
    (set, get) => ({
      items: [],
      totalItems: 0,
      totalPrice: 0,

      addItem: (item) => {
        const existingItem = get().items.find(
          (i) => i.productId === item.productId && i.variant === item.variant
        );

        if (existingItem) {
          set((state) => ({
            items: state.items.map((i) =>
              i.id === existingItem.id
                ? { ...i, quantity: i.quantity + item.quantity }
                : i
            ),
          }));
        } else {
          const newItem: ICartItem = {
            ...item,
            id: `${item.productId}-${Date.now()}`,
          };
          set((state) => ({
            items: [...state.items, newItem],
          }));
        }
      },

      removeItem: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));
      },

      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id);
          return;
        }

        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, quantity } : item
          ),
        }));
      },

      clearCart: () => {
        set({ items: [] });
      },

      isInCart: (productId) => {
        return get().items.some((item) => item.productId === productId);
      },
    }),
    {
      name: 'cart-storage',
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const totalItems = state.items.reduce((sum, item) => sum + item.quantity, 0);
          const totalPrice = state.items.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
          );
          state.totalItems = totalItems;
          state.totalPrice = totalPrice;
        }
      },
    }
  )
);

useCartStore.subscribe(
  (state) => state.items,
  (items) => {
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    
    useCartStore.setState({
      totalItems,
      totalPrice,
    });
  }
);