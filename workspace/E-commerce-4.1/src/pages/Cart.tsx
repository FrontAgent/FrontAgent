import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../hooks/useCart';

export const Cart: React.FC = () => {
  const navigate = useNavigate();
  const { items, updateQuantity, removeFromCart, getTotalPrice } = useCart();

  const handleQuantityChange = (productId: number, change: number) => {
    const item = items.find(i => i.product.id === productId);
    if (item) {
      const newQuantity = item.quantity + change;
      if (newQuantity > 0) {
        updateQuantity(productId, newQuantity);
      }
    }
  };

  const handleRemove = (productId: number) => {
    removeFromCart(productId);
  };

  const handleContinueShopping = () => {
    navigate('/');
  };

  const handleCheckout = () => {
    navigate('/checkout');
  };

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <svg
            className="mx-auto h-24 w-24 text-gray-400 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
            />
          </svg>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">购物车是空的</h2>
          <p className="text-gray-600 mb-8">还没有添加任何商品，去挑选喜欢的商品吧！</p>
          <button
            onClick={handleContinueShopping}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            开始购物
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">购物车</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {items.map((item) => (
              <div
                key={item.product.id}
                className="flex flex-col sm:flex-row items-center gap-4 p-6 border-b last:border-b-0 hover:bg-gray-50 transition-colors"
              >
                <img
                  src={item.product.image}
                  alt={item.product.name}
                  className="w-24 h-24 object-cover rounded-lg"
                />
                
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {item.product.name}
                  </h3>
                  <p className="text-gray-600 text-sm mb-2">{item.product.category}</p>
                  <p className="text-blue-600 font-bold text-lg">
                    ¥{item.product.price.toFixed(2)}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center border border-gray-300 rounded-lg">
                    <button
                      onClick={() => handleQuantityChange(item.product.id, -1)}
                      className="px-3 py-2 hover:bg-gray-100 transition-colors"
                      aria-label="减少数量"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </button>
                    <span className="px-4 py-2 font-semibold min-w-[3rem] text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => handleQuantityChange(item.product.id, 1)}
                      className="px-3 py-2 hover:bg-gray-100 transition-colors"
                      aria-label="增加数量"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>

                  <button
                    onClick={() => handleRemove(item.product.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    aria-label="删除商品"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>

                <div className="text-right min-w-[6rem]">
                  <p className="text-lg font-bold text-gray-900">
                    ¥{(item.product.price * item.quantity).toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">订单摘要</h2>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-gray-600">
                <span>商品数量</span>
                <span>{items.reduce((sum, item) => sum + item.quantity, 0)} 件</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>小计</span>
                <span>¥{getTotalPrice().toFixed(2)}</span>
              </div>
              <div className="border-t pt-3">
                <div className="flex justify-between text-lg font-bold text-gray-900">
                  <span>总计</span>
                  <span className="text-blue-600">¥{getTotalPrice().toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleCheckout}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                去结算
              </button>
              <button
                onClick={handleContinueShopping}
                className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200 transition-colors font-semibold"
              >
                继续购物
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};