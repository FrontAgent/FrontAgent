import React, { useState, useEffect, useMemo } from 'react';
import { useProductStore } from '../stores/useProductStore';
import { useCategoryStore } from '../stores/useCategoryStore';
import { ProductCard } from '../components/features/ProductCard';
import { FilterSidebar } from '../components/features/FilterSidebar';
import { SortDropdown } from '../components/features/SortDropdown';
import { Pagination } from '../components/features/Pagination';
import { SearchBar } from '../components/features/SearchBar';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { IProduct, ISortOption, IFilterOptions } from '../types';

export const ProductListPage: React.FC = () => {
  const {
    products,
    loading,
    error,
    pagination,
    fetchProducts,
    setFilters,
    setSorting,
    setCurrentPage,
  } = useProductStore();

  const { categories, fetchCategories } = useCategoryStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [localFilters, setLocalFilters] = useState<IFilterOptions>({
    category: '',
    priceRange: [0, 1000],
    rating: 0,
    inStock: false,
  });

  const [sortOption, setSortOption] = useState<ISortOption>({
    field: 'name',
    direction: 'asc',
  });

  const sortOptions: ISortOption[] = [
    { field: 'name', direction: 'asc' },
    { field: 'name', direction: 'desc' },
    { field: 'price', direction: 'asc' },
    { field: 'price', direction: 'desc' },
    { field: 'rating', direction: 'asc' },
    { field: 'rating', direction: 'desc' },
    { field: 'createdAt', direction: 'desc' },
  ];

  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, [fetchCategories, fetchProducts]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setFilters({
        ...localFilters,
        search: searchQuery,
      });
      setSorting(sortOption);
      setCurrentPage(1);
      fetchProducts();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [localFilters, searchQuery, sortOption, setFilters, setSorting, setCurrentPage, fetchProducts]);

  const handleFilterChange = (filters: IFilterOptions) => {
    setLocalFilters(filters);
  };

  const handleSortChange = (option: ISortOption) => {
    setSortOption(option);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchProducts();
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const filteredProducts = useMemo(() => {
    return products.filter((product: IProduct) => {
      const matchesSearch = !searchQuery || 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = !localFilters.category || 
        product.categoryId === localFilters.category;

      const matchesPrice = product.price >= localFilters.priceRange[0] && 
        product.price <= localFilters.priceRange[1];

      const matchesRating = product.rating >= localFilters.rating;

      const matchesStock = !localFilters.inStock || product.stock > 0;

      return matchesSearch && matchesCategory && matchesPrice && matchesRating && matchesStock;
    });
  }, [products, searchQuery, localFilters]);

  const getSortLabel = (option: ISortOption): string => {
    const fieldLabels = {
      name: '名称',
      price: '价格',
      rating: '评分',
      createdAt: '创建时间',
    };

    const directionLabels = {
      asc: '升序',
      desc: '降序',
    };

    return `${fieldLabels[option.field]} ${directionLabels[option.direction]}`;
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">加载失败</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => fetchProducts()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">商品列表</h1>
          
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex-1 max-w-md">
              <SearchBar
                value={searchQuery}
                onChange={handleSearch}
                placeholder="搜索商品..."
              />
            </div>
            
            <div className="flex items-center gap-4">
              <SortDropdown
                options={sortOptions}
                value={sortOption}
                onChange={handleSortChange}
                getLabel={getSortLabel}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-8">
          <aside className="w-64 flex-shrink-0">
            <FilterSidebar
              categories={categories}
              filters={localFilters}
              onChange={handleFilterChange}
            />
          </aside>

          <main className="flex-1">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <LoadingSpinner />
              </div>
            ) : filteredProducts.length === 0 ? (
              <EmptyState
                title="没有找到商品"
                description="尝试调整筛选条件或搜索关键词"
                action={
                  <button
                    onClick={() => {
                      setLocalFilters({
                        category: '',
                        priceRange: [0, 1000],
                        rating: 0,
                        inStock: false,
                      });
                      setSearchQuery('');
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    清除筛选
                  </button>
                }
              />
            ) : (
              <>
                <div className="mb-6">
                  <p className="text-gray-600">
                    共找到 {pagination.total} 件商品
                    {searchQuery && ` (搜索: "${searchQuery}")`}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredProducts.map((product: IProduct) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {pagination.totalPages > 1 && (
                  <div className="mt-8 flex justify-center">
                    <Pagination
                      currentPage={pagination.currentPage}
                      totalPages={pagination.totalPages}
                      onPageChange={handlePageChange}
                    />
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};