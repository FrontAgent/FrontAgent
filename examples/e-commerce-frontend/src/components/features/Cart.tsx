import React from 'react';
import { useCartStore } from '@/stores/useCartStore';
import { Button } from '@/components/ui/Button';
import { ICartItem } from '@/types/ICartItem';

/**
 * 购物车组件
 * 显示购物车商品列表、数量调整、价格计算、结算按钮等功能
 */
export const Cart: React.FC = () => {
  const { items, removeItem, updateQuantity, clearCart, getTotalPrice, getTotalItems } = useCartStore();

  /**
   * 处理数量增加
   * @param id 商品ID
   */
  const handleIncrease = (id: string) => {
    const item = items.find(item => item.id === id);
    if (item) {
      updateQuantity(id, item.quantity + 1);
    }
  };

  /**
   * 处理数量减少
   * @param id 商品ID
   */
  const handleDecrease = (id: string) => {
    const item = items.find(item => item.id === id);
    if (item && item.quantity > 1) {
      updateQuantity(id, item.quantity - 1);
    }
  };

  /**
   * 处理移除商品
   * @param id 商品ID
   */
  const handleRemove = (id: string) => {
    removeItem(id);
  };

  /**
   * 处理结算
   */
  const handleCheckout = () => {
    // TODO: 实现结算逻辑
    console.log('Proceeding to checkout...');
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-gray-500 text-lg mb-4">购物车是空的</div>
        <Button variant="outline" onClick={() => window.history.back()}>
          继续购物
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">购物车</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 商品列表 */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6">
            {items.map((item: ICartItem) => (
              <div key={item.id} className="flex items-center py-4 border-b last:border-b-0">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-20 h-20 object-cover rounded-md mr-4"
                />
                
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800">{item.name}</h3>
                  <p className="text-gray-600 text-sm">{item.description}</p>
                  <p className="text-lg font-bold text-blue-600 mt-1">
                    ¥{item.price.toFixed(2)}
                  </p>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleDecrease(item.id)}
                    className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                    aria-label="减少数量"
                  >
                    -
                  </button>
                  <span className="w-12 text-center font-medium">{item.quantity}</span>
                  <button
                    onClick={() => handleIncrease(item.id)}
                    className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                    aria-label="增加数量"
                  >
                    +
                  </button>
                </div>
                
                <button
                  onClick={() => handleRemove(item.id)}
                  className="ml-4 text-red-500 hover:text-red-700 transition-colors"
                  aria-label="移除商品"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
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
                <span className="text-gray-600">商品数量</span>
                <span className="font-medium">{getTotalItems()} 件</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">商品总价</span>
                <span className="font-medium">¥{getTotalPrice().toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">运费</span>
                <span className="font-medium">¥0.00</span>
              </div>
              <div className="border-t pt-3">
                <div className="flex justify-between text-lg font-bold">
                  <span>总计</span>
                  <span className="text-blue-600">¥{getTotalPrice().toFixed(2)}</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <Button
                onClick={handleCheckout}
                className="w-full"
                size="lg"
              >
                去结算
              </Button>
              
              <Button
                variant="outline"
                onClick={clearCart}
                className="w-full"
              >
                清空购物车
              </Button>
              
              <Button
                variant="ghost"
                onClick={() => window.history.back()}
                className="w-full"
              >
                继续购物
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};