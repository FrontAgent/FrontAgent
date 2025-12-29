import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProducts } from '../hooks/useProducts';
import { useCart } from '../hooks/useCart';

export const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { products, loading, error } = useProducts();
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);

  const product = products.find(p => p.id === Number(id));

  const handleAddToCart = async () => {
    if (!product) return;
    
    setAddingToCart(true);
    try {
      addItem(product, quantity);
      setTimeout(() => {
        setAddingToCart(false);
        navigate('/cart');
      }, 500);
    } catch (err) {
      setAddingToCart(false);
      console.error('Failed to add to cart:', err);
    }
  };

  const incrementQuantity = () => {
    setQuantity(prev => prev + 1);
  };

  const decrementQuantity = () => {
    setQuantity(prev => (prev > 1 ? prev - 1 : 1));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 text-lg mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600 text-lg mb-4">商品不存在</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <button
        onClick={() => navigate('/')}
        className="mb-6 text-blue-600 hover:text-blue-800 flex items-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        返回商品列表
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <img
            src={product.image}
            alt={product.title}
            className="w-full h-96 object-contain p-8"
          />
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{product.title}</h1>
          
          <div className="flex items-center gap-4 mb-6">
            <span className="text-4xl font-bold text-blue-600">${product.price.toFixed(2)}</span>
            {product.category && (
              <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                {product.category}
              </span>
            )}
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">商品描述</h2>
            <p className="text-gray-600 leading-relaxed">{product.description}</p>
          </div>

          <div className="border-t pt-6">
            <div className="flex items-center gap-4 mb-6">
              <label className="text-gray-700 font-medium">数量：</label>
              <div className="flex items-center border border-gray-300 rounded-lg">
                <button
                  onClick={decrementQuantity}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 transition-colors"
                  disabled={quantity <= 1}
                >
                  -
                </button>
                <span className="px-6 py-2 border-x border-gray-300 min-w-[60px] text-center">
                  {quantity}
                </span>
                <button
                  onClick={incrementQuantity}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={addingToCart}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {addingToCart ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  添加中...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  加入购物车
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};