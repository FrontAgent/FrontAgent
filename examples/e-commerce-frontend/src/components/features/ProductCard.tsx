import React from 'react';
import { useCartStore } from '../../stores/useCartStore';

interface IProduct {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
}

interface ProductCardProps {
  product: IProduct;
}

/**
 * ProductCard component displays a single product with image, name, price and add to cart button
 * @param product - Product data to display
 */
export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const addToCart = useCartStore((state) => state.addToCart);

  const handleAddToCart = () => {
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <div className="aspect-w-1 aspect-h-1 w-full overflow-hidden bg-gray-200">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="h-full w-full object-cover object-center"
        />
      </div>
      <div className="p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-2">{product.name}</h3>
        <p className="text-xl font-semibold text-gray-900 mb-4">
          ${product.price.toFixed(2)}
        </p>
        <button
          onClick={handleAddToCart}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Add to Cart
        </button>
      </div>
    </div>
  );
};

export default ProductCard;