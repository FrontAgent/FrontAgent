import React, { useState, useEffect, useMemo } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ProductCard from '../components/ProductCard';
import { Product } from '../types';

const ProductList: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [minRating, setMinRating] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'price-asc' | 'price-desc' | 'sales' | 'newest'>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const itemsPerPage = 12;

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const mockProducts: Product[] = Array.from({ length: 50 }, (_, i) => ({
          id: i + 1,
          name: `商品 ${i + 1}`,
          price: Math.floor(Math.random() * 9000) + 100,
          image: `https://picsum.photos/300/300?random=${i}`,
          category: ['电子产品', '服装', '家居', '图书', '运动'][Math.floor(Math.random() * 5)],
          rating: Math.floor(Math.random() * 5) + 1,
          sales: Math.floor(Math.random() * 10000),
          description: `这是商品 ${i + 1} 的描述`,
        }));
        setProducts(mockProducts);
      } catch (error) {
        console.error('Failed to fetch products:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return ['all', ...Array.from(cats)];
  }, [products]);

  const filteredAndSortedProducts = useMemo(() => {
    let filtered = products.filter(product => {
      const categoryMatch = selectedCategory === 'all' || product.category === selectedCategory;
      const priceMatch = product.price >= priceRange[0] && product.price <= priceRange[1];
      const ratingMatch = product.rating >= minRating;
      return categoryMatch && priceMatch && ratingMatch;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price-asc':
          return a.price - b.price;
        case 'price-desc':
          return b.price - a.price;
        case 'sales':
          return b.sales - a.sales;
        case 'newest':
        default:
          return b.id - a.id;
      }
    });

    return filtered;
  }, [products, selectedCategory, priceRange, minRating, sortBy]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedProducts, currentPage]);

  const totalPages = Math.ceil(filteredAndSortedProducts.length / itemsPerPage);

  const FilterSidebar = () => (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4">筛选</h3>
      
      <div className="mb-6">
        <h4 className="font-medium mb-3">分类</h4>
        <div className="space-y-2">
          {categories.map(cat => (
            <label key={cat} className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="category"
                checked={selectedCategory === cat}
                onChange={() => setSelectedCategory(cat)}
                className="mr-2"
              />
              <span className="text-sm">{cat === 'all' ? '全部' : cat}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <h4 className="font-medium mb-3">价格区间</h4>
        <div className="space-y-2">
          <input
            type="range"
            min="0"
            max="10000"
            value={priceRange[0]}
            onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
            className="w-full"
          />
          <input
            type="range"
            min="0"
            max="10000"
            value={priceRange[1]}
            onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-gray-600">
            <span>¥{priceRange[0]}</span>
            <span>¥{priceRange[1]}</span>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h4 className="font-medium mb-3">最低评分</h4>
        <div className="space-y-2">
          {[0, 1, 2, 3, 4, 5].map(rating => (
            <label key={rating} className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="rating"
                checked={minRating === rating}
                onChange={() => setMinRating(rating)}
                className="mr-2"
              />
              <span className="text-sm flex items-center">
                {rating === 0 ? '全部' : (
                  <>
                    {rating}
                    <span className="text-yellow-400 ml-1">★</span>
                    <span className="text-gray-400">及以上</span>
                  </>
                )}
              </span>
            </label>
          ))}
        </div>
      </div>

      <button
        onClick={() => {
          setSelectedCategory('all');
          setPriceRange([0, 10000]);
          setMinRating(0);
        }}
        className="w-full py-2 px-4 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
      >
        重置筛选
      </button>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="hidden lg:block lg:w-64 flex-shrink-0">
            <FilterSidebar />
          </aside>

          <div className="flex-grow">
            <div className="bg-white p-4 rounded-lg shadow-md mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsMobileFilterOpen(true)}
                  className="lg:hidden px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                >
                  筛选
                </button>
                <span className="text-gray-600">
                  共 {filteredAndSortedProducts.length} 件商品
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">排序:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="newest">最新</option>
                  <option value="price-asc">价格从低到高</option>
                  <option value="price-desc">价格从高到低</option>
                  <option value="sales">销量最高</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : paginatedProducts.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <svg className="mx-auto h-24 w-24 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">没有找到商品</h3>
                <p className="text-gray-500">请尝试调整筛选条件</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {paginatedProducts.map(product => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="mt-8 flex justify-center items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      上一页
                    </button>
                    
                    <div className="flex gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`px-4 py-2 rounded ${
                              currentPage === pageNum
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      下一页
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {isMobileFilterOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 lg:hidden">
          <div className="absolute right-0 top-0 h-full w-80 bg-white shadow-xl overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold">筛选</h3>
              <button
                onClick={() => setIsMobileFilterOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <FilterSidebar />
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default ProductList;