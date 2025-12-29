import { useState, useEffect, useCallback } from 'react';

interface Product {
  id: number;
  title: string;
  price: number;
  description: string;
  category: string;
  image: string;
  rating: {
    rate: number;
    count: number;
  };
}

interface UseProductsReturn {
  products: Product[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

interface UseProductByIdReturn {
  product: Product | null;
  loading: boolean;
  error: string | null;
}

interface UseCategoriesReturn {
  categories: string[];
  loading: boolean;
  error: string | null;
}

export const useProducts = (): UseProductsReturn => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState<number>(0);

  const refetch = useCallback(() => {
    setRefetchTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;

    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('https://fakestoreapi.com/products');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (isMounted) {
          setProducts(data);
          setLoading(false);
        }
      } catch (err) {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(() => {
            if (isMounted) {
              fetchProducts();
            }
          }, 1000 * retryCount);
        } else {
          if (isMounted) {
            setError(err instanceof Error ? err.message : 'Failed to fetch products');
            setLoading(false);
          }
        }
      }
    };

    fetchProducts();

    return () => {
      isMounted = false;
    };
  }, [refetchTrigger]);

  return { products, loading, error, refetch };
};

export const useProductById = (productId: number): UseProductByIdReturn => {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;

    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`https://fakestoreapi.com/products/${productId}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (isMounted) {
          setProduct(data);
          setLoading(false);
        }
      } catch (err) {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(() => {
            if (isMounted) {
              fetchProduct();
            }
          }, 1000 * retryCount);
        } else {
          if (isMounted) {
            setError(err instanceof Error ? err.message : 'Failed to fetch product');
            setLoading(false);
          }
        }
      }
    };

    if (productId) {
      fetchProduct();
    }

    return () => {
      isMounted = false;
    };
  }, [productId]);

  return { product, loading, error };
};

export const useCategories = (): UseCategoriesReturn => {
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;

    const fetchCategories = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('https://fakestoreapi.com/products/categories');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (isMounted) {
          setCategories(data);
          setLoading(false);
        }
      } catch (err) {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(() => {
            if (isMounted) {
              fetchCategories();
            }
          }, 1000 * retryCount);
        } else {
          if (isMounted) {
            setError(err instanceof Error ? err.message : 'Failed to fetch categories');
            setLoading(false);
          }
        }
      }
    };

    fetchCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  return { categories, loading, error };
};