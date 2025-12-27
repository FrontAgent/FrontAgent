import React from 'react';
import { CategoryNav } from '../components/features/CategoryNav';
import { ProductRecommendations } from '../components/features/ProductRecommendations';
import { PromotionBanner } from '../components/features/PromotionBanner';

/**
 * 首页组件
 * 包含商品推荐、分类导航、促销活动等内容
 */
export const Home: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 促销活动横幅 */}
      <section className="mb-8">
        <PromotionBanner />
      </section>

      {/* 分类导航 */}
      <section className="mb-12">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">商品分类</h2>
          <CategoryNav />
        </div>
      </section>

      {/* 商品推荐 */}
      <section className="mb-12">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">为您推荐</h2>
          <ProductRecommendations />
        </div>
      </section>

      {/* 热门商品 */}
      <section className="mb-12">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">热门商品</h2>
          <ProductRecommendations />
        </div>
      </section>

      {/* 新品上市 */}
      <section className="mb-12">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">新品上市</h2>
          <ProductRecommendations />
        </div>
      </section>
    </div>
  );
};