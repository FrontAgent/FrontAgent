import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../../stores/cartStore';
import { formatCurrency } from '../../utils/formatters';
import { Button } from '../ui/Button';

/**
 * CartSummary Component
 * 
 * Displays a summary of the shopping cart including:
 * - Subtotal of all items
 * - Shipping cost
 * - Tax amount
 * - Total amount
 * - Checkout button with navigation
 * 
 * @component
 * @example
 * ```tsx
 * <CartSummary />
 * ```
 */
const CartSummary: React.FC = () => {
  const navigate = useNavigate();
  const { items } = useCartStore();

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  
  const shipping = subtotal > 0 ? (subtotal >= 100 ? 0 : 10) : 0;
  
  const taxRate = 0.1;
  const tax = subtotal * taxRate;
  
  const total = subtotal + shipping + tax;

  const isEmpty = items.length === 0;

  const handleCheckout = () => {
    navigate('/checkout');
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">订单摘要</h2>
      
      <div className="space-y-3 mb-6">
        <div className="flex justify-between items-center text-gray-600">
          <span>商品小计</span>
          <span className="font-medium">{formatCurrency(subtotal)}</span>
        </div>
        
        <div className="flex justify-between items-center text-gray-600">
          <span>运费</span>
          <span className="font-medium">
            {shipping === 0 && subtotal > 0 ? (
              <span className="text-green-600">免运费</span>
            ) : (
              formatCurrency(shipping)
            )}
          </span>
        </div>
        
        <div className="flex justify-between items-center text-gray-600">
          <span>税费 (10%)</span>
          <span className="font-medium">{formatCurrency(tax)}</span>
        </div>
        
        <div className="border-t pt-3 mt-3">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-800">总计</span>
            <span className="text-2xl font-bold text-blue-600">
              {formatCurrency(total)}
            </span>
          </div>
        </div>
      </div>

      {subtotal > 0 && subtotal < 100 && (
        <div className="mb-4 p-3 bg-blue-50 rounded-md">
          <p className="text-sm text-blue-700">
            再购买 {formatCurrency(100 - subtotal)} 即可享受免运费
          </p>
        </div>
      )}

      <Button
        onClick={handleCheckout}
        disabled={isEmpty}
        className="w-full"
        variant="primary"
      >
        {isEmpty ? '购物车为空' : '去结账'}
      </Button>

      {isEmpty && (
        <p className="text-sm text-gray-500 text-center mt-3">
          请先添加商品到购物车
        </p>
      )}

      <div className="mt-6 pt-6 border-t">
        <div className="space-y-2 text-sm text-gray-500">
          <div className="flex items-start">
            <svg className="w-4 h-4 mr-2 mt-0.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>支持多种支付方式</span>
          </div>
          <div className="flex items-start">
            <svg className="w-4 h-4 mr-2 mt-0.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>7天无理由退换货</span>
          </div>
          <div className="flex items-start">
            <svg className="w-4 h-4 mr-2 mt-0.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>正品保证</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartSummary;