import React from 'react';
import { useCartStore } from '../stores/useCartStore';
import { CartItem } from '../types/ICartItem';
import { formatPrice } from '../utils/formatPrice';

/**
 * 购物车页面组件
 * 提供完整的购物车管理功能，包括商品展示、数量调整、删除和结算
 */
export const Cart: React.FC = () => {
  const { items, removeItem, updateQuantity, clearCart, getTotalPrice } = useCartStore();

  /**
   * 处理商品数量变更
   * @param id 商品ID
   * @param quantity 新数量
   */
  const handleQuantityChange = (id: string, quantity: number): void => {
    if (quantity > 0) {
      updateQuantity(id, quantity);
    }
  };

  /**
   * 处理商品移除
   * @param id 商品ID
   */
  const handleRemoveItem = (id: string): void => {
    removeItem(id);
  };

  /**
   * 处理清空购物车
   */
  const handleClearCart = (): void => {
    clearCart();
  };

  /**
   * 处理结算
   */
  const handleCheckout = (): void => {
    // TODO: 实现结算逻辑
    alert('结算功能开发中...');
  };

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">购物车</h1>
        <div className="text-center py-16">
          <p className="text-gray-500 text-lg mb-4">您的购物车是空的</p>
          <button className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 transition-colors">
            继续购物
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">购物车</h1>
        <button
          onClick={handleClearCart}
          className="text-red-500 hover:text-red-600 transition-colors"
        >
          清空购物车
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 购物车商品列表 */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6">
            {items.map((item: CartItem) => (
              <div
                key={item.id}
                className="flex items-center justify-between py-4 border-b last:border-b-0"
              >
                <div className="flex items-center space-x-4">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-20 h-20 object-cover rounded"
                  />
                  <div>
                    <h3 className="font-semibold text-lg">{item.name}</h3>
                    <p className="text-gray-500">{item.description}</p>
                    <p className="text-blue-500 font-semibold mt-1">
                      {formatPrice(item.price)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  {/* 数量调整 */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                      className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors"
                    >
                      -
                    </button>
                    <span className="w-12 text-center">{item.quantity}</span>
                    <button
                      onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                      className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors"
                    >
                      +
                    </button>
                  </div>

                  {/* 小计 */}
                  <div className="w-24 text-right">
                    <p className="font-semibold">
                      {formatPrice(item.price * item.quantity)}
                    </p>
                  </div>

                  {/* 删除按钮 */}
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    className="text-red-500 hover:text-red-600 transition-colors"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 订单摘要 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
            <h2 className="text-xl font-semibold mb-4">订单摘要</h2>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-600">商品总数</span>
                <span>{items.reduce((sum, item) => sum + item.quantity, 0)} 件</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">商品总价</span>
                <span>{formatPrice(getTotalPrice())}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">运费</span>
                <span>免运费</span>
              </div>
              <div className="border-t pt-3">
                <div className="flex justify-between font-semibold text-lg">
                  <span>总计</span>
                  <span className="text-blue-500">{formatPrice(getTotalPrice())}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              className="w-full bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600 transition-colors font-semibold"
            >
              去结算
            </button>

            <div className="mt-4 text-center">
              <button className="text-blue-500 hover:text-blue-600 transition-colors">
                继续购物
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};