import React, { useState, useEffect } from 'react';

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  tag?: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface Banner {
  id: string;
  image: string;
  title: string;
  subtitle: string;
}

const banners: Banner[] = [
  { id: '1', image: 'https://picsum.photos/1200/400?random=1', title: '夏季大促', subtitle: '全场低至5折起' },
  { id: '2', image: 'https://picsum.photos/1200/400?random=2', title: '新品首发', subtitle: '限时抢购中' },
  { id: '3', image: 'https://picsum.photos/1200/400?random=3', title: '会员专享', subtitle: '积分翻倍赢好礼' },
];

const categories: Category[] = [
  { id: '1', name: '服装', icon: '👕' },
  { id: '2', name: '数码', icon: '📱' },
  { id: '3', name: '美妆', icon: '💄' },
  { id: '4', name: '食品', icon: '🍎' },
  { id: '5', name: '家居', icon: '🏠' },
  { id: '6', name: '运动', icon: '⚽' },
  { id: '7', name: '图书', icon: '📚' },
  { id: '8', name: '更多', icon: '➕' },
];

const hotProducts: Product[] = [
  { id: '1', name: '无线蓝牙耳机', price: 199, originalPrice: 299, image: 'https://picsum.photos/300/300?random=10', tag: '热卖' },
  { id: '2', name: '智能手表', price: 599, originalPrice: 799, image: 'https://picsum.photos/300/300?random=11', tag: '爆款' },
  { id: '3', name: '运动跑鞋', price: 399, originalPrice: 499, image: 'https://picsum.photos/300/300?random=12' },
  { id: '4', name: '保温杯', price: 89, originalPrice: 129, image: 'https://picsum.photos/300/300?random=13', tag: '特价' },
];

const newProducts: Product[] = [
  { id: '5', name: '夏季新款连衣裙', price: 259, image: 'https://picsum.photos/300/300?random=20', tag: '新品' },
  { id: '6', name: '便携式充电宝', price: 149, image: 'https://picsum.photos/300/300?random=21', tag: '新品' },
  { id: '7', name: '护肤套装', price: 399, image: 'https://picsum.photos/300/300?random=22', tag: '新品' },
  { id: '8', name: '休闲双肩包', price: 189, image: 'https://picsum.photos/300/300?random=23', tag: '新品' },
];

const BannerCarousel: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative w-full h-48 md:h-80 lg:h-96 overflow-hidden rounded-lg">
      {banners.map((banner, index) => (
        <div
          key={banner.id}
          className={`absolute inset-0 transition-opacity duration-500 ${
            index === currentIndex ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <img
            src={banner.image}
            alt={banner.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent flex items-center">
            <div className="text-white px-6 md:px-12">
              <h2 className="text-2xl md:text-4xl font-bold mb-2">{banner.title}</h2>
              <p className="text-sm md:text-lg opacity-90">{banner.subtitle}</p>
            </div>
          </div>
        </div>
      ))}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
        {banners.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-2 h-2 md:w-3 md:h-3 rounded-full transition-colors ${
              index === currentIndex ? 'bg-white' : 'bg-white/50'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

const CategoryNav: React.FC = () => {
  return (
    <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
      {categories.map((category) => (
        <a
          key={category.id}
          href={`/category/${category.id}`}
          className="flex flex-col items-center p-3 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <span className="text-3xl md:text-4xl mb-2">{category.icon}</span>
          <span className="text-xs md:text-sm text-gray-700">{category.name}</span>
        </a>
      ))}
    </div>
  );
};

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  return (
    <a
      href={`/product/${product.id}`}
      className="group block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden"
    >
      <div className="relative aspect-square overflow-hidden">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {product.tag && (
          <span className="absolute top-2 left-2 px-2 py-1 text-xs font-medium text-white bg-red-500 rounded">
            {product.tag}
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-sm md:text-base text-gray-800 truncate mb-2">{product.name}</h3>
        <div className="flex items-baseline space-x-2">
          <span className="text-lg font-bold text-red-500">¥{product.price}</span>
          {product.originalPrice && (
            <span className="text-xs text-gray-400 line-through">¥{product.originalPrice}</span>
          )}
        </div>
      </div>
    </a>
  );
};

interface ProductSectionProps {
  title: string;
  products: Product[];
  moreLink?: string;
}

const ProductSection: React.FC<ProductSectionProps> = ({ title, products, moreLink }) => {
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800">{title}</h2>
        {moreLink && (
          <a href={moreLink} className="text-sm text-blue-600 hover:text-blue-800">
            查看更多 →
          </a>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
};

export const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <BannerCarousel />

        <section className="bg-white rounded-lg p-4 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-4">分类导航</h2>
          <CategoryNav />
        </section>

        <ProductSection
          title="热门推荐"
          products={hotProducts}
          moreLink="/products?sort=hot"
        />

        <ProductSection
          title="新品上架"
          products={newProducts}
          moreLink="/products?sort=new"
        />

        <section className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg p-6 text-white">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">加入会员</h2>
            <p className="text-sm opacity-90 mb-4">享受专属优惠和积分奖励</p>
            <button className="px-6 py-2 bg-white text-purple-600 rounded-full font-medium hover:bg-gray-100 transition-colors">
              立即加入
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
export default HomePage;
