import React from 'react';
import { Link } from 'react-router-dom';
import { Product } from '../../types';

interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  const hasDiscount = product.discountPrice && product.discountPrice < product.price;
  const discountPercentage = hasDiscount
    ? Math.round((1 - product.discountPrice! / product.price) * 100)
    : 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onAddToCart && product.stock > 0) {
      onAddToCart(product);
    }
  };

  return (
    <Link
      to={`/product/${product.id}`}
      className="group block bg-white rounded-lg shadow-md overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
    >
      <div className="relative aspect-square overflow-hidden bg-gray-100">
        <img
          src={product.images?.[0] || product.image || '/placeholder-product.png'}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        
        {hasDiscount && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
            -{discountPercentage}%
          </span>
        )}
        
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <span className="text-white font-semibold text-lg">缺货</span>
          </div>
        )}
        
        {product.stock > 0 && product.stock <= 5 && (
          <span className="absolute top-2 right-2 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded">
            仅剩 {product.stock} 件
          </span>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-gray-800 font-medium text-sm sm:text-base line-clamp-2 min-h-[2.5rem] mb-2 group-hover:text-blue-600 transition-colors">
          {product.name}
        </h3>

        <div className="flex items-baseline gap-2 mb-3">
          {hasDiscount ? (
            <>
              <span className="text-red-600 font-bold text-lg">
                ¥{product.discountPrice!.toFixed(2)}
              </span>
              <span className="text-gray-400 text-sm line-through">
                ¥{product.price.toFixed(2)}
              </span>
            </>
          ) : (
            <span className="text-gray-800 font-bold text-lg">
              ¥{product.price.toFixed(2)}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span
            className={`text-xs px-2 py-1 rounded ${
              product.stock > 5
                ? 'bg-green-100 text-green-700'
                : product.stock > 0
                ? 'bg-orange-100 text-orange-700'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {product.stock > 5 ? '有货' : product.stock > 0 ? `仅剩${product.stock}件` : '缺货'}
          </span>

          <button
            onClick={handleAddToCart}
            disabled={product.stock === 0}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
              product.stock > 0
                ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <span className="hidden sm:inline">加入购物车</span>
          </button>
        </div>
      </div>
    </Link>
  );
};