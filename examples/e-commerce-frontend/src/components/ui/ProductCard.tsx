import React from 'react';

interface IProduct {
  id: string;
  title: string;
  price: number;
  image: string;
  originalPrice?: number;
  discount?: number;
  rating?: number;
  reviewCount?: number;
  isNew?: boolean;
  isBestseller?: boolean;
}

interface IProductCardProps {
  product: IProduct;
  onAddToCart?: (productId: string) => void;
  onAddToWishlist?: (productId: string) => void;
  onProductClick?: (productId: string) => void;
  className?: string;
}

export const ProductCard: React.FC<IProductCardProps> = ({
  product,
  onAddToCart,
  onAddToWishlist,
  onProductClick,
  className = '',
}) => {
  const {
    id,
    title,
    price,
    image,
    originalPrice,
    discount,
    rating,
    reviewCount,
    isNew,
    isBestseller,
  } = product;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddToCart?.(id);
  };

  const handleAddToWishlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddToWishlist?.(id);
  };

  const handleProductClick = () => {
    onProductClick?.(id);
  };

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(price);
  };

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <span key={i} className="text-yellow-400 text-sm">
          ★
        </span>
      );
    }

    if (hasHalfStar) {
      stars.push(
        <span key="half" className="text-yellow-400 text-sm">
          ☆
        </span>
      );
    }

    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <span key={`empty-${i}`} className="text-gray-300 text-sm">
          ★
        </span>
      );
    }

    return stars;
  };

  return (
    <div
      className={`group relative bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow duration-300 cursor-pointer ${className}`}
      onClick={handleProductClick}
    >
      {/* 商品标签 */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
        {isNew && (
          <span className="bg-green-500 text-white text-xs px-2 py-1 rounded">
            新品
          </span>
        )}
        {isBestseller && (
          <span className="bg-red-500 text-white text-xs px-2 py-1 rounded">
            热销
          </span>
        )}
        {discount && (
          <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded">
            -{discount}%
          </span>
        )}
      </div>

      {/* 收藏按钮 */}
      <button
        onClick={handleAddToWishlist}
        className="absolute top-2 right-2 z-10 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-gray-50"
        aria-label="添加到收藏"
      >
        <svg
          className="w-4 h-4 text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
      </button>

      {/* 商品图片 */}
      <div className="aspect-square overflow-hidden bg-gray-100">
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      </div>

      {/* 商品信息 */}
      <div className="p-4">
        {/* 商品标题 */}
        <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mb-2 min-h-[2.5rem]">
          {title}
        </h3>

        {/* 评分 */}
        {rating && (
          <div className="flex items-center gap-1 mb-2">
            <div className="flex">{renderStars(rating)}</div>
            {reviewCount && (
              <span className="text-xs text-gray-500">
                ({reviewCount})
              </span>
            )}
          </div>
        )}

        {/* 价格信息 */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg font-bold text-red-600">
            {formatPrice(price)}
          </span>
          {originalPrice && originalPrice > price && (
            <span className="text-sm text-gray-500 line-through">
              {formatPrice(originalPrice)}
            </span>
          )}
        </div>

        {/* 添加到购物车按钮 */}
        <button
          onClick={handleAddToCart}
          className="w-full bg-blue-600 text-white text-sm py-2 px-4 rounded-md hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center gap-2"
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
              d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6M7 13l-1.5-6m0 0h12m-12 0a2 2 0 11-4 0m16 0a2 2 0 11-4 0m-16 0h16"
            />
          </svg>
          加入购物车
        </button>
      </div>
    </div>
  );
};

export default ProductCard;