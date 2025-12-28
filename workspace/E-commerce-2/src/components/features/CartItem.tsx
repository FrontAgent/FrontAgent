import React from 'react';
import { useCartStore } from '@/stores/cartStore';
import { formatPrice } from '@/utils/format';
import type { CartItem as CartItemType } from '@/types';

/**
 * CartItem 组件
 * 
 * 购物车商品项组件，展示商品信息并提供数量调整和删除功能
 * 
 * @component
 * @param {Object} props - 组件属性
 * @param {CartItemType} props.cartItem - 购物车商品项数据
 * @returns {JSX.Element} 购物车商品项组件
 * 
 * @example
 * ```tsx
 * <CartItem cartItem={cartItem} />
 * ```
 */
interface CartItemProps {
  cartItem: CartItemType;
}

const CartItem: React.FC<CartItemProps> = ({ cartItem }) => {
  const { updateQuantity, removeFromCart } = useCartStore();

  const { product, quantity } = cartItem;
  const subtotal = product.price * quantity;

  /**
   * 处理数量增加
   */
  const handleIncrease = () => {
    updateQuantity(product.id, quantity + 1);
  };

  /**
   * 处理数量减少
   */
  const handleDecrease = () => {
    if (quantity > 1) {
      updateQuantity(product.id, quantity - 1);
    }
  };

  /**
   * 处理删除商品
   */
  const handleRemove = () => {
    removeFromCart(product.id);
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      {/* 商品图片 */}
      <div className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover rounded-md"
        />
      </div>

      {/* 商品信息 */}
      <div className="flex-1 min-w-0">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
          {product.name}
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          单价: {formatPrice(product.price)}
        </p>
      </div>

      {/* 数量调整 */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleDecrease}
          className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-300 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={quantity <= 1}
          aria-label="减少数量"
        >
          <span className="text-lg font-medium text-gray-700">−</span>
        </button>
        
        <span className="w-12 text-center text-base font-medium text-gray-900">
          {quantity}
        </span>
        
        <button
          onClick={handleIncrease}
          className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-300 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors"
          aria-label="增加数量"
        >
          <span className="text-lg font-medium text-gray-700">+</span>
        </button>
      </div>

      {/* 小计 */}
      <div className="hidden sm:block w-24 text-right">
        <p className="text-base font-semibold text-gray-900">
          {formatPrice(subtotal)}
        </p>
      </div>

      {/* 删除按钮 */}
      <button
        onClick={handleRemove}
        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
        aria-label="删除商品"
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

      {/* 移动端小计显示 */}
      <div className="sm:hidden w-full mt-2 pt-2 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">小计:</span>
          <span className="text-base font-semibold text-gray-900">
            {formatPrice(subtotal)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CartItem;