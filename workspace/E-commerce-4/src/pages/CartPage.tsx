import React from 'react';
import { useCartStore, CartItem as CartItemType } from '../store/cartStore';
import { Link } from 'react-router-dom';

interface CartItemProps {
  item: CartItemType;
  selected: boolean;
  onSelect: () => void;
  onUpdateQuantity: (quantity: number) => void;
  onRemove: () => void;
}

const CartItemComponent: React.FC<CartItemProps> = ({
  item,
  selected,
  onSelect,
  onUpdateQuantity,
  onRemove,
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 flex items-center gap-4">
      <input
        type="checkbox"
        checked={selected}
        onChange={onSelect}
        className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
      />
      <img
        src={item.image}
        alt={item.name}
        className="w-20 h-20 object-cover rounded"
      />
      <div className="flex-1 min-w-0">
        <h3 className="text-gray-800 font-medium truncate">{item.name}</h3>
        <div className="text-sm text-gray-500 mt-1">
          {item.color && <span>颜色: {item.color}</span>}
          {item.size && <span className="ml-2">尺寸: {item.size}</span>}
        </div>
        <div className="text-red-500 font-semibold mt-1">¥{item.price.toFixed(2)}</div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onUpdateQuantity(Math.max(1, item.quantity - 1))}
          className="w-8 h-8 flex items-center justify-center border rounded text-gray-600 hover:bg-gray-100"
        >
          -
        </button>
        <span className="w-10 text-center">{item.quantity}</span>
        <button
          onClick={() => onUpdateQuantity(item.quantity + 1)}
          className="w-8 h-8 flex items-center justify-center border rounded text-gray-600 hover:bg-gray-100"
        >
          +
        </button>
      </div>
      <button
        onClick={onRemove}
        className="text-gray-400 hover:text-red-500 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
};

export const CartPage: React.FC = () => {
  const {
    items,
    updateQuantity,
    removeItem,
    clearCart,
    selectAll,
    toggleItemSelection,
    getSelectedItems,
    getSelectedCount,
  } = useCartStore();

  const selectedItems = getSelectedItems();
  const selectedCount = getSelectedCount();
  const allSelected = items.length > 0 && selectedItems.length === items.length;

  // 计算选中商品总价
  const selectedTotal = selectedItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  // 模拟优惠和运费
  const discount = selectedTotal > 200 ? 20 : 0;
  const shipping = selectedTotal > 99 ? 0 : 10;
  const finalTotal = selectedTotal - discount + (selectedCount > 0 ? shipping : 0);

  const handleToggleSelectAll = () => {
    selectAll(!allSelected);
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="text-center">
          <div className="w-32 h-32 mx-auto mb-6 bg-gray-200 rounded-full flex items-center justify-center">
            <svg
              className="w-16 h-16 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">购物车是空的</h2>
          <p className="text-gray-500 mb-6">快去挑选心仪的商品吧！</p>
          <Link
            to="/"
            className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            去逛逛
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* 头部 */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-800">
              购物车 <span className="text-gray-500 text-base">({items.length})</span>
            </h1>
            <button
              onClick={clearCart}
              className="text-sm text-gray-500 hover:text-red-500 transition-colors"
            >
              清空购物车
            </button>
          </div>
        </div>
      </div>

      {/* 购物车列表 */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        {/* 全选 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={handleToggleSelectAll}
              className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <span className="ml-3 text-gray-700">全选</span>
          </label>
        </div>

        {/* 商品列表 */}
        <div className="space-y-4">
          {items.map((item) => (
            <CartItemComponent
              key={item.id}
              item={item}
              selected={item.selected || false}
              onSelect={() => toggleItemSelection(item.id)}
              onUpdateQuantity={(quantity: number) => updateQuantity(item.id, quantity)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
        </div>
      </div>

      {/* 底部结算栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4">
          {/* 价格明细 */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
            <div>
              商品总价：<span className="text-gray-800">¥{selectedTotal.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div>
                优惠：<span className="text-red-500">-¥{discount.toFixed(2)}</span>
              </div>
            )}
            <div>
              运费：
              <span className={shipping === 0 ? 'text-green-500' : 'text-gray-800'}>
                {shipping === 0 ? '免运费' : `¥${shipping.toFixed(2)}`}
              </span>
            </div>
          </div>

          {/* 结算区域 */}
          <div className="flex items-center justify-between">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleToggleSelectAll}
                className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="ml-2 text-gray-700">全选</span>
            </label>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm text-gray-500">
                  已选 <span className="text-blue-600">{selectedCount}</span> 件
                </div>
                <div className="text-lg">
                  应付：
                  <span className="text-red-500 font-semibold text-xl">
                    ¥{selectedCount > 0 ? finalTotal.toFixed(2) : '0.00'}
                  </span>
                </div>
              </div>

              <Link
                to={selectedCount > 0 ? '/checkout' : '#'}
                className={`px-8 py-3 rounded-lg font-medium transition-colors ${
                  selectedCount > 0
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                onClick={(e) => {
                  if (selectedCount === 0) {
                    e.preventDefault();
                  }
                }}
              >
                去结算
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
