import React, { useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ProductCard from '../components/ProductCard';

interface Product {
  id: number;
  name: string;
  price: number;
  image: string;
  category: string;
  brand: string;
  rating: number;
  sales: number;
}

const mockProducts: Product[] = [
  { id: 1, name: '商品1', price: 299, image: '/images/product1.jpg', category: '电子产品', brand: '品牌A', rating: 4.5, sales: 1200 },
  { id: 2, name: '商品2', price: 199, image: '/images/product2.jpg', category: '服装', brand: '品牌B', rating: 4.2, sales: 800 },
  { id: 3, name: '商品3', price: 399, image: '/images/product3.jpg', category: '电子产品', brand: '品牌C', rating: 4.8, sales: 1500 },
  { id: 4, name: '商品4', price: 159, image: '/images/product4.jpg', category: '家居', brand: '品牌A', rating: 4.0, sales: 600 },
  { id: 5, name: '商品5', price: 499, image: '/images/product5.jpg', category: '电子产品', brand: '品牌B', rating: 4.6, sales: 2000 },
  { id: 6, name: '商品6', price: 89, image: '/images/product6.jpg', category: '服装', brand: '品牌C', rating: 3.9, sales: 400 },
  { id: 7, name: '商品7', price: 259, image: '/images/product7.jpg', category: '家居', brand: '品牌A', rating: 4.3, sales: 900 },
  { id: 8, name: '商品8', price: 599, image: '/images/product8.jpg', category: '电子产品', brand: '品牌B', rating: 4.7, sales: 1800 },
];

const ProductListPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [sortBy, setSortBy] = useState<string>('default');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const itemsPerPage = 12;

  const categories = ['电子产品', '服装', '家居'];
  const brands = ['品牌A', '品牌B', '品牌C'];

  const filteredProducts = mockProducts.filter(product => {
    if (selectedCategory && product.category !== selectedCategory) return false;
    if (selectedBrand && product.brand !== selectedBrand) return false;
    if (product.price < priceRange[0] || product.price > priceRange[1]) return false;
    return true;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case 'price-asc':
        return a.price - b.price;
      case 'price-desc':
        return b.price - a.price;
      case 'sales':
        return b.sales - a.sales;
      case 'rating':
        return b.rating - a.rating;
      default:
        return 0;
    }
  });

  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);
  const paginatedProducts = sortedProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const resetFilters = () => {
    setSelectedCategory('');
    setSelectedBrand('');
    setPriceRange([0, 1000]);
    setSortBy('default');
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          <button
            className="lg:hidden bg-blue-600 text-white px-4 py-2 rounded-lg mb-4"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
          >
            {isFilterOpen ? '隐藏筛选' : '显示筛选'}
          </button>

          <aside className={`lg:w-64 bg-white rounded-lg shadow-md p-6 ${isFilterOpen ? 'block' : 'hidden lg:block'}`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">筛选条件</h2>
              <button
                onClick={resetFilters}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                重置
              </button>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold mb-3">分类</h3>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="category"
                    checked={selectedCategory === ''}
                    onChange={() => setSelectedCategory('')}
                    className="mr-2"
                  />
                  全部
                </label>
                {categories.map(category => (
                  <label key={category} className="flex items-center">
                    <input
                      type="radio"
                      name="category"
                      checked={selectedCategory === category}
                      onChange={() => setSelectedCategory(category)}
                      className="mr-2"
                    />
                    {category}
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold mb-3">品牌</h3>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="brand"
                    checked={selectedBrand === ''}
                    onChange={() => setSelectedBrand('')}
                    className="mr-2"
                  />
                  全部
                </label>
                {brands.map(brand => (
                  <label key={brand} className="flex items-center">
                    <input
                      type="radio"
                      name="brand"
                      checked={selectedBrand === brand}
                      onChange={() => setSelectedBrand(brand)}
                      className="mr-2"
                    />
                    {brand}
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold mb-3">价格区间</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={priceRange[0]}
                    onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                    className="w-full border rounded px-2 py-1"
                    placeholder="最低价"
                  />
                  <span>-</span>
                  <input
                    type="number"
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                    className="w-full border rounded px-2 py-1"
                    placeholder="最高价"
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="1000"
                  value={priceRange[1]}
                  onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                  className="w-full"
                />
              </div>
            </div>
          </aside>

          <div className="flex-1">
            <div className="bg-white rounded-lg shadow-md p-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="text-gray-600">
                共 <span className="font-semibold text-blue-600">{sortedProducts.length}</span> 件商品
              </div>
              <div className="flex items-center gap-2">
                <label className="text-gray-600">排序：</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="border rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="default">默认</option>
                  <option value="price-asc">价格从低到高</option>
                  <option value="price-desc">价格从高到低</option>
                  <option value="sales">销量</option>
                  <option value="rating">评分</option>
                </select>
              </div>
            </div>

            {paginatedProducts.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <p className="text-gray-500 text-lg">暂无符合条件的商品</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {paginatedProducts.map(product => (
                    <ProductCard
                      key={product.id}
                      id={product.id}
                      name={product.name}
                      price={product.price}
                      image={product.image}
                    />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="mt-8 flex justify-center items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      上一页
                    </button>
                    
                    <div className="flex gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-2 rounded-lg ${
                            currentPage === page
                              ? 'bg-blue-600 text-white'
                              : 'border hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
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

      <Footer />
    </div>
  );
};

export default ProductListPage;