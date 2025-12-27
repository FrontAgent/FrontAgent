import React from 'react';
import { useProductStore } from '../stores/useProductStore';
import { useCategoryStore } from '../stores/useCategoryStore';
import { ProductCard } from '../components/features/ProductCard';
import { CategoryNav } from '../components/features/CategoryNav';
import { HeroBanner } from '../components/features/HeroBanner';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorMessage } from '../components/ui/ErrorMessage';

/**
 * 电商平台首页组件
 * 展示推荐商品和分类导航
 */
export const HomePage: React.FC = () => {
  const { products, loading: productsLoading, error: productsError, fetchProducts } = useProductStore();
  const { categories, loading: categoriesLoading, error: categoriesError, fetchCategories } = useCategoryStore();

  React.useEffect(() => {
    fetchProducts({ limit: 12, featured: true });
    fetchCategories();
  }, [fetchProducts, fetchCategories]);

  const featuredProducts = products.filter(product => product.featured);
  const mainCategories = categories.slice(0, 8);

  if (productsLoading && categoriesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (productsError || categoriesError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <ErrorMessage 
          message={productsError || categoriesError || '加载失败'}
          onRetry={() => {
            fetchProducts({ limit: 12, featured: true });
            fetchCategories();
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 英雄横幅 */}
      <HeroBanner />
      
      {/* 分类导航 */}
      <section className="py-8 bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">热门分类</h2>
          <CategoryNav categories={mainCategories} />
        </div>
      </section>

      {/* 推荐商品 */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-gray-900">精选推荐</h2>
            <button className="text-blue-600 hover:text-blue-700 font-medium">
              查看更多 →
            </button>
          </div>
          
          {featuredProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {featuredProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">暂无推荐商品</p>
            </div>
          )}
        </div>
      </section>

      {/* 促销横幅 */}
      <section className="py-12 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            限时特惠
          </h2>
          <p className="text-blue-100 text-lg mb-6">
            全场商品享受超值优惠，机会难得！
          </p>
          <button className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
            立即抢购
          </button>
        </div>
      </section>

      {/* 最新商品 */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-gray-900">最新上架</h2>
            <button className="text-blue-600 hover:text-blue-700 font-medium">
              查看更多 →
            </button>
          </div>
          
          {products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.slice(0, 8).map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">暂无商品</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};