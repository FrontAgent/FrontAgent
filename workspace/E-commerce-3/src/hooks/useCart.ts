import { computed } from '@vue/reactivity';
import { cartStore } from '../store/cartStore';
import type { Product } from '../types';

interface UseCartReturn {
  items: typeof cartStore.items;
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartItemQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

export const useCart = (): UseCartReturn => {
  const totalItems = computed(() => {
    return cartStore.items.reduce((total, item) => total + item.quantity, 0);
  });

  const totalPrice = computed(() => {
    return cartStore.items.reduce((total, item) => {
      return total + item.product.price * item.quantity;
    }, 0);
  });

  const addToCart = (product: Product, quantity: number = 1): void => {
    if (quantity <= 0) {
      console.warn('Quantity must be greater than 0');
      return;
    }

    cartStore.addItem(product, quantity);
    
    const message = `${product.name} has been added to cart`;
    if (typeof window !== 'undefined' && 'toast' in window) {
      (window as any).toast?.success?.(message);
    } else {
      console.log(message);
    }
  };

  const removeFromCart = (productId: string): void => {
    const item = cartStore.items.find(item => item.product.id === productId);
    if (!item) {
      console.warn(`Product with id ${productId} not found in cart`);
      return;
    }

    cartStore.removeItem(productId);
    
    const message = `${item.product.name} has been removed from cart`;
    if (typeof window !== 'undefined' && 'toast' in window) {
      (window as any).toast?.info?.(message);
    } else {
      console.log(message);
    }
  };

  const updateCartItemQuantity = (productId: string, quantity: number): void => {
    if (quantity < 0) {
      console.warn('Quantity cannot be negative');
      return;
    }

    const item = cartStore.items.find(item => item.product.id === productId);
    if (!item) {
      console.warn(`Product with id ${productId} not found in cart`);
      return;
    }

    if (quantity === 0) {
      removeFromCart(productId);
      return;
    }

    const maxQuantity = item.product.stock || 999;
    const finalQuantity = Math.min(quantity, maxQuantity);

    if (finalQuantity !== quantity) {
      const message = `Maximum available quantity is ${maxQuantity}`;
      if (typeof window !== 'undefined' && 'toast' in window) {
        (window as any).toast?.warning?.(message);
      } else {
        console.warn(message);
      }
    }

    cartStore.updateItemQuantity(productId, finalQuantity);
  };

  const clearCart = (): void => {
    if (cartStore.items.length === 0) {
      const message = 'Cart is already empty';
      if (typeof window !== 'undefined' && 'toast' in window) {
        (window as any).toast?.info?.(message);
      } else {
        console.log(message);
      }
      return;
    }

    const confirmed = typeof window !== 'undefined' 
      ? window.confirm('Are you sure you want to clear the cart?')
      : true;

    if (confirmed) {
      cartStore.clearCart();
      
      const message = 'Cart has been cleared';
      if (typeof window !== 'undefined' && 'toast' in window) {
        (window as any).toast?.success?.(message);
      } else {
        console.log(message);
      }
    }
  };

  return {
    items: cartStore.items,
    addToCart,
    removeFromCart,
    updateCartItemQuantity,
    clearCart,
    totalItems: totalItems.value,
    totalPrice: totalPrice.value,
  };
};