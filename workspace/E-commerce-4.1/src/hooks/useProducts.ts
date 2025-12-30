import { useEffect, useState, useCallback } from 'react';
import { useProductStore } from '../store/productStore';
import type { Product } from '../types';

interface UseProductsOptions {
  autoFetch?: boolean;
  pageSize?: number;
}

interface UseProductsReturn {
  products: Product[];
  loading: boolean;
  error: string | null;
  filteredProducts: Product[];
  currentPage: number;
  totalPages: number;
  searchQuery: string;
  selectedCategory: string;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string) => void;
  setCurrentPage: (page: number) => void;
  refetch: () => Promise<void>;
  retry: () => Promise<void>;
}

export const useProducts = (options: UseProductsOptions = {}): UseProductsReturn => {
  const { autoFetch = true, pageSize = 12 } = options;

  const {
    products,
    loading,
    error,
    fetchProducts,
    searchProducts,
    filterByCategory,
  } = useProductStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [retryCount, setRetryCount] = useState(0);

  const fetchWithRetry = useCallback(async () => {
    try {
      await fetchProducts();
      setRetryCount(0);
    } catch (err) {
      if (retryCount < 3) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
        }, 1000 * Math.pow(2, retryCount));
      }
    }
  }, [fetchProducts, retryCount]);

  useEffect(() => {
    if (autoFetch && products.length === 0 && !loading) {
      fetchWithRetry();
    }
  }, [autoFetch, products.length, loading, fetchWithRetry]);

  useEffect(() => {
    if (retryCount > 0 && retryCount <= 3) {
      fetchWithRetry();
    }
  }, [retryCount, fetchWithRetry]);

  const filteredProducts = useCallback(() => {
    let result = [...products];

    if (searchQuery.trim()) {
      result = searchProducts(searchQuery);
    }

    if (selectedCategory) {
      result = filterByCategory(selectedCategory, result);
    }

    return result;
  }, [products, searchQuery, selectedCategory, searchProducts, filterByCategory])();

  const paginatedProducts = useCallback(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredProducts.slice(startIndex, endIndex);
  }, [filteredProducts, currentPage, pageSize])();

  const totalPages = Math.ceil(filteredProducts.length / pageSize);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const handleSetSearchQuery = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  }, []);

  const handleSetSelectedCategory = useCallback((category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1);
  }, []);

  const refetch = useCallback(async () => {
    setRetryCount(0);
    await fetchProducts();
  }, [fetchProducts]);

  const retry = useCallback(async () => {
    setRetryCount(0);
    await fetchWithRetry();
  }, [fetchWithRetry]);

  return {
    products,
    loading,
    error,
    filteredProducts: paginatedProducts,
    currentPage,
    totalPages,
    searchQuery,
    selectedCategory,
    setSearchQuery: handleSetSearchQuery,
    setSelectedCategory: handleSetSelectedCategory,
    setCurrentPage,
    refetch,
    retry,
  };
};