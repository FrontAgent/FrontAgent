import { useStore } from 'zustand';
import { cartStore } from '../store/cartStore';
import type { CartItem, Product } from '../types';

interface UseCartReturn {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  addToCartWithNotification: (product: Product, quantity?: number) => void;
}

export const useCart = (): UseCartReturn => {
  const items = useStore(cartStore, (state) => state.items);
  const totalItems = useStore(cartStore, (state) => state.totalItems);
  const totalPrice = useStore(cartStore, (state) => state.totalPrice);
  const addToCart = useStore(cartStore, (state) => state.addToCart);
  const removeFromCart = useStore(cartStore, (state) => state.removeFromCart);
  const updateQuantity = useStore(cartStore, (state) => state.updateQuantity);
  const clearCart = useStore(cartStore, (state) => state.clearCart);

  const addToCartWithNotification = (product: Product, quantity: number = 1) => {
    addToCart(product, quantity);
    
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('Added to Cart', {
          body: `${product.name} has been added to your cart`,
          icon: product.image,
        });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            new Notification('Added to Cart', {
              body: `${product.name} has been added to your cart`,
              icon: product.image,
            });
          }
        });
      }
    }

    const event = new CustomEvent('cart:item-added', {
      detail: { product, quantity },
    });
    window.dispatchEvent(event);
  };

  return {
    items,
    totalItems,
    totalPrice,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    addToCartWithNotification,
  };
};