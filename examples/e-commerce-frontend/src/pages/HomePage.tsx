import React, { useState, useEffect } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface IProduct {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  rating: number;
  sales: number;
}

interface ICategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface IBanner {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  link: string;
}

/**
 * 电商首页组件
 * 包含轮播图、分类导航、推荐商品等核心功能
 */
export const HomePage: React.FC = () => {
  const [currentBanner, setCurrentBanner] = useState(0);
  const [banners] = useState<IBanner[]>([
    {
      id: '1',
      title: '春季新品上市',
      subtitle: '精选好物，品质生活',
      image: '/images/banner1.jpg',
      link: '/products?category=new'
    },
    {
      id: '2',
      title: '限时特惠',
      subtitle: '全场5折起',
      image: '/images/banner2.jpg',
      link: '/products?category=sale'
    },
    {
      id: '3',
      title: '品牌专区',
      subtitle: '汇聚知名品牌',
      image: '/images/banner3.jpg',
      link: '/brands'
    }
  ]);

  const [categories] = useState<ICategory[]>([
    { id: '1', name: '服装', icon: '👕', color: 'bg-blue-500' },
    { id: '2', name: '数码', icon: '📱', color: 'bg-green-500' },
    { id: '3', name: '家居', icon: '🏠', color: 'bg-yellow-500' },
    { id: '4', name: '美妆', icon: '💄', color: 'bg-pink-500' },
    { id: '5', name: '运动', icon: '⚽', color: 'bg-orange-500' },
    { id: '6', name: '食品', icon: '🍎', color: 'bg-red-500' },
    { id: '7', name: '图书', icon: '📚', color: 'bg-purple-500' },
    { id: '8', name: '母婴', icon: '🍼', color: 'bg-indigo-500' }
  ]);

  const [products] = useState<IProduct[]>([
    {
      id: '1',
      name: '时尚休闲T恤',
      price: 99,
      originalPrice: 199,
      image: '/images/product1.jpg',
      rating: 4.5,
      sales: 1234
    },
    {
      id: '2',
      name: '无线蓝牙耳机',
      price: 299,
      originalPrice: 399,
      image: '/images/product2.jpg',
      rating: 4.8,
      sales: 856
    },
    {
      id: '3',
      name: '北欧简约台灯',
      price: 159,
      image: '/images/product3.jpg',
      rating: 4.3,
      sales: 432
    },
    {
      id: '4',
      name: '保湿护肤套装',
      price: 399,
      originalPrice: 599,
      image: '/images/product4.jpg',
      rating: 4.7,
      sales: 789
    },
    {
      id: '5',
      name: '运动跑鞋',
      price: 599,
      originalPrice: 799,
      image: '/images/product5.jpg',
      rating: 4.6,
      sales: 567
    },
    {
      id: '6',
      name: '有机坚果礼盒',
      price: 89,
      image: '/images/product6.jpg',
      rating: 4.4,
      sales: 234
    }
  ]);

  /**
   * 轮播图自动切换
   */
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [banners.length]);

  /**
   * 切换轮播图
   */
  const handleBannerChange = (index: number): void => {
    setCurrentBanner(index);
  };

  /**
   * 切换到上一张轮播图
   */
  const handlePrevBanner = (): void => {
    setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length);
  };

  /**
   * 切换到下一张轮播图
   */
  const handleNextBanner = (): void => {
    setCurrentBanner((prev) => (prev + 1) % banners.length);
  };

  /**
   * 渲染星级评分
   */
  const renderStars = (rating: number): JSX.Element => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <span key={`full-${i}`} className="text-yellow-400">★</span>
      );
    }

    if (hasHalfStar) {
      stars.push(
        <span key="half" className="text-yellow-400">☆</span>
      );
    }

    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <span key={`empty-${i}`} className="text-gray-300">★</span>
      );
    }

    return <div className="flex items-center">{stars}</div>;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 轮播图区域 */}
      <section className="relative h-96 overflow-hidden">
        <div className="relative w-full h-full">
          {banners.map((banner, index) => (
            <div
              key={banner.id}
              className={`absolute inset-0 transition-opacity duration-500 ${
                index === currentBanner ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <img
                src={banner.image}
                alt={banner.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
                <div className="text-center text-white">
                  <h2 className="text-4xl font-bold mb-4">{banner.title}</h2>
                  <p className="text-xl mb-6">{banner.subtitle}</p>
                  <button className="bg-white text-gray-900 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
                    立即购买
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 轮播图控制按钮 */}
        <button
          onClick={handlePrevBanner}
          className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 transition-all"
        >
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
        <button
          onClick={handleNextBanner}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 transition-all"
        >
          <ChevronRightIcon className="w-6 h-6" />
        </button>

        {/* 轮播图指示器 */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => handleBannerChange(index)}
              className={`w-3 h-3 rounded-full transition-all ${
                index === currentBanner ? 'bg-white' : 'bg-white bg-opacity-50'
              }`}
            />
          ))}
        </div>
      </section>

      {/* 分类导航 */}
      <section className="py-8 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <h3 className="text-2xl font-bold text-center mb-8">商品分类</h3>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
            {categories.map((category) => (
              <div
                key={category.id}
                className="flex flex-col items-center p-4 rounded-lg hover:shadow-lg transition-shadow cursor-pointer"
              >
                <div className={`w-16 h-16 ${category.color} rounded-full flex items-center justify-center text-2xl mb-2`}>
                  {category.icon}
                </div>
                <span className="text-sm font-medium text-gray-700">{category.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 推荐商品 */}
      <section className="py-8">
        <div className="max-w-7xl mx-auto px-4">
          <h3 className="text-2xl font-bold text-center mb-8">热门推荐</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-lg shadow-sm hover:shadow-lg transition-shadow cursor-pointer overflow-hidden"
              >
                <div className="aspect-square overflow-hidden">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-4">
                  <h4 className="font-medium text-gray-900 mb-2 line-clamp-2">{product.name}</h4>
                  <div className="flex items-center mb-2">
                    {renderStars(product.rating)}
                    <span className="text-sm text-gray-500 ml-2">({product.sales})</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg font-bold text-red-600">¥{product.price}</span>
                      {product.originalPrice && (
                        <span className="text-sm text-gray-500 line-through">¥{product.originalPrice}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 促销活动 */}
      <section className="py-8 bg-gradient-to-r from-red-500 to-pink-500">
        <div className="max-w-7xl mx-auto px-4 text-center text-white">
          <h3 className="text-3xl font-bold mb-4">限时特惠</h3>
          <p className="text-xl mb-6">全场商品5折起，错过再等一年！</p>
          <button className="bg-white text-red-500 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
            立即抢购
          </button>
        </div>
      </section>
    </div>
  );
};

export default HomePage;