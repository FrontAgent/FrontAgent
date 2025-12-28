import { useEffect, useCallback } from 'react';
import { useProductStore } from '../store/productStore';
import type { Product } from '../types';

interface UseProductsReturn {
  products: Product[];
  loading: boolean;
  error: string | null;
  getProduct: (id: string) => Product | undefined;
  filterByCategory: (category: string) => Product[];
  searchProducts: (query: string) => Product[];
}

export const useProducts = (): UseProductsReturn => {
  const { 
    products, 
    loading, 
    error, 
    fetchProducts 
  } = useProductStore();

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const getProduct = useCallback((id: string): Product | undefined => {
    return products.find(product => product.id === id);
  }, [products]);

  const filterByCategory = useCallback((category: string): Product[] => {
    if (!category || category === 'all') {
      return products;
    }
    return products.filter(product => 
      product.category.toLowerCase() === category.toLowerCase()
    );
  }, [products]);

  const searchProducts = useCallback((query: string): Product[] => {
    if (!query || query.trim() === '') {
      return products;
    }

    const lowerQuery = query.toLowerCase().trim();
    
    return products.filter(product => {
      const nameMatch = product.name.toLowerCase().includes(lowerQuery);
      const descriptionMatch = product.description.toLowerCase().includes(lowerQuery);
      const categoryMatch = product.category.toLowerCase().includes(lowerQuery);
      
      return nameMatch || descriptionMatch || categoryMatch;
    });
  }, [products]);

  return {
    products,
    loading,
    error,
    getProduct,
    filterByCategory,
    searchProducts
  };
};