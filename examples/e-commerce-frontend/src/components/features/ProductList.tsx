import React, { useState, useEffect, useMemo } from 'react';
import { ProductCard } from '../ui/ProductCard';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { useProductStore } from '../../stores/useProductStore';
import { IProduct, IFilterOptions, ISortOption } from '../../types';

interface ProductListProps {
  categoryId?: string;
  searchQuery?: string;
}

const SORT_OPTIONS: ISortOption[] = [
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'price-asc', label: 'Price (Low to High)' },
  { value: 'price-desc', label: 'Price (High to Low)' },
  { value: 'rating-desc', label: 'Rating (High to Low)' },
];

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'books', label: 'Books' },
  { value: 'home', label: 'Home & Garden' },
];

export const ProductList: React.FC<ProductListProps> = ({ categoryId, searchQuery }) => {
  const { products, loading, error, fetchProducts } = useProductStore();
  const [filters, setFilters] = useState<IFilterOptions>({
    category: categoryId || 'all',
    priceRange: [0, 1000],
    inStock: false,
  });
  const [sortBy, setSortBy] = useState<string>('name-asc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [priceMin, setPriceMin] = useState<number>(0);
  const [priceMax, setPriceMax] = useState<number>(1000);

  const productsPerPage = 12;

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    if (categoryId) {
      setFilters(prev => ({ ...prev, category: categoryId }));
    }
  }, [categoryId]);

  const filteredAndSortedProducts = useMemo(() => {
    let filtered = products;

    if (searchQuery) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filters.category !== 'all') {
      filtered = filtered.filter(product => product.category === filters.category);
    }

    filtered = filtered.filter(product =>
      product.price >= filters.priceRange[0] && product.price <= filters.priceRange[1]
    );

    if (filters.inStock) {
      filtered = filtered.filter(product => product.stock > 0);
    }

    const [sortField, sortOrder] = sortBy.split('-');
    filtered.sort((a, b) => {
      let aValue: string | number = a[sortField as keyof IProduct];
      let bValue: string | number = b[sortField as keyof IProduct];

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = (bValue as string).toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [products, searchQuery, filters, sortBy]);

  const totalPages = Math.ceil(filteredAndSortedProducts.length / productsPerPage);
  const startIndex = (currentPage - 1) * productsPerPage;
  const paginatedProducts = filteredAndSortedProducts.slice(startIndex, startIndex + productsPerPage);

  const handleCategoryChange = (value: string) => {
    setFilters(prev => ({ ...prev, category: value }));
    setCurrentPage(1);
  };

  const handlePriceRangeChange = () => {
    setFilters(prev => ({ ...prev, priceRange: [priceMin, priceMax] }));
    setCurrentPage(1);
  };

  const handleStockFilterChange = (checked: boolean) => {
    setFilters(prev => ({ ...prev, inStock: checked }));
    setCurrentPage(1);
  };

  const handleSortChange = (value: string) => {
    setSortBy(value);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 text-lg">Error loading products: {error}</p>
        <Button onClick={fetchProducts} className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Products</h1>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <Select
                value={filters.category}
                onChange={handleCategoryChange}
                options={CATEGORIES}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Price Range
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={priceMin}
                  onChange={(e) => setPriceMin(Number(e.target.value))}
                  className="w-20"
                />
                <span className="self-center">-</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={priceMax}
                  onChange={(e) => setPriceMax(Number(e.target.value))}
                  className="w-20"
                />
                <Button onClick={handlePriceRangeChange} size="sm">
                  Apply
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sort By
              </label>
              <Select
                value={sortBy}
                onChange={handleSortChange}
                options={SORT_OPTIONS}
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.inStock}
                  onChange={(e) => handleStockFilterChange(e.target.checked)}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700">In Stock Only</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 flex justify-between items-center">
        <p className="text-gray-600">
          Showing {paginatedProducts.length} of {filteredAndSortedProducts.length} products
        </p>
      </div>

      {paginatedProducts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No products found matching your criteria.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8">
            {paginatedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center space-x-2">
              <Button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                variant="outline"
                size="sm"
              >
                Previous
              </Button>

              <div className="flex space-x-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="sm"
                    className="w-10"
                  >
                    {page}
                  </Button>
                ))}
              </div>

              <Button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                variant="outline"
                size="sm"
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};