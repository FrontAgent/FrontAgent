import React from 'react';
import { Link } from 'react-router-dom';
import { useProductStore } from '../stores/useProductStore';
import { useCategoryStore } from '../stores/useCategoryStore';
import { ProductCard } from '../components/features/ProductCard';
import { CategoryCard } from '../components/features/CategoryCard';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

interface IHomeProps {}

/**
 * 首页组件
 * 包含产品推荐、分类导航、促销横幅等功能
 */
export const Home: React.FC<IHomeProps> = () => {
  const { 
    featuredProducts, 
    newArrivals, 
    loading: productsLoading,
    fetchFeaturedProducts,
    fetchNewArrivals 
  } = useProductStore();
  
  const { 
    categories, 
    loading: categoriesLoading,
    fetchCategories 
  } = useCategoryStore();

  React.useEffect(() => {
    fetchFeaturedProducts();
    fetchNewArrivals();
    fetchCategories();
  }, [fetchFeaturedProducts, fetchNewArrivals, fetchCategories]);

  const isLoading = productsLoading || categoriesLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="container mx-auto px-4 py-24">
          <div className="max-w-3xl">
            <h1 className="text-5xl font-bold mb-6">
              发现精选好物
            </h1>
            <p className="text-xl mb-8 text-blue-100">
              探索我们精心挑选的产品系列，享受购物乐趣
            </p>
            <Button 
              variant="secondary" 
              size="lg"
              className="bg-white text-blue-600 hover:bg-gray-100"
            >
              立即购买
            </Button>
          </div>
        </div>
      </section>

      {/* Categories Navigation */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          热门分类
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {categories.slice(0, 6).map((category) => (
            <CategoryCard 
              key={category.id} 
              category={category}
            />
          ))}
        </div>
        <div className="text-center mt-8">
          <Link to="/categories">
            <Button variant="outline">
              查看所有分类
            </Button>
          </Link>
        </div>
      </section>

      {/* Featured Products */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          精选推荐
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredProducts.map((product) => (
            <ProductCard 
              key={product.id} 
              product={product}
            />
          ))}
        </div>
      </section>

      {/* New Arrivals */}
      <section className="container mx-auto px-4 py-16 bg-white rounded-lg">
        <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          新品上市
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {newArrivals.map((product) => (
            <ProductCard 
              key={product.id} 
              product={product}
            />
          ))}
        </div>
        <div className="text-center mt-8">
          <Link to="/products?sort=newest">
            <Button variant="outline">
              查看更多新品
            </Button>
          </Link>
        </div>
      </section>

      {/* Promotion Banner */}
      <section className="bg-gradient-to-r from-orange-500 to-red-500 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            限时优惠
          </h2>
          <p className="text-xl mb-8">
            全场商品满299减50，满599减120
          </p>
          <Button 
            variant="secondary" 
            size="lg"
            className="bg-white text-orange-600 hover:bg-gray-100"
          >
            立即抢购
          </Button>
        </div>
      </section>

      {/* Newsletter */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            订阅我们的资讯
          </h2>
          <p className="text-gray-600 mb-8">
            获取最新产品信息和独家优惠
          </p>
          <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
            <input
              type="email"
              placeholder="输入您的邮箱"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button>
              订阅
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};