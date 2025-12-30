import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

interface CartStore {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      
      addToCart: (item) => {
        const existingItem = get().items.find((i) => i.id === item.id);
        
        if (existingItem) {
          set({
            items: get().items.map((i) =>
              i.id === item.id
                ? { ...i, quantity: i.quantity + (item.quantity || 1) }
                : i
            ),
          });
        } else {
          set({
            items: [...get().items, { ...item, quantity: item.quantity || 1 }],
          });
        }
      },
      
      removeFromCart: (id) => {
        set({
          items: get().items.filter((item) => item.id !== id),
        });
      },
      
      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeFromCart(id);
          return;
        }
        
        set({
          items: get().items.map((item) =>
            item.id === id ? { ...item, quantity } : item
          ),
        });
      },
      
      clearCart: () => {
        set({ items: [] });
      },
      
      get totalItems() {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },
      
      get totalPrice() {
        return get().items.reduce(
          (total, item) => total + item.price * item.quantity,
          0
        );
      },
    }),
    {
      name: 'cart-storage',
    }
  )
);