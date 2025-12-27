import { TProduct, TProductListResponse, TProductDetailResponse } from '../types/product';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api';

/**
 * 构建请求URL
 */
const buildUrl = (endpoint: string, params?: Record<string, string | number>): string => {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });
  }
  
  return url.toString();
};

/**
 * 处理API响应
 */
const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }
  
  return response.json();
};

/**
 * 获取商品列表
 */
export const getProductList = async (
  page: number = 1,
  limit: number = 20,
  category?: string,
  search?: string
): Promise<TProductListResponse> => {
  const params: Record<string, string | number> = {
    page,
    limit
  };
  
  if (category) {
    params.category = category;
  }
  
  if (search) {
    params.search = search;
  }
  
  const url = buildUrl('/products', params);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  return handleResponse<TProductListResponse>(response);
};

/**
 * 获取商品详情
 */
export const getProductDetail = async (productId: string): Promise<TProductDetailResponse> => {
  const url = buildUrl(`/products/${productId}`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  return handleResponse<TProductDetailResponse>(response);
};

/**
 * 获取推荐商品
 */
export const getRecommendedProducts = async (
  productId: string,
  limit: number = 6
): Promise<TProductListResponse> => {
  const url = buildUrl(`/products/${productId}/recommendations`, { limit });
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  return handleResponse<TProductListResponse>(response);
};

/**
 * 获取热门商品
 */
export const getPopularProducts = async (
  limit: number = 10
): Promise<TProductListResponse> => {
  const url = buildUrl('/products/popular', { limit });
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  return handleResponse<TProductListResponse>(response);
};

/**
 * 获取新品上市
 */
export const getNewProducts = async (
  limit: number = 10
): Promise<TProductListResponse> => {
  const url = buildUrl('/products/new', { limit });
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  return handleResponse<TProductListResponse>(response);
};

/**
 * 获取商品分类列表
 */
export const getProductCategories = async (): Promise<string[]> => {
  const url = buildUrl('/products/categories');
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  return handleResponse<string[]>(response);
};

/**
 * 搜索商品
 */
export const searchProducts = async (
  query: string,
  page: number = 1,
  limit: number = 20,
  category?: string
): Promise<TProductListResponse> => {
  const params: Record<string, string | number> = {
    q: query,
    page,
    limit
  };
  
  if (category) {
    params.category = category;
  }
  
  const url = buildUrl('/products/search', params);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  return handleResponse<TProductListResponse>(response);
};

/**
 * 获取商品价格区间
 */
export const getProductPriceRange = async (
  category?: string
): Promise<{ min: number; max: number }> => {
  const params = category ? { category } : undefined;
  const url = buildUrl('/products/price-range', params);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  return handleResponse<{ min: number; max: number }>(response);
};

/**
 * 获取商品库存状态
 */
export const getProductStockStatus = async (
  productId: string
): Promise<{ inStock: boolean; stockCount: number }> => {
  const url = buildUrl(`/products/${productId}/stock`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  return handleResponse<{ inStock: boolean; stockCount: number }>(response);
};

/**
 * 获取商品评价统计
 */
export const getProductRatingStats = async (
  productId: string
): Promise<{
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
}> => {
  const url = buildUrl(`/products/${productId}/ratings`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  return handleResponse<{
    averageRating: number;
    totalReviews: number;
    ratingDistribution: Record<number, number>;
  }>(response);
};