import React from 'react';
import { useCartStore } from '../../store/cartStore';

export const CartSummary: React.FC = () => {
  const { getSelectedItems, getTotalPrice, getSelectedCount } = useCartStore();
  
  const selectedItems = getSelectedItems();
  const selectedCount = getSelectedCount();
  const subtotal = getTotalPrice();
  
  // 计算原价总额（用于显示优惠）
  const originalTotal = selectedItems.reduce((sum, item) => {
    return sum + item.price * item.quantity;
  }, 0);
  
  // 优惠金额
  const discount = originalTotal - subtotal;
  
  // 运费逻辑：满99免运费，否则10元
  const shippingThreshold = 99;
  const shippingFee = subtotal >= shippingThreshold ? 0 : (selectedCount > 0 ? 10 : 0);
  const freeShippingDiff = shippingThreshold - subtotal;
  
  // 应付总额
  const totalAmount = subtotal + shippingFee;
  
  const handleCheckout = () => {
    if (selectedCount === 0) return;
    // 跳转到结算页面
    window.location.href = '/checkout';
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
      <h2 className="text-lg font-semibold text-gray-800 mb-4 pb-3 border-b border-gray-200">
        订单汇总
      </h2>
      
      <div className="space-y-3">
        {/* 已选商品数量 */}
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">已选商品</span>
          <span className="text-gray-800 font-medium">{selectedCount} 件</span>
        </div>
        
        {/* 商品总价 */}
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">商品总价</span>
          <span className="text-gray-800">¥{subtotal.toFixed(2)}</span>
        </div>
        
        {/* 优惠金额 */}
        {discount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">优惠金额</span>
            <span className="text-red-500">-¥{discount.toFixed(2)}</span>
          </div>
        )}
        
        {/* 运费信息 */}
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">运费</span>
          {shippingFee === 0 ? (
            <span className="text-green-600">免运费</span>
          ) : (
            <span className="text-gray-800">¥{shippingFee.toFixed(2)}</span>
          )}
        </div>
        
        {/* 免运费提示 */}
        {selectedCount > 0 && freeShippingDiff > 0 && (
          <div className="bg-yellow-50 text-yellow-700 text-xs p-2 rounded-md">
            再买 ¥{freeShippingDiff.toFixed(2)} 即可免运费
          </div>
        )}
      </div>
      
      {/* 分割线 */}
      <div className="border-t border-gray-200 my-4"></div>
      
      {/* 应付总额 */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-gray-800 font-medium">应付总额</span>
        <div className="text-right">
          <span className="text-2xl font-bold text-red-500">
            ¥{totalAmount.toFixed(2)}
          </span>
        </div>
      </div>
      
      {/* 去结算按钮 */}
      <button
        onClick={handleCheckout}
        disabled={selectedCount === 0}
        className={`w-full py-3 rounded-lg font-medium text-white transition-all duration-200 ${
          selectedCount === 0
            ? 'bg-gray-300 cursor-not-allowed'
            : 'bg-red-500 hover:bg-red-600 active:bg-red-700 shadow-md hover:shadow-lg'
        }`}
      >
        {selectedCount === 0 ? '请选择商品' : `去结算 (${selectedCount})`}
      </button>
      
      {/* 安全提示 */}
      <div className="mt-4 flex items-center justify-center text-xs text-gray-400">
        <svg 
          className="w-4 h-4 mr-1" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
          />
        </svg>
        安全支付保障
      </div>
    </div>
  );
};