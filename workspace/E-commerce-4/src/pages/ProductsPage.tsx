import React, { useState, useMemo, useCallback } from 'react';
import { ProductCard } from '../components/product/ProductCard';

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  rating: number;
  reviewCount: number;
  category: string;
  brand: string;
  sales: number;
  isNew?: boolean;
  isFeatured?: boolean;
}

interface FilterState {
  categories: string[];
  brands: string[];
  priceRange: [number, number];
  rating: number | null;
}

type SortOption = 'price-asc' | 'price-desc' | 'sales' | 'rating' | 'newest';
type ViewMode = 'grid' | 'list';

const mockProducts: Product[] = [
  { id: '1', name: '无线蓝牙耳机 Pro', price: 299, originalPrice: 399, image: 'https://picsum.photos/seed/prod1/400/400', rating: 4.8, reviewCount: 1256, category: '电子产品', brand: '品牌A', sales: 5680, isNew: true },
  { id: '2', name: '智能手表 Ultra', price: 1299, originalPrice: 1599, image: 'https://picsum.photos/seed/prod2/400/400', rating: 4.6, reviewCount: 892, category: '电子产品', brand: '品牌B', sales: 3420, isFeatured: true },
  { id: '3', name: '运动跑鞋 Air Max', price: 599, image: 'https://picsum.photos/seed/prod3/400/400', rating: 4.9, reviewCount: 2341, category: '运动户外', brand: '品牌C', sales: 8920 },
  { id: '4', name: '纯棉T恤 经典款', price: 99, originalPrice: 149, image: 'https://picsum.photos/seed/prod4/400/400', rating: 4.5, reviewCount: 567, category: '服装', brand: '品牌D', sales: 12450 },
  { id: '5', name: '机械键盘 RGB', price: 459, image: 'https://picsum.photos/seed/prod5/400/400', rating: 4.7, reviewCount: 1023, category: '电子产品', brand: '品牌A', sales: 4560, isNew: true },
  { id: '6', name: '瑜伽垫 加厚款', price: 129, originalPrice: 169, image: 'https://picsum.photos/seed/prod6/400/400', rating: 4.4, reviewCount: 789, category: '运动户外', brand: '品牌E', sales: 6780 },
  { id: '7', name: '保温杯 大容量', price: 89, image: 'https://picsum.photos/seed/prod7/400/400', rating: 4.6, reviewCount: 456, category: '家居生活', brand: '品牌F', sales: 9870 },
  { id: '8', name: '双肩背包 商务款', price: 259, originalPrice: 329, image: 'https://picsum.photos/seed/prod8/400/400', rating: 4.3, reviewCount: 234, category: '箱包', brand: '品牌G', sales: 2340, isFeatured: true },
  { id: '9', name: '护肤套装 补水系列', price: 399, originalPrice: 499, image: 'https://picsum.photos/seed/prod9/400/400', rating: 4.8, reviewCount: 1567, category: '美妆护肤', brand: '品牌H', sales: 7650 },
  { id: '10', name: '台灯 护眼LED', price: 179, image: 'https://picsum.photos/seed/prod10/400/400', rating: 4.5, reviewCount: 678, category: '家居生活', brand: '品牌I', sales: 5430 },
  { id: '11', name: '运动短裤 速干', price: 79, originalPrice: 99, image: 'https://picsum.photos/seed/prod11/400/400', rating: 4.2, reviewCount: 345, category: '运动户外', brand: '品牌C', sales: 8760 },
  { id: '12', name: '充电宝 20000mAh', price: 149, image: 'https://picsum.photos/seed/prod12/400/400', rating: 4.7, reviewCount: 2134, category: '电子产品', brand: '品牌B', sales: 11230, isNew: true },
];

const categories = ['电子产品', '运动户外', '服装', '家居生活', '箱包', '美妆护肤'];
const brands = ['品牌A', '品牌B', '品牌C', '品牌D', '品牌E', '品牌F', '品牌G', '品牌H', '品牌I'];
const priceRanges = [
  { label: '全部价格', value: [0, 10000] as [number, number] },
  { label: '0 - 100', value: [0, 100] as [number, number] },
  { label: '100 - 300', value: [100, 300] as [number, number] },
  { label: '300 - 500', value: [300, 500] as [number, number] },
  { label: '500 - 1000', value: [500, 1000] as [number, number] },
  { label: '1000以上', value: [1000, 10000] as [number, number] },
];

export const ProductsPage: React.FC = () => {
  const [filters, setFilters] = useState<FilterState>({
    categories: [],
    brands: [],
    priceRange: [0, 10000],
    rating: null,
  });
  const [sortBy, setSortBy] = useState<SortOption>('sales');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const itemsPerPage = 8;

  const toggleCategory = useCallback((category: string) => {
    setFilters(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category],
    }));
    setCurrentPage(1);
  }, []);

  const toggleBrand = useCallback((brand: string) => {
    setFilters(prev => ({
      ...prev,
      brands: prev.brands.includes(brand)
        ? prev.brands.filter(b => b !== brand)
        : [...prev.brands, brand],
    }));
    setCurrentPage(1);
  }, []);

  const setPriceRange = useCallback((range: [number, number]) => {
    setFilters(prev => ({ ...prev, priceRange: range }));
    setCurrentPage(1);
  }, []);

  const setRatingFilter = useCallback((rating: number | null) => {
    setFilters(prev => ({ ...prev, rating }));
    setCurrentPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      categories: [],
      brands: [],
      priceRange: [0, 10000],
      rating: null,
    });
    setCurrentPage(1);
  }, []);

  const filteredAndSortedProducts = useMemo(() => {
    let result = [...mockProducts];

    if (filters.categories.length > 0) {
      result = result.filter(p => filters.categories.includes(p.category));
    }

    if (filters.brands.length > 0) {
      result = result.filter(p => filters.brands.includes(p.brand));
    }

    result = result.filter(
      p => p.price >= filters.priceRange[0] && p.price <= filters.priceRange[1]
    );

    if (filters.rating !== null) {
      result = result.filter(p => p.rating >= filters.rating!);
    }

    switch (sortBy) {
      case 'price-asc':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'sales':
        result.sort((a, b) => b.sales - a.sales);
        break;
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'newest':
        result.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
        break;
    }

    return result;
  }, [filters, sortBy]);

  const totalPages = Math.ceil(filteredAndSortedProducts.length / itemsPerPage);
  const paginatedProducts = filteredAndSortedProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const activeFiltersCount =
    filters.categories.length +
    filters.brands.length +
    (filters.priceRange[0] !== 0 || filters.priceRange[1] !== 10000 ? 1 : 0) +
    (filters.rating !== null ? 1 : 0);

  const FilterSidebar = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">筛选</h3>
        {activeFiltersCount > 0 && (
          <button
            onClick={clearFilters}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            清除全部
          </button>
        )}
      </div>

      <div>
        <h4 className="font-medium text-gray-900 mb-3">商品分类</h4>
        <div className="space-y-2">
          {categories.map(category => (
            <label key={category} className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={filters.categories.includes(category)}
                onChange={() => toggleCategory(category)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">{category}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h4 className="font-medium text-gray-900 mb-3">价格区间</h4>
        <div className="space-y-2">
          {priceRanges.map(range => (
            <label key={range.label} className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="priceRange"
                checked={
                  filters.priceRange[0] === range.value[0] &&
                  filters.priceRange[1] === range.value[1]
                }
                onChange={() => setPriceRange(range.value)}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">¥{range.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h4 className="font-medium text-gray-900 mb-3">品牌</h4>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {brands.map(brand => (
            <label key={brand} className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={filters.brands.includes(brand)}
                onChange={() => toggleBrand(brand)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">{brand}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h4 className="font-medium text-gray-900 mb-3">评分</h4>
        <div className="space-y-2">
          {[4, 3, 2].map(rating => (
            <label key={rating} className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="rating"
                checked={filters.rating === rating}
                onChange={() => setRatingFilter(rating)}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700 flex items-center">
                {rating}星及以上
                <span className="ml-1 text-yellow-400">{'★'.repeat(rating)}</span>
              </span>
            </label>
          ))}
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="rating"
              checked={filters.rating === null}
              onChange={() => setRatingFilter(null)}
              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">全部评分</span>
          </label>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">全部商品</h1>
          <p className="mt-1 text-sm text-gray-500">
            共 {filteredAndSortedProducts.length} 件商品
          </p>
        </div>

        <div className="lg:hidden mb-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            筛选
            {activeFiltersCount > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-blue-600 text-white rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex gap-6">
          {/* Sidebar - Hidden on mobile by default */}
          <aside
            className={`${
              sidebarOpen ? 'block' : 'hidden'
            } lg:block lg:w-64 flex-shrink-0`}
          >
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-4">
              <FilterSidebar />
            </div>
          </aside>

          {/* Product Grid */}
          <div className="flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAndSortedProducts.map((product) => (
                <div key={product.id} className="bg-white rounded-lg shadow-sm p-4">
                  <div className="aspect-square bg-gray-200 rounded-lg mb-4">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  </div>
                  <h3 className="font-medium text-gray-900 mb-2">{product.name}</h3>
                  <p className="text-lg font-bold text-blue-600">¥{product.price.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductsPage;