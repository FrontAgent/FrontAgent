import React, { useState, useMemo } from 'react';
import { useProductStore } from '../store/productStore';
import { ProductCard } from '../components/ProductCard';

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string;
  description: string;
}

type SortOption = 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc';

export const ProductList: React.FC = () => {
  const { products, loading } = useProductStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');
  const [priceRange, setPriceRange] = useState<{ min: number; max: number }>({
    min: 0,
    max: Infinity,
  });

  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category));
    return ['all', ...Array.from(cats)];
  }, [products]);

  const filteredAndSortedProducts = useMemo(() => {
    let filtered = products.filter((product) => {
      const categoryMatch =
        selectedCategory === 'all' || product.category === selectedCategory;
      const priceMatch =
        product.price >= priceRange.min && product.price <= priceRange.max;
      return categoryMatch && priceMatch;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price-asc':
          return a.price - b.price;
        case 'price-desc':
          return b.price - a.price;
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        default:
          return 0;
      }
    });

    return filtered;
  }, [products, selectedCategory, sortBy, priceRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">商品列表</h1>

      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              分类筛选
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? '全部分类' : cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              排序方式
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="name-asc">名称 A-Z</option>
              <option value="name-desc">名称 Z-A</option>
              <option value="price-asc">价格从低到高</option>
              <option value="price-desc">价格从高到低</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              价格区间
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="最低价"
                value={priceRange.min || ''}
                onChange={(e) =>
                  setPriceRange({
                    ...priceRange,
                    min: Number(e.target.value) || 0,
                  })
                }
                className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="最高价"
                value={priceRange.max === Infinity ? '' : priceRange.max}
                onChange={(e) =>
                  setPriceRange({
                    ...priceRange,
                    max: Number(e.target.value) || Infinity,
                  })
                }
                className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      {filteredAndSortedProducts.length === 0 ? (
        <div className="text-center py-16">
          <svg
            className="mx-auto h-24 w-24 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <h3 className="mt-4 text-xl font-medium text-gray-900">
            暂无商品
          </h3>
          <p className="mt-2 text-gray-500">
            当前筛选条件下没有找到商品，请尝试调整筛选条件
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredAndSortedProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      <div className="mt-8 text-center text-gray-600">
        共找到 {filteredAndSortedProducts.length} 件商品
      </div>
    </div>
  );
};