import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './Button';

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  id,
  name,
  price,
  image,
  description,
}) => {
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/product/${id}`);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Add to cart:', id);
  };

  const handleViewDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/product/${id}`);
  };

  return (
    <div
      onClick={handleCardClick}
      className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 cursor-pointer overflow-hidden flex flex-col h-full"
    >
      <div className="relative w-full pt-[100%] overflow-hidden">
        <img
          src={image}
          alt={name}
          className="absolute top-0 left-0 w-full h-full object-cover hover:scale-105 transition-transform duration-300"
        />
      </div>
      
      <div className="p-4 flex flex-col flex-grow">
        <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2">
          {name}
        </h3>
        
        <p className="text-gray-600 text-sm mb-4 line-clamp-3 flex-grow">
          {description}
        </p>
        
        <div className="mt-auto">
          <div className="text-2xl font-bold text-blue-600 mb-4">
            ¥{price.toFixed(2)}
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={handleViewDetails}
              variant="outline"
              className="flex-1"
            >
              查看详情
            </Button>
            <Button
              onClick={handleAddToCart}
              variant="primary"
              className="flex-1"
            >
              加入购物车
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};