import React from 'react';
import { useCartStore } from '../../stores/useCartStore';
import { Button } from '../ui/Button';
import { ICartItem } from '../../types/ICartItem';

/**
 * Cart component displays shopping cart items with quantity controls and total price
 */
export const Cart: React.FC = () => {
  const { items, removeItem, updateQuantity, getTotalPrice, clearCart } = useCartStore();

  const handleQuantityChange = (id: string, newQuantity: number) => {
    if (newQuantity > 0) {
      updateQuantity(id, newQuantity);
    }
  };

  const handleRemoveItem = (id: string) => {
    removeItem(id);
  };

  const handleClearCart = () => {
    clearCart();
  };

  if (items.length === 0) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-2xl font-semibold mb-4">Your Cart</h2>
        <p className="text-gray-600">Your cart is empty</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Your Cart</h2>
        <Button
          onClick={handleClearCart}
          variant="secondary"
          size="sm"
        >
          Clear Cart
        </Button>
      </div>

      <div className="space-y-4">
        {items.map((item: ICartItem) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-4 border rounded-lg"
          >
            <div className="flex items-center space-x-4">
              <img
                src={item.image}
                alt={item.name}
                className="w-16 h-16 object-cover rounded"
              />
              <div>
                <h3 className="font-medium">{item.name}</h3>
                <p className="text-gray-600">${item.price.toFixed(2)}</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Button
                  onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                  variant="outline"
                  size="sm"
                  disabled={item.quantity <= 1}
                >
                  -
                </Button>
                <span className="w-8 text-center">{item.quantity}</span>
                <Button
                  onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                  variant="outline"
                  size="sm"
                >
                  +
                </Button>
              </div>

              <div className="w-24 text-right">
                <p className="font-medium">
                  ${(item.price * item.quantity).toFixed(2)}
                </p>
              </div>

              <Button
                onClick={() => handleRemoveItem(item.id)}
                variant="danger"
                size="sm"
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-6 border-t">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-gray-600">Total Items: {items.reduce((sum, item) => sum + item.quantity, 0)}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">
              Total: ${getTotalPrice().toFixed(2)}
            </p>
            <Button
              variant="primary"
              size="lg"
              className="mt-2"
            >
              Proceed to Checkout
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};