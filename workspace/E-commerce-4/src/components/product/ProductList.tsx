import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ProductCard } from './ProductCard';

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  description?: string;
  rating?: number;
  reviewCount?: number;
  badge?: string;
  inStock?: boolean;
}

interface ProductListProps {
  products: Product[];
  viewMode?: 'grid' | 'list';
  loading?: boolean;
  error?: string | null;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onProductClick?: (product: Product) => void;
  onAddToCart?: (product: Product) => void;
  onToggleFavorite?: (product: Product) => void;
  emptyMessage?: string;
  className?: string;
}

export const ProductList: React.FC<ProductListProps> = ({
  products,
  viewMode = 'grid',
  loading = false,
  error = null,
  hasMore = false,
  onLoadMore,
  onProductClick,
  onAddToCart,
  onToggleFavorite,
  emptyMessage = '暂无商品',
  className = '',
}) => {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const handleToggleFavorite = useCallback((product: Product) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(product.id)) {
        newFavorites.delete(product.id);
      } else {
        newFavorites.add(product.id);
      }
      return newFavorites;
    });
    onToggleFavorite?.(product);
  }, [onToggleFavorite]);

  useEffect(() => {
    if (!hasMore || !onLoadMore || loading) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [hasMore, onLoadMore, loading]);

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 px-4 ${className}`}>
        <div className="w-16 h-16 mb-4 text-red-500">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="text-lg font-medium text-gray-900 mb-2">加载失败</p>
        <p className="text-sm text-gray-500 text-center">{error}</p>
        {onLoadMore && (
          <button
            onClick={onLoadMore}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            重试
          </button>
        )}
      </div>
    );
  }

  if (!loading && products.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 px-4 ${className}`}>
        <div className="w-24 h-24 mb-4 text-gray-300">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <p className="text-lg font-medium text-gray-900 mb-2">{emptyMessage}</p>
        <p className="text-sm text-gray-500">请尝试调整筛选条件</p>
      </div>
    );
  }

  const gridClasses = viewMode === 'grid'
    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6'
    : 'flex flex-col gap-4';

  return (
    <div className={className}>
      <div className={gridClasses}>
        {products.map((product) => (
          <div
            key={product.id}
            className={viewMode === 'list' ? 'w-full' : ''}
          >
            <ProductCard
              product={{
                id: product.id,
                name: product.name,
                price: product.price,
                originalPrice: product.originalPrice,
                image: product.image,
                description: product.description || '',
                category: '',
                stock: product.inStock === false ? 0 : 10,
                rating: product.rating,
                reviewCount: product.reviewCount,
              }}
              onAddToCart={onAddToCart}
            />
          </div>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center items-center py-8">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-600">加载中...</span>
          </div>
        </div>
      )}

      {hasMore && !loading && (
        <div ref={loadMoreRef} className="flex justify-center py-8">
          <button
            onClick={onLoadMore}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            加载更多
          </button>
        </div>
      )}

      {!hasMore && products.length > 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          已加载全部商品
        </div>
      )}
    </div>
  );
};