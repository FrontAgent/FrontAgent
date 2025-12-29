import React from 'react';
import { Product } from '../types';
import { Button } from './Button';

interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [imageError, setImageError] = React.useState(false);

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY'
    }).format(price);
  };

  const handleAddToCart = () => {
    if (onAddToCart && product.stock > 0) {
      onAddToCart(product);
    }
  };

  return (
    <div className="group bg-white rounded-lg shadow-md overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
      <div className="relative aspect-square overflow-hidden bg-gray-100">
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        {imageError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
            <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        ) : (
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-110 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        )}
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <span className="text-white text-lg font-bold px-4 py-2 bg-red-600 rounded">售罄</span>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-5">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 line-clamp-1 group-hover:text-blue-600 transition-colors">
          {product.name}
        </h3>
        
        <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4 line-clamp-2 min-h-[2.5rem] sm:min-h-[3rem]">
          {product.description}
        </p>

        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className="flex flex-col">
            <span className="text-xl sm:text-2xl font-bold text-red-600">
              {formatPrice(product.price)}
            </span>
          </div>
          
          <div className="text-right">
            {product.stock > 0 ? (
              <span className={`text-xs sm:text-sm ${product.stock < 10 ? 'text-orange-600' : 'text-gray-600'}`}>
                库存: {product.stock}
              </span>
            ) : (
              <span className="text-xs sm:text-sm text-red-600 font-medium">
                已售罄
              </span>
            )}
          </div>
        </div>

        <Button
          onClick={handleAddToCart}
          disabled={product.stock === 0}
          className="w-full"
        >
          {product.stock === 0 ? '已售罄' : '加入购物车'}
        </Button>
      </div>
    </div>
  );
};