import React, { useState, useEffect } from 'react';
import { useProductStore } from '../../stores/useProductStore';
import { ProductCard } from '../ui/ProductCard';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { IProduct } from '../../types/IProduct';
import { IPagination } from '../../types/IPagination';

/**
 * ProductList component - Displays a grid of products with filtering and pagination
 */
export const ProductList: React.FC = () => {
  const { products, loading, error, fetchProducts, filters, setFilters, pagination } = useProductStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    fetchProducts({
      ...filters,
      search: searchTerm,
      sortBy,
      sortOrder,
      page: pagination.currentPage,
      limit: pagination.itemsPerPage
    });
  }, [searchTerm, sortBy, sortOrder, pagination.currentPage]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setFilters({ ...filters, search: value });
  };

  const handleSort = (field: string) => {
    setSortBy(field);
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  const handlePageChange = (page: number) => {
    fetchProducts({
      ...filters,
      search: searchTerm,
      sortBy,
      sortOrder,
      page,
      limit: pagination.itemsPerPage
    });
  };

  const handleCategoryFilter = (category: string) => {
    setFilters({ ...filters, category });
  };

  const handlePriceFilter = (minPrice: number, maxPrice: number) => {
    setFilters({ ...filters, minPrice, maxPrice });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600 p-4">
        <p>Error loading products: {error}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Filters Section */}
      <div className="mb-8 bg-white p-6 rounded-lg shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <Select
              value={filters.category || ''}
              onChange={(e) => handleCategoryFilter(e.target.value)}
              className="w-full"
            >
              <option value="">All Categories</option>
              <option value="electronics">Electronics</option>
              <option value="clothing">Clothing</option>
              <option value="books">Books</option>
              <option value="home">Home & Garden</option>
            </Select>
          </div>
          <div>
            <Select
              value={sortBy}
              onChange={(e) => handleSort(e.target.value)}
              className="w-full"
            >
              <option value="name">Sort by Name</option>
              <option value="price">Sort by Price</option>
              <option value="rating">Sort by Rating</option>
              <option value="createdAt">Sort by Date</option>
            </Select>
          </div>
          <div>
            <Button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              variant="outline"
              className="w-full"
            >
              {sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
            </Button>
          </div>
        </div>
        
        {/* Price Range Filter */}
        <div className="mt-4 flex items-center gap-4">
          <span className="text-sm font-medium">Price Range:</span>
          <Input
            type="number"
            placeholder="Min"
            value={filters.minPrice || ''}
            onChange={(e) => handlePriceFilter(Number(e.target.value), filters.maxPrice || 0)}
            className="w-24"
          />
          <span>-</span>
          <Input
            type="number"
            placeholder="Max"
            value={filters.maxPrice || ''}
            onChange={(e) => handlePriceFilter(filters.minPrice || 0, Number(e.target.value))}
            className="w-24"
          />
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8">
        {products.map((product: IProduct) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <Button
            onClick={() => handlePageChange(pagination.currentPage - 1)}
            disabled={pagination.currentPage === 1}
            variant="outline"
          >
            Previous
          </Button>
          
          <div className="flex gap-1">
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                onClick={() => handlePageChange(page)}
                variant={page === pagination.currentPage ? 'default' : 'outline'}
                className="w-10 h-10"
              >
                {page}
              </Button>
            ))}
          </div>
          
          <Button
            onClick={() => handlePageChange(pagination.currentPage + 1)}
            disabled={pagination.currentPage === pagination.totalPages}
            variant="outline"
          >
            Next
          </Button>
        </div>
      )}

      {/* Results Count */}
      <div className="mt-4 text-center text-gray-600">
        Showing {products.length} of {pagination.totalItems} products
      </div>
    </div>
  );
};