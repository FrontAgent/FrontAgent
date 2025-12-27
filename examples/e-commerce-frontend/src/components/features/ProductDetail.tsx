import React, { useState } from 'react';

interface IProduct {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  description: string;
  images: string[];
  rating: number;
  reviewCount: number;
  stock: number;
  category: string;
  brand?: string;
}

interface IProductDetailProps {
  product: IProduct;
  onAddToCart?: (productId: string, quantity: number) => void;
  onBuyNow?: (productId: string) => void;
}

/**
 * 商品详情展示组件
 * 展示商品的图片、价格、描述等信息，支持添加到购物车和立即购买功能
 */
export const ProductDetail: React.FC<IProductDetailProps> = ({
  product,
  onAddToCart,
  onBuyNow,
}) => {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [isImageLoading, setIsImageLoading] = useState<boolean>(true);

  /**
   * 处理图片切换
   */
  const handleImageSelect = (index: number): void => {
    setSelectedImageIndex(index);
    setIsImageLoading(true);
  };

  /**
   * 处理数量变化
   */
  const handleQuantityChange = (newQuantity: number): void => {
    if (newQuantity >= 1 && newQuantity <= product.stock) {
      setQuantity(newQuantity);
    }
  };

  /**
   * 添加到购物车
   */
  const handleAddToCart = (): void => {
    if (onAddToCart && product.stock > 0) {
      onAddToCart(product.id, quantity);
    }
  };

  /**
   * 立即购买
   */
  const handleBuyNow = (): void => {
    if (onBuyNow && product.stock > 0) {
      onBuyNow(product.id);
    }
  };

  /**
   * 格式化价格显示
   */
  const formatPrice = (price: number): string => {
    return `¥${price.toFixed(2)}`;
  };

  /**
   * 计算折扣百分比
   */
  const calculateDiscount = (originalPrice: number, currentPrice: number): number => {
    return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
  };

  const discountPercentage = product.originalPrice 
    ? calculateDiscount(product.originalPrice, product.price)
    : 0;

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-6">
        {/* 商品图片区域 */}
        <div className="space-y-4">
          <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
            {isImageLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            )}
            <img
              src={product.images[selectedImageIndex]}
              alt={product.name}
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                isImageLoading ? 'opacity-0' : 'opacity-100'
              }`}
              onLoad={() => setIsImageLoading(false)}
              onError={() => setIsImageLoading(false)}
            />
            {discountPercentage > 0 && (
              <div className="absolute top-4 left-4 bg-red-500 text-white px-2 py-1 rounded-md text-sm font-semibold">
                -{discountPercentage}%
              </div>
            )}
          </div>
          
          {/* 缩略图 */}
          {product.images.length > 1 && (
            <div className="flex space-x-2 overflow-x-auto">
              {product.images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => handleImageSelect(index)}
                  className={`flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-colors ${
                    selectedImageIndex === index
                      ? 'border-blue-500'
                      : 'border-gray-200 hover:border-gray-300'
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
          )}
        </div>

        {/* 商品信息区域 */}
        <div className="space-y-6">
          {/* 商品标题和品牌 */}
          <div>
            {product.brand && (
              <p className="text-sm text-gray-500 mb-1">{product.brand}</p>
            )}
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {product.name}
            </h1>
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <div className="flex text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <span key={i}>
                      {i < Math.floor(product.rating) ? '★' : '☆'}
                    </span>
                  ))}
                </div>
                <span className="ml-2 text-sm text-gray-600">
                  {product.rating} ({product.reviewCount} 评价)
                </span>
              </div>
            </div>
          </div>

          {/* 价格信息 */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-bold text-red-600">
                {formatPrice(product.price)}
              </span>
              {product.originalPrice && (
                <span className="text-lg text-gray-500 line-through">
                  {formatPrice(product.originalPrice)}
                </span>
              )}
            </div>
            {product.originalPrice && (
              <p className="text-sm text-green-600 mt-1">
                节省 {formatPrice(product.originalPrice - product.price)}
              </p>
            )}
          </div>

          {/* 商品描述 */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">商品描述</h3>
            <p className="text-gray-700 leading-relaxed">{product.description}</p>
          </div>

          {/* 商品信息 */}
          <div className="border-t pt-4">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">分类</dt>
                <dd className="text-gray-900">{product.category}</dd>
              </div>
              <div>
                <dt className="text-gray-500">库存</dt>
                <dd className={`${product.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {product.stock > 0 ? `${product.stock} 件` : '缺货'}
                </dd>
              </div>
            </dl>
          </div>

          {/* 数量选择和操作按钮 */}
          <div className="border-t pt-4 space-y-4">
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">数量:</label>
              <div className="flex items-center border border-gray-300 rounded-md">
                <button
                  onClick={() => handleQuantityChange(quantity - 1)}
                  disabled={quantity <= 1}
                  className="px-3 py-1 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  -
                </button>
                <span className="px-4 py-1 border-x border-gray-300 min-w-[3rem] text-center">
                  {quantity}
                </span>
                <button
                  onClick={() => handleQuantityChange(quantity + 1)}
                  disabled={quantity >= product.stock}
                  className="px-3 py-1 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={handleAddToCart}
                disabled={product.stock === 0}
                className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-md font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                加入购物车
              </button>
              <button
                onClick={handleBuyNow}
                disabled={product.stock === 0}
                className="flex-1 bg-red-600 text-white py-3 px-6 rounded-md font-semibold hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                立即购买
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;