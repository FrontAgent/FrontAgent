import React from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Plus, Minus } from 'lucide-react';

interface CartItemProps {
  id: string;
  productId: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  specs?: Record<string, string>;
  selected: boolean;
  onQuantityChange: (id: string, quantity: number) => void;
  onDelete: (id: string) => void;
  onSelectChange: (id: string, selected: boolean) => void;
}

export const CartItem: React.FC<CartItemProps> = ({
  id,
  productId,
  name,
  image,
  price,
  quantity,
  specs,
  selected,
  onQuantityChange,
  onDelete,
  onSelectChange,
}) => {
  const subtotal = price * quantity;

  const handleQuantityDecrease = () => {
    if (quantity > 1) {
      onQuantityChange(id, quantity - 1);
    }
  };

  const handleQuantityIncrease = () => {
    onQuantityChange(id, quantity + 1);
  };

  const handleQuantityInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1) {
      onQuantityChange(id, value);
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSelectChange(id, e.target.checked);
  };

  const formatSpecs = () => {
    if (!specs || Object.keys(specs).length === 0) return null;
    return Object.entries(specs)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      {/* 选中复选框 */}
      <div className="flex-shrink-0">
        <input
          type="checkbox"
          checked={selected}
          onChange={handleCheckboxChange}
          className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
        />
      </div>

      {/* 商品缩略图 */}
      <div className="flex-shrink-0">
        <Link to={`/product/${productId}`}>
          <img
            src={image}
            alt={name}
            className="w-20 h-20 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity"
          />
        </Link>
      </div>

      {/* 商品信息 */}
      <div className="flex-1 min-w-0">
        <Link
          to={`/product/${productId}`}
          className="text-gray-800 font-medium hover:text-blue-600 transition-colors line-clamp-2"
        >
          {name}
        </Link>
        {formatSpecs() && (
          <p className="mt-1 text-sm text-gray-500 truncate">{formatSpecs()}</p>
        )}
      </div>

      {/* 单价 */}
      <div className="flex-shrink-0 w-24 text-center">
        <span className="text-gray-600">¥{price.toFixed(2)}</span>
      </div>

      {/* 数量调整器 */}
      <div className="flex-shrink-0 flex items-center border border-gray-300 rounded-lg overflow-hidden">
        <button
          onClick={handleQuantityDecrease}
          disabled={quantity <= 1}
          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Minus className="w-4 h-4" />
        </button>
        <input
          type="text"
          value={quantity}
          onChange={handleQuantityInput}
          className="w-12 h-8 text-center border-x border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          onClick={handleQuantityIncrease}
          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* 小计金额 */}
      <div className="flex-shrink-0 w-28 text-center">
        <span className="text-red-500 font-semibold">¥{subtotal.toFixed(2)}</span>
      </div>

      {/* 删除按钮 */}
      <div className="flex-shrink-0">
        <button
          onClick={() => onDelete(id)}
          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
          title="删除"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};