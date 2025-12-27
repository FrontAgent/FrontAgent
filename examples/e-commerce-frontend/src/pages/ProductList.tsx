import React, { useState, useEffect, useMemo } from 'react';
import { useProductStore } from '../stores/useProductStore';
import { IProduct, IFilterOptions } from '../types/Product';
import ProductCard from '../components/features/ProductCard';
import SearchBar from '../components/ui/SearchBar';
import FilterPanel from '../components/features/FilterPanel';
import LoadingSpinner from '../components/ui/LoadingSpinner';

/**
 * ProductList page component
 * Displays all products with search and filter functionality
 */
const ProductList: React.FC = () => {
  const { products, loading, fetchProducts } = useProductStore();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filters, setFilters] = useState<IFilterOptions>({
    category: '',
    minPrice: 0,
    maxPrice: 1000,
    sortBy: 'name',
    sortOrder: 'asc'
  });

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const filteredProducts = useMemo(() => {
    let filtered = products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           product.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = !filters.category || product.category === filters.category;
      const matchesPrice = product.price >= filters.minPrice && product.price <= filters.maxPrice;
      
      return matchesSearch && matchesCategory && matchesPrice;
    });

    filtered.sort((a, b) => {
      const { sortBy, sortOrder } = filters;
      let comparison = 0;
      
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'price') {
        comparison = a.price - b.price;
      } else if (sortBy === 'rating') {
        comparison = a.rating - b.rating;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [products, searchTerm, filters]);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  const handleFilterChange = (newFilters: Partial<IFilterOptions>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return Array.from(cats);
  }, [products]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Products</h1>
      
      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="lg:w-64">
          <FilterPanel
            categories={categories}
            filters={filters}
            onFilterChange={handleFilterChange}
          />
        </aside>
        
        <main className="flex-1">
          <div className="mb-6">
            <SearchBar
              value={searchTerm}
              onChange={handleSearch}
              placeholder="Search products..."
            />
          </div>
          
          <div className="mb-4 text-gray-600">
            {filteredProducts.length} products found
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          
          {filteredProducts.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No products found matching your criteria
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ProductList;