import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Product } from '../types';
import { Button } from './Button';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/product/${product.id}`);
  };

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <svg
          key={`full-${i}`}
          className="w-4 h-4 fill-yellow-400"
          viewBox="0 0 20 20"
        >
          <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
        </svg>
      );
    }

    if (hasHalfStar) {
      stars.push(
        <svg
          key="half"
          className="w-4 h-4 fill-yellow-400"
          viewBox="0 0 20 20"
        >
          <defs>
            <linearGradient id="half-fill">
              <stop offset="50%" stopColor="#FBBF24" />
              <stop offset="50%" stopColor="#D1D5DB" />
            </linearGradient>
          </defs>
          <path
            fill="url(#half-fill)"
            d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"
          />
        </svg>
      );
    }

    const emptyStars = 5 - stars.length;
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <svg
          key={`empty-${i}`}
          className="w-4 h-4 fill-gray-300"
          viewBox="0 0 20 20"
        >
          <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
        </svg>
      );
    }

    return stars;
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Add to cart:', product.id);
  };

  return (
    <div
      className="border rounded-lg shadow-md hover:shadow-lg transition-shadow p-4 cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="aspect-square mb-4 flex items-center justify-center bg-gray-50 rounded-lg overflow-hidden">
        <img
          src={product.image}
          alt={product.title}
          className="aspect-square object-contain w-full h-full"
        />
      </div>

      <h3 className="truncate font-semibold mb-2 text-gray-800">
        {product.title}
      </h3>

      <div className="text-lg font-bold text-blue-600 mb-2">
        ${product.price.toFixed(2)}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-1">
          {renderStars(product.rating.rate)}
        </div>
        <span className="text-sm text-gray-600">
          {product.rating.rate.toFixed(1)} ({product.rating.count})
        </span>
      </div>

      <Button onClick={handleAddToCart} className="w-full">
        Add to Cart
      </Button>
    </div>
  );
};