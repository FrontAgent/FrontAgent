import { useCallback } from 'react';
import { useCartStore } from '../stores/useCartStore';
import type { Product } from '../types';

/**
 * 购物车自定义 Hook
 * 提供购物车状态管理和操作方法
 * @returns 购物车状态和操作方法
 */
export const useCart = () => {
  const {
    items,
    addItem,
    removeItem,
    updateQuantity,
    clearItems,
  } = useCartStore();

  /**
   * 计算购物车商品总数量
   */
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  /**
   * 计算购物车总价格
   */
  const totalPrice = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  /**
   * 添加商品到购物车
   * @param product - 产品信息
   * @param quantity - 数量，默认为1
   */
  const addToCart = useCallback(
    (product: Product, quantity: number = 1) => {
      addItem({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity,
      });
    },
    [addItem]
  );

  /**
   * 从购物车移除商品
   * @param productId - 产品ID
   */
  const removeFromCart = useCallback(
    (productId: string) => {
      removeItem(productId);
    },
    [removeItem]
  );

  /**
   * 更新购物车商品数量
   * @param productId - 产品ID
   * @param quantity - 新数量
   */
  const updateItemQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (quantity <= 0) {
        removeItem(productId);
      } else {
        updateQuantity(productId, quantity);
      }
    },
    [updateQuantity, removeItem]
  );

  /**
   * 清空购物车
   */
  const clearCart = useCallback(() => {
    clearItems();
  }, [clearItems]);

  /**
   * 检查商品是否在购物车中
   * @param productId - 产品ID
   * @returns 是否在购物车中
   */
  const isInCart = useCallback(
    (productId: string): boolean => {
      return items.some((item) => item.id === productId);
    },
    [items]
  );

  return {
    items,
    totalItems,
    totalPrice,
    addToCart,
    removeFromCart,
    updateItemQuantity,
    clearCart,
    isInCart,
  };
};