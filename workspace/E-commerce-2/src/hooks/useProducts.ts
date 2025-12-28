import { useState, useEffect, useCallback } from 'react';
import { productsApi, IProduct, IProductListParams, IProductListResponse } from '../api/products';

/**
 * 产品列表 Hook
 * @param params - 产品列表查询参数
 * @returns 产品列表数据、加载状态、错误信息和重新获取方法
 */
export const useProducts = (params?: IProductListParams) => {
  const [products, setProducts] = useState<IProduct[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response: IProductListResponse = await productsApi.getProducts(params);
      setProducts(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取产品列表失败');
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const refetch = useCallback(() => {
    fetchProducts();
  }, [fetchProducts]);

  return {
    products,
    isLoading,
    error,
    refetch,
  };
};

/**
 * 产品详情 Hook
 * @param productId - 产品ID
 * @returns 产品详情数据和加载状态
 */
export const useProductDetail = (productId: string | number) => {
  const [product, setProduct] = useState<IProduct | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProductDetail = async () => {
      if (!productId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const response = await productsApi.getProductById(productId);
        setProduct(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取产品详情失败');
        setProduct(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProductDetail();
  }, [productId]);

  return {
    product,
    isLoading,
    error,
  };
};