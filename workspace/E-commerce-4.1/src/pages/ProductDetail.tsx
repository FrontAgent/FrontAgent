import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useStore } from '../store/useStore';

export const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { products, addToCart } = useStore();
  const [quantity, setQuantity] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);

  const product = products.find(p => p.id === Number(id));

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">404</h1>
          <p className="text-xl text-gray-600 mb-8">商品不存在</p>
          <Link 
            to="/" 
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  const handleQuantityChange = (delta: number) => {
    const newQuantity = quantity + delta;
    if (newQuantity >= 1 && newQuantity <= product.stock) {
      setQuantity(newQuantity);
    }
  };

  const handleAddToCart = () => {
    addToCart(product, quantity);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
            <div className="flex items-center justify-center bg-gray-100 rounded-lg overflow-hidden">
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-auto object-cover max-h-[600px]"
              />
            </div>

            <div className="flex flex-col justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">
                  {product.name}
                </h1>

                <div className="mb-6">
                  <span className="text-4xl font-bold text-blue-600">
                    ¥{product.price.toFixed(2)}
                  </span>
                </div>

                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-800 mb-2">
                    商品描述
                  </h2>
                  <p className="text-gray-600 leading-relaxed">
                    {product.description}
                  </p>
                </div>

                <div className="mb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 font-medium">库存状态:</span>
                    {product.stock > 0 ? (
                      <span className="text-green-600 font-semibold">
                        有货 ({product.stock} 件)
                      </span>
                    ) : (
                      <span className="text-red-600 font-semibold">
                        缺货
                      </span>
                    )}
                  </div>
                </div>

                {product.stock > 0 && (
                  <div className="mb-6">
                    <label className="block text-gray-700 font-medium mb-2">
                      数量
                    </label>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleQuantityChange(-1)}
                        disabled={quantity <= 1}
                        className="w-10 h-10 flex items-center justify-center bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        -
                      </button>
                      <span className="text-xl font-semibold w-12 text-center">
                        {quantity}
                      </span>
                      <button
                        onClick={() => handleQuantityChange(1)}
                        disabled={quantity >= product.stock}
                        className="w-10 h-10 flex items-center justify-center bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {product.stock > 0 && (
                  <button
                    onClick={handleAddToCart}
                    className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors"
                  >
                    加入购物车
                  </button>
                )}

                <Link
                  to="/"
                  className="block w-full text-center bg-gray-200 text-gray-700 py-4 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  继续购物
                </Link>
              </div>
            </div>
          </div>
        </div>

        {showSuccess && (
          <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg animate-fade-in">
            <div className="flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-semibold">已成功加入购物车！</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};