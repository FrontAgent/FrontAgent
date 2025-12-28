import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 购物车商品接口
 */
export interface ICartItem {
  /** 商品ID */
  id: string;
  /** 商品名称 */
  name: string;
  /** 商品价格 */
  price: number;
  /** 商品数量 */
  quantity: number;
  /** 商品图片URL */
  image: string;
  /** 商品描述（可选） */
  description?: string;
  /** 商品规格（可选） */
  specifications?: string;
}

/**
 * 购物车状态接口
 */
interface ICartState {
  /** 购物车商品列表 */
  items: ICartItem[];
  /** 购物车总商品数量 */
  totalItems: number;
  /** 购物车总价格 */
  totalPrice: number;
}

/**
 * 购物车操作接口
 */
interface ICartActions {
  /**
   * 添加商品到购物车
   * @param item - 要添加的商品
   */
  addItem: (item: Omit<ICartItem, 'quantity'> & { quantity?: number }) => void;
  
  /**
   * 从购物车移除商品
   * @param id - 商品ID
   */
  removeItem: (id: string) => void;
  
  /**
   * 更新商品数量
   * @param id - 商品ID
   * @param quantity - 新的数量
   */
  updateQuantity: (id: string, quantity: number) => void;
  
  /**
   * 清空购物车
   */
  clearCart: () => void;
  
  /**
   * 获取指定商品的数量
   * @param id - 商品ID
   * @returns 商品数量，如果不存在返回0
   */
  getItemQuantity: (id: string) => number;
}

type ICartStore = ICartState & ICartActions;

/**
 * 计算购物车总数量
 * @param items - 购物车商品列表
 * @returns 总数量
 */
const calculateTotalItems = (items: ICartItem[]): number => {
  return items.reduce((total, item) => total + item.quantity, 0);
};

/**
 * 计算购物车总价格
 * @param items - 购物车商品列表
 * @returns 总价格
 */
const calculateTotalPrice = (items: ICartItem[]): number => {
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
};

/**
 * 购物车状态管理 Store
 * 使用 zustand 创建，支持持久化存储
 */
export const useCartStore = create<ICartStore>()(
  persist(
    (set, get) => ({
      items: [],
      totalItems: 0,
      totalPrice: 0,

      addItem: (item) => {
        const { items } = get();
        const existingItemIndex = items.findIndex((i) => i.id === item.id);

        let newItems: ICartItem[];

        if (existingItemIndex > -1) {
          newItems = items.map((i, index) =>
            index === existingItemIndex
              ? { ...i, quantity: i.quantity + (item.quantity || 1) }
              : i
          );
        } else {
          const newItem: ICartItem = {
            ...item,
            quantity: item.quantity || 1,
          };
          newItems = [...items, newItem];
        }

        set({
          items: newItems,
          totalItems: calculateTotalItems(newItems),
          totalPrice: calculateTotalPrice(newItems),
        });
      },

      removeItem: (id) => {
        const { items } = get();
        const newItems = items.filter((item) => item.id !== id);

        set({
          items: newItems,
          totalItems: calculateTotalItems(newItems),
          totalPrice: calculateTotalPrice(newItems),
        });
      },

      updateQuantity: (id, quantity) => {
        const { items } = get();

        if (quantity <= 0) {
          get().removeItem(id);
          return;
        }

        const newItems = items.map((item) =>
          item.id === id ? { ...item, quantity } : item
        );

        set({
          items: newItems,
          totalItems: calculateTotalItems(newItems),
          totalPrice: calculateTotalPrice(newItems),
        });
      },

      clearCart: () => {
        set({
          items: [],
          totalItems: 0,
          totalPrice: 0,
        });
      },

      getItemQuantity: (id) => {
        const { items } = get();
        const item = items.find((i) => i.id === id);
        return item ? item.quantity : 0;
      },
    }),
    {
      name: 'cart-storage',
    }
  )
);