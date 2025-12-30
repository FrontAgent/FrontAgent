import { useCallback } from 'react';
import { useCartStore } from '../store/cartStore';
import { toast } from 'react-hot-toast';
import type { Product } from '../types';

interface UseCartReturn {
  items: Array<{
    product: Product;
    quantity: number;
  }>;
  totalItems: number;
  totalPrice: number;
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  isInCart: (productId: string) => boolean;
  getItemQuantity: (productId: string) => number;
}

export const useCart = (): UseCartReturn => {
  const { items, addItem, removeItem, updateItemQuantity, clearCart } = useCartStore();

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const addToCart = useCallback((product: Product, quantity: number = 1) => {
    try {
      addItem(product, quantity);
      toast.success(`${product.name} 已添加到购物车`);
    } catch (error) {
      toast.error('添加到购物车失败，请重试');
      console.error('Add to cart error:', error);
    }
  }, [addItem]);

  const removeFromCart = useCallback((productId: string) => {
    try {
      const item = items.find(i => i.product.id === productId);
      removeItem(productId);
      if (item) {
        toast.success(`${item.product.name} 已从购物车移除`);
      }
    } catch (error) {
      toast.error('移除商品失败，请重试');
      console.error('Remove from cart error:', error);
    }
  }, [items, removeItem]);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    try {
      if (quantity <= 0) {
        removeFromCart(productId);
        return;
      }
      updateItemQuantity(productId, quantity);
      toast.success('数量已更新');
    } catch (error) {
      toast.error('更新数量失败，请重试');
      console.error('Update quantity error:', error);
    }
  }, [updateItemQuantity, removeFromCart]);

  const handleClearCart = useCallback(() => {
    try {
      clearCart();
      toast.success('购物车已清空');
    } catch (error) {
      toast.error('清空购物车失败，请重试');
      console.error('Clear cart error:', error);
    }
  }, [clearCart]);

  const isInCart = useCallback((productId: string): boolean => {
    return items.some(item => item.product.id === productId);
  }, [items]);

  const getItemQuantity = useCallback((productId: string): number => {
    const item = items.find(i => i.product.id === productId);
    return item ? item.quantity : 0;
  }, [items]);

  return {
    items,
    totalItems,
    totalPrice,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart: handleClearCart,
    isInCart,
    getItemQuantity,
  };
};