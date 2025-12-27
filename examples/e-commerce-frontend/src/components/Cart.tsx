import React from 'react';
import { useCartStore } from '../stores/useCartStore';
import { ICartItem } from '../types/ICartItem';

/**
 * Cart component displays shopping cart items with quantity modification and deletion
 */
export const Cart: React.FC = () => {
  const { items, updateQuantity, removeItem, getTotalPrice } = useCartStore();

  const handleQuantityChange = (id: string, newQuantity: number) => {
    if (newQuantity > 0) {
      updateQuantity(id, newQuantity);
    }
  };

  const handleRemoveItem = (id: string) => {
    removeItem(id);
  };

  if (items.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Your cart is empty</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Shopping Cart</h2>
      
      <div className="space-y-4">
        {items.map((item: ICartItem) => (
          <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center space-x-4">
              <img 
                src={item.image} 
                alt={item.name}
                className="w-16 h-16 object-cover rounded"
              />
              <div>
                <h3 className="font-semibold">{item.name}</h3>
                <p className="text-gray-600">${item.price.toFixed(2)}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                  className="px-2 py-1 border rounded hover:bg-gray-100"
                >
                  -
                </button>
                <span className="w-8 text-center">{item.quantity}</span>
                <button
                  onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                  className="px-2 py-1 border rounded hover:bg-gray-100"
                >
                  +
                </button>
              </div>
              
              <div className="w-24 text-right">
                ${(item.price * item.quantity).toFixed(2)}
              </div>
              
              <button
                onClick={() => handleRemoveItem(item.id)}
                className="px-3 py-1 text-red-600 hover:bg-red-50 rounded"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-6 pt-6 border-t">
        <div className="flex justify-between items-center">
          <span className="text-xl font-semibold">Total:</span>
          <span className="text-2xl font-bold">${getTotalPrice().toFixed(2)}</span>
        </div>
        
        <button className="mt-4 w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors">
          Proceed to Checkout
        </button>
      </div>
    </div>
  );
};