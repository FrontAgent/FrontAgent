import React from 'react';
import { Link } from 'react-router-dom';

export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  description?: string;
}

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(price);
  };

  const truncateDescription = (text: string | undefined, maxLength: number = 80): string => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <Link to={`/product/${product.id}`} className="block">
      <div className="bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-105 h-full flex flex-col">
        <div className="relative w-full h-48 overflow-hidden bg-gray-100">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>
        
        <div className="p-4 flex-1 flex flex-col">
          <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2">
            {product.name}
          </h3>
          
          <p className="text-2xl font-bold text-blue-600 mb-3">
            {formatPrice(product.price)}
          </p>
          
          {product.description && (
            <p className="text-sm text-gray-600 mb-4 flex-1">
              {truncateDescription(product.description)}
            </p>
          )}
          
          <button className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded transition-colors duration-200">
            查看详情
          </button>
        </div>
      </div>
    </Link>
  );
};