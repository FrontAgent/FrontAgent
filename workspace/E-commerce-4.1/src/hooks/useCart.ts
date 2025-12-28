import { useCallback } from 'react';
import { cartStore } from '../store/cartStore';
import type { CartItem, Product } from '../types';

interface UseCartReturn {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  isInCart: (productId: string) => boolean;
  getItemQuantity: (productId: string) => number;
}

export const useCart = (): UseCartReturn => {
  const items = cartStore((state) => state.items);
  const totalItems = cartStore((state) => state.totalItems);
  const totalPrice = cartStore((state) => state.totalPrice);
  const addItem = cartStore((state) => state.addItem);
  const removeItem = cartStore((state) => state.removeItem);
  const updateQuantity = cartStore((state) => state.updateQuantity);
  const clearCart = cartStore((state) => state.clearCart);

  const isInCart = useCallback(
    (productId: string): boolean => {
      return items.some((item) => item.product.id === productId);
    },
    [items]
  );

  const getItemQuantity = useCallback(
    (productId: string): number => {
      const item = items.find((item) => item.product.id === productId);
      return item ? item.quantity : 0;
    },
    [items]
  );

  return {
    items,
    totalItems,
    totalPrice,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    isInCart,
    getItemQuantity,
  };
};