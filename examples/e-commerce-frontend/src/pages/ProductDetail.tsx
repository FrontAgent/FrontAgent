import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useCartStore } from '../stores/useCartStore';
import { useProductStore } from '../stores/useProductStore';
import { IProduct, ICartItem } from '../types';
import Button from '../components/ui/Button';
import ImageCarousel from '../components/ui/ImageCarousel';
import StarRating from '../components/ui/StarRating';

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [selectedSpecs, setSelectedSpecs] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState<number>(1);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);

  const { product, loading, fetchProduct } = useProductStore();
  const { addToCart } = useCartStore();

  useEffect(() => {
    if (id) {
      fetchProduct(id);
    }
  }, [id, fetchProduct]);

  const handleSpecChange = (specType: string, value: string) => {
    setSelectedSpecs(prev => ({
      ...prev,
      [specType]: value
    }));
  };

  const handleAddToCart = () => {
    if (!product) return;

    const cartItem: ICartItem = {
      id: product.id,
      name: product.name,
      price: product.price,
      quantity,
      specs: selectedSpecs,
      image: product.images[0]
    };

    addToCart(cartItem);
  };

  const handleQuantityChange = (delta: number) => {
    setQuantity(prev => Math.max(1, prev + delta));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-gray-500">Product not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <ImageCarousel
            images={product.images}
            currentIndex={currentImageIndex}
            onIndexChange={setCurrentImageIndex}
          />
          <div className="flex space-x-2 overflow-x-auto">
            {product.images.map((image, index) => (
              <button
                key={index}
                onClick={() => setCurrentImageIndex(index)}
                className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 ${
                  currentImageIndex === index ? 'border-blue-600' : 'border-gray-300'
                }`}
              >
                <img
                  src={image}
                  alt={`${product.name} ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
            <p className="text-gray-600 mt-2">{product.description}</p>
          </div>

          <div className="flex items-center space-x-4">
            <StarRating rating={product.rating} />
            <span className="text-gray-500">({product.reviews} reviews)</span>
          </div>

          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-gray-900">${product.price}</span>
            {product.originalPrice && (
              <span className="text-lg text-gray-500 line-through">${product.originalPrice}</span>
            )}
            {product.discount && (
              <span className="text-sm text-red-600 font-semibold">-{product.discount}%</span>
            )}
          </div>

          <div className="space-y-4">
            {product.specifications?.map((spec) => (
              <div key={spec.type}>
                <h3 className="text-sm font-medium text-gray-700 mb-2">{spec.type}</h3>
                <div className="flex flex-wrap gap-2">
                  {spec.options.map((option) => (
                    <button
                      key={option}
                      onClick={() => handleSpecChange(spec.type, option)}
                      className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                        selectedSpecs[spec.type] === option
                          ? 'border-blue-600 bg-blue-50 text-blue-600'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center border rounded-lg">
              <button
                onClick={() => handleQuantityChange(-1)}
                className="px-3 py-2 hover:bg-gray-100 transition-colors"
              >
                -
              </button>
              <span className="px-4 py-2 border-x">{quantity}</span>
              <button
                onClick={() => handleQuantityChange(1)}
                className="px-3 py-2 hover:bg-gray-100 transition-colors"
              >
                +
              </button>
            </div>
            <span className="text-sm text-gray-500">
              {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
            </span>
          </div>

          <div className="flex space-x-4">
            <Button
              onClick={handleAddToCart}
              disabled={product.stock === 0}
              className="flex-1"
            >
              Add to Cart
            </Button>
            <Button variant="outline" className="flex-1">
              Buy Now
            </Button>
          </div>

          <div className="border-t pt-6 space-y-4">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-gray-600">Free shipping on orders over $50</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-gray-600">30-day return policy</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-gray-600">Secure payment</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;