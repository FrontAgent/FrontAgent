import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ICartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  sku?: string;
}

export interface ICartState {
  items: ICartItem[];
  isOpen: boolean;
  addItem: (item: Omit<ICartItem, 'quantity'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  getItem: (id: string) => ICartItem | undefined;
}

export const useCartStore = create<ICartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      /**
       * 添加商品到购物车
       * @param item - 商品信息（不包含数量）
       */
      addItem: (item) => {
        set((state) => {
          const existingItem = state.items.find((i) => i.id === item.id);
          
          if (existingItem) {
            return {
              items: state.items.map((i) =>
                i.id === item.id
                  ? { ...i, quantity: i.quantity + 1 }
                  : i
              ),
            };
          }
          
          return {
            items: [...state.items, { ...item, quantity: 1 }],
          };
        });
      },

      /**
       * 从购物车移除商品
       * @param id - 商品ID
       */
      removeItem: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));
      },

      /**
       * 更新商品数量
       * @param id - 商品ID
       * @param quantity - 新数量
       */
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

      /**
       * 清空购物车
       */
      clearCart: () => {
        set({ items: [] });
      },

      /**
       * 切换购物车显示状态
       */
      toggleCart: () => {
        set((state) => ({ isOpen: !state.isOpen }));
      },

      /**
       * 获取购物车商品总数
       * @returns 商品总数
       */
      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },

      /**
       * 获取购物车总价
       * @returns 总价
       */
      getTotalPrice: () => {
        return get().items.reduce(
          (total, item) => total + item.price * item.quantity,
          0
        );
      },

      /**
       * 获取指定商品信息
       * @param id - 商品ID
       * @returns 商品信息或undefined
       */
      getItem: (id) => {
        return get().items.find((item) => item.id === id);
      },
    }),
    {
      name: 'cart-storage',
      partialize: (state) => ({ items: state.items }),
    }
  )
);