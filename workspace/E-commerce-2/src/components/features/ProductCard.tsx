import React from 'react';
import { Link } from 'react-router-dom';
import { useCartStore } from '../../stores/cartStore';
import { Product } from '../../types';

/**
 * ProductCard 组件
 * 
 * 展示单个产品的卡片组件，包含产品图片、名称、价格和加入购物车功能
 * 
 * @component
 * @example
 * ```tsx
 * <ProductCard product={productData} />
 * ```
 */

interface ProductCardProps {
  /** 产品对象，包含产品的所有信息 */
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const addToCart = useCartStore((state) => state.addToCart);

  /**
   * 处理加入购物车按钮点击事件
   * @param e - 鼠标事件对象
   */
  const handleAddToCart = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product);
  };

  /**
   * 格式化价格显示
   * @param price - 产品价格
   * @returns 格式化后的价格字符串
   */
  const formatPrice = (price: number): string => {
    return `$${price.toFixed(2)}`;
  };

  return (
    <Link
      to={`/product/${product.id}`}
      className="group block bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden"
    >
      <div className="relative aspect-square overflow-hidden bg-gray-100">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        {product.discount && (
          <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-md text-sm font-semibold">
            -{product.discount}%
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
          {product.name}
        </h3>

        {product.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {product.description}
          </p>
        )}

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">
              {formatPrice(product.price)}
            </span>
            {product.originalPrice && product.originalPrice > product.price && (
              <span className="text-sm text-gray-500 line-through">
                {formatPrice(product.originalPrice)}
              </span>
            )}
          </div>

          {product.rating && (
            <div className="flex items-center gap-1">
              <svg
                className="w-4 h-4 text-yellow-400 fill-current"
                viewBox="0 0 20 20"
              >
                <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
              </svg>
              <span className="text-sm text-gray-600">{product.rating}</span>
            </div>
          )}
        </div>

        {product.stock !== undefined && (
          <div className="mb-3">
            {product.stock > 0 ? (
              <span className="text-xs text-green-600 font-medium">
                In Stock ({product.stock} available)
              </span>
            ) : (
              <span className="text-xs text-red-600 font-medium">
                Out of Stock
              </span>
            )}
          </div>
        )}

        <button
          onClick={handleAddToCart}
          disabled={product.stock === 0}
          className={`w-full py-2 px-4 rounded-md font-medium transition-colors duration-200 ${
            product.stock === 0
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
          }`}
        >
          {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
        </button>
      </div>
    </Link>
  );
};

export default ProductCard;