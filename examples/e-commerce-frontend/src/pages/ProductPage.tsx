import React, { useState, useEffect } from 'react';
import { Search, Filter, Grid, List } from 'lucide-react';

/**
 * 商品数据类型定义
 */
interface IProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string;
  description: string;
  rating: number;
  stock: number;
}

/**
 * 分类数据类型定义
 */
interface ICategory {
  id: string;
  name: string;
  count: number;
}

/**
 * 筛选状态类型定义
 */
interface IFilterState {
  searchTerm: string;
  selectedCategory: string;
  sortBy: 'name' | 'price' | 'rating';
  sortOrder: 'asc' | 'desc';
  viewMode: 'grid' | 'list';
}

/**
 * 商品卡片组件
 */
const ProductCard: React.FC<{
  product: IProduct;
  viewMode: 'grid' | 'list';
}> = ({ product, viewMode }) => {
  if (viewMode === 'list') {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 flex gap-4 hover:shadow-lg transition-shadow">
        <img
          src={product.image}
          alt={product.name}
          className="w-24 h-24 object-cover rounded-md"
        />
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {product.name}
          </h3>
          <p className="text-gray-600 text-sm mb-2 line-clamp-2">
            {product.description}
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-blue-600">
                ¥{product.price}
              </span>
              <span className="text-sm text-gray-500">
                评分: {product.rating}
              </span>
            </div>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
              加入购物车
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <img
        src={product.image}
        alt={product.name}
        className="w-full h-48 object-cover"
      />
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
          {product.name}
        </h3>
        <p className="text-gray-600 text-sm mb-2 line-clamp-2">
          {product.description}
        </p>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xl font-bold text-blue-600">
            ¥{product.price}
          </span>
          <span className="text-sm text-gray-500">
            评分: {product.rating}
          </span>
        </div>
        <button className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors">
          加入购物车
        </button>
      </div>
    </div>
  );
};

/**
 * 筛选栏组件
 */
const FilterBar: React.FC<{
  categories: ICategory[];
  filterState: IFilterState;
  onFilterChange: (filters: Partial<IFilterState>) => void;
  productCount: number;
}> = ({ categories, filterState, onFilterChange, productCount }) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex flex-col lg:flex-row gap-4 items-center">
        {/* 搜索框 */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="搜索商品..."
            value={filterState.searchTerm}
            onChange={(e) => onFilterChange({ searchTerm: e.target.value })}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 分类筛选 */}
        <div className="flex items-center gap-2">
          <Filter className="text-gray-400 w-5 h-5" />
          <select
            value={filterState.selectedCategory}
            onChange={(e) => onFilterChange({ selectedCategory: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">全部分类</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name} ({category.count})
              </option>
            ))}
          </select>
        </div>

        {/* 排序 */}
        <div className="flex items-center gap-2">
          <select
            value={`${filterState.sortBy}-${filterState.sortOrder}`}
            onChange={(e) => {
              const [sortBy, sortOrder] = e.target.value.split('-') as [IFilterState['sortBy'], IFilterState['sortOrder']];
              onFilterChange({ sortBy, sortOrder });
            }}
            className="border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="name-asc">名称 A-Z</option>
            <option value="name-desc">名称 Z-A</option>
            <option value="price-asc">价格从低到高</option>
            <option value="price-desc">价格从高到低</option>
            <option value="rating-desc">评分从高到低</option>
            <option value="rating-asc">评分从低到高</option>
          </select>
        </div>

        {/* 视图切换 */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-md p-1">
          <button
            onClick={() => onFilterChange({ viewMode: 'grid' })}
            className={`p-2 rounded-md transition-colors ${
              filterState.viewMode === 'grid'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Grid className="w-5 h-5" />
          </button>
          <button
            onClick={() => onFilterChange({ viewMode: 'list' })}
            className={`p-2 rounded-md transition-colors ${
              filterState.viewMode === 'list'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 结果统计 */}
      <div className="mt-4 text-sm text-gray-600">
        共找到 {productCount} 件商品
      </div>
    </div>
  );
};

/**
 * 商品列表页面主组件
 */
const ProductPage: React.FC = () => {
  const [products, setProducts] = useState<IProduct[]>([]);
  const [categories, setCategories] = useState<ICategory[]>([]);
  const [filterState, setFilterState] = useState<IFilterState>({
    searchTerm: '',
    selectedCategory: '',
    sortBy: 'name',
    sortOrder: 'asc',
    viewMode: 'grid',
  });
  const [loading, setLoading] = useState(true);

  /**
   * 模拟商品数据
   */
  const mockProducts: IProduct[] = [
    {
      id: '1',
      name: 'iPhone 15 Pro',
      price: 7999,
      category: 'electronics',
      image: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400',
      description: '最新款iPhone，搭载A17 Pro芯片，性能强劲',
      rating: 4.8,
      stock: 50,
    },
    {
      id: '2',
      name: 'MacBook Air M2',
      price: 8999,
      category: 'electronics',
      image: 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=400',
      description: '轻薄便携，搭载M2芯片，续航持久',
      rating: 4.9,
      stock: 30,
    },
    {
      id: '3',
      name: 'Nike Air Max',
      price: 899,
      category: 'fashion',
      image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400',
      description: '经典运动鞋，舒适透气，时尚百搭',
      rating: 4.6,
      stock: 100,
    },
    {
      id: '4',
      name: '咖啡杯套装',
      price: 199,
      category: 'home',
      image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcf93a?w=400',
      description: '精美陶瓷材质，适合家用和办公',
      rating: 4.4,
      stock: 80,
    },
    {
      id: '5',
      name: '无线蓝牙耳机',
      price: 299,
      category: 'electronics',
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400',
      description: '主动降噪，高品质音效，长续航',
      rating: 4.7,
      stock: 60,
    },
    {
      id: '6',
      name: '瑜伽垫',
      price: 159,
      category: 'sports',
      image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400',
      description: '防滑环保材质，适合各种瑜伽动作',
      rating: 4.5,
      stock: 40,
    },
  ];

  /**
   * 模拟分类数据
   */
  const mockCategories: ICategory[] = [
    { id: 'electronics', name: '电子产品', count: 3 },
    { id: 'fashion', name: '时尚服饰', count: 1 },
    { id: 'home', name: '家居用品', count: 1 },
    { id: 'sports', name: '运动健身', count: 1 },
  ];

  /**
   * 初始化数据
   */
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 500));
      setProducts(mockProducts);
      setCategories(mockCategories);
      setLoading(false);
    };

    loadData();
  }, []);

  /**
   * 筛选和排序商品
   */
  const filteredAndSortedProducts = React.useMemo(() => {
    let filtered = products.filter((product) => {
      const matchesSearch = product.name.toLowerCase().includes(filterState.searchTerm.toLowerCase()) ||
                           product.description.toLowerCase().includes(filterState.searchTerm.toLowerCase());
      const matchesCategory = !filterState.selectedCategory || product.category === filterState.selectedCategory;
      
      return matchesSearch && matchesCategory;
    });

    // 排序
    filtered.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (filterState.sortBy) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'price':
          aValue = a.price;
          bValue = b.price;
          break;
        case 'rating':
          aValue = a.rating;
          bValue = b.rating;
          break;
        default:
          aValue = a.name;
          bValue = b.name;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return filterState.sortOrder === 'asc' ? comparison : -comparison;
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        const comparison = aValue - bValue;
        return filterState.sortOrder === 'asc' ? comparison : -comparison;
      }

      return 0;
    });

    return filtered;
  }, [products, filterState]);

  /**
   * 处理筛选条件变化
   */
  const handleFilterChange = (newFilters: Partial<IFilterState>) => {
    setFilterState(prev => ({ ...prev, ...newFilters }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 页面头部 */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">商品列表</h1>
          <p className="mt-2 text-gray-600">
            发现优质商品，满足您的各种需求
          </p>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 筛选栏 */}
        <FilterBar
          categories={categories}
          filterState={filterState}
          onFilterChange={handleFilterChange}
          productCount={filteredAndSortedProducts.length}
        />

        {/* 商品列表 */}
        {filteredAndSortedProducts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Search className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              没有找到相关商品
            </h3>
            <p className="text-gray-600">
              请尝试调整搜索条件或筛选条件
            </p>
          </div>
        ) : (
          <div
            className={
              filterState.viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                : 'space-y-4'
            }
          >
            {filteredAndSortedProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                viewMode={filterState.viewMode}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductPage;