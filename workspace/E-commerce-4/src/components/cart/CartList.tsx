import React from 'react';
import { Link } from 'react-router-dom';
import { useCartStore } from '../../store/cartStore';
import { CartItem } from './CartItem';

const CartList: React.FC = () => {
  const { items, selectAll, clearCart, getSelectedItems, updateQuantity, removeItem, toggleItemSelection } = useCartStore();

  const allSelected = items.length > 0 && items.every(item => item.selected);
  const hasSelectedItems = items.some(item => item.selected);
  const selectedItems = getSelectedItems();

  const handleSelectAll = () => {
    selectAll(!allSelected);
  };

  const handleDeleteSelected = () => {
    if (selectedItems.length === 0) return;
    
    if (window.confirm(`确定要删除选中的 ${selectedItems.length} 件商品吗？`)) {
      selectedItems.forEach(item => {
        useCartStore.getState().removeItem(item.id);
      });
    }
  };

  const handleClearCart = () => {
    if (window.confirm('确定要清空购物车吗？')) {
      clearCart();
    }
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-lg shadow-sm">
        <div className="w-32 h-32 mb-6 text-gray-300">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            className="w-full h-full"
          >
            <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-medium text-gray-600 mb-2">购物车是空的</h3>
        <p className="text-gray-400 mb-6">快去挑选心仪的商品吧~</p>
        <Link
          to="/products"
          className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          去购物
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* 表头 */}
      <div className="hidden md:grid md:grid-cols-12 gap-4 px-6 py-4 bg-gray-50 border-b border-gray-200 rounded-t-lg">
        <div className="col-span-1 flex items-center">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={handleSelectAll}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-600">全选</span>
          </label>
        </div>
        <div className="col-span-5 text-sm text-gray-600">商品信息</div>
        <div className="col-span-2 text-sm text-gray-600 text-center">单价</div>
        <div className="col-span-2 text-sm text-gray-600 text-center">数量</div>
        <div className="col-span-1 text-sm text-gray-600 text-center">小计</div>
        <div className="col-span-1 text-sm text-gray-600 text-center">操作</div>
      </div>

      {/* 移动端全选 */}
      <div className="md:hidden px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={handleSelectAll}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="ml-2 text-sm text-gray-600">全选</span>
        </label>
        <span className="text-sm text-gray-500">共 {items.length} 件商品</span>
      </div>

      {/* 商品列表 */}
      <div className="divide-y divide-gray-100">
        {items.map(item => (
          <CartItem
            key={item.id}
            id={item.id}
            productId={item.id}
            name={item.name}
            image={item.image}
            price={item.price}
            quantity={item.quantity}
            selected={item.selected ?? false}
            onQuantityChange={updateQuantity}
            onDelete={removeItem}
            onSelectChange={(id, _selected) => toggleItemSelection(id)}
          />
        ))}
      </div>

      {/* 底部操作栏 */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={handleSelectAll}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-600">全选</span>
          </label>
          <button
            onClick={handleDeleteSelected}
            disabled={!hasSelectedItems}
            className={`text-sm ${
              hasSelectedItems
                ? 'text-red-500 hover:text-red-600'
                : 'text-gray-400 cursor-not-allowed'
            }`}
          >
            删除选中 ({selectedItems.length})
          </button>
          <button
            onClick={handleClearCart}
            className="text-sm text-gray-500 hover:text-gray-600"
          >
            清空购物车
          </button>
        </div>
        <div className="text-sm text-gray-500">
          已选择 <span className="text-blue-600 font-medium">{selectedItems.length}</span> 件商品
        </div>
      </div>
    </div>
  );
};

export default CartList;