import { useState, useEffect } from 'react';
import { productApi } from '../api/productApi';
import { IProduct, IProductFilters } from '../types/IProduct';

interface UseProductsReturn {
  products: IProduct[];
  loading: boolean;
  error: string | null;
  fetchProducts: (filters?: IProductFilters) => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * Hook for managing product data fetching and state
 * @returns {UseProductsReturn} Product data and control functions
 */
export const useProducts = (initialFilters?: IProductFilters): UseProductsReturn => {
  const [products, setProducts] = useState<IProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<IProductFilters | undefined>(initialFilters);

  /**
   * Fetch products from API with optional filters
   * @param {IProductFilters} productFilters - Filters to apply to product query
   */
  const fetchProducts = async (productFilters?: IProductFilters): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const response = await productApi.getProducts(productFilters || filters);
      setProducts(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Refetch products with current filters
   */
  const refetch = async (): Promise<void> => {
    await fetchProducts(filters);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  return {
    products,
    loading,
    error,
    fetchProducts,
    refetch
  };
};