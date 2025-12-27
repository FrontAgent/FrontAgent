import { TProduct, TProductListResponse, TProductSearchParams } from '../types/product';

const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

/**
 * 构建查询字符串
 */
const buildQueryString = (params: Record<string, any>): string => {
  const searchParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  
  return searchParams.toString();
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
export const getProducts = async (
  page: number = 1,
  limit: number = 20,
  category?: string,
  sortBy?: string,
  sortOrder?: 'asc' | 'desc'
): Promise<TProductListResponse> => {
  const params: Record<string, any> = {
    page,
    limit,
  };
  
  if (category) params.category = category;
  if (sortBy) params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;
  
  const queryString = buildQueryString(params);
  const url = `${API_BASE_URL}/products${queryString ? `?${queryString}` : ''}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  return handleResponse<TProductListResponse>(response);
};

/**
 * 根据ID获取商品详情
 */
export const getProductById = async (id: string): Promise<TProduct> => {
  const url = `${API_BASE_URL}/products/${id}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  return handleResponse<TProduct>(response);
};

/**
 * 搜索商品
 */
export const searchProducts = async (
  searchParams: TProductSearchParams
): Promise<TProductListResponse> => {
  const queryString = buildQueryString(searchParams);
  const url = `${API_BASE_URL}/products/search${queryString ? `?${queryString}` : ''}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  return handleResponse<TProductListResponse>(response);
};

/**
 * 获取推荐商品
 */
export const getRecommendedProducts = async (
  productId: string,
  limit: number = 5
): Promise<TProduct[]> => {
  const params = { productId, limit };
  const queryString = buildQueryString(params);
  const url = `${API_BASE_URL}/products/recommended${queryString ? `?${queryString}` : ''}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  const data = await handleResponse<{ products: TProduct[] }>(response);
  return data.products;
};

/**
 * 获取热门商品
 */
export const getPopularProducts = async (
  limit: number = 10
): Promise<TProduct[]> => {
  const params = { limit };
  const queryString = buildQueryString(params);
  const url = `${API_BASE_URL}/products/popular${queryString ? `?${queryString}` : ''}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  const data = await handleResponse<{ products: TProduct[] }>(response);
  return data.products;
};

/**
 * 获取商品分类列表
 */
export const getProductCategories = async (): Promise<string[]> => {
  const url = `${API_BASE_URL}/products/categories`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  const data = await handleResponse<{ categories: string[] }>(response);
  return data.categories;
};