import { IProduct, IProductListResponse, IProductDetailResponse, IProductSearchParams } from '../types/productTypes';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://api.example.com';

/**
 * 获取商品列表
 * @param params 搜索参数
 * @returns Promise<IProductListResponse>
 */
export const getProductList = async (params: IProductSearchParams): Promise<IProductListResponse> => {
  const searchParams = new URLSearchParams();
  
  if (params.page) searchParams.append('page', params.page.toString());
  if (params.limit) searchParams.append('limit', params.limit.toString());
  if (params.category) searchParams.append('category', params.category);
  if (params.sortBy) searchParams.append('sortBy', params.sortBy);
  if (params.sortOrder) searchParams.append('sortOrder', params.sortOrder);
  if (params.search) searchParams.append('search', params.search);
  if (params.minPrice) searchParams.append('minPrice', params.minPrice.toString());
  if (params.maxPrice) searchParams.append('maxPrice', params.maxPrice.toString());

  const response = await fetch(`${API_BASE_URL}/products?${searchParams}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
};

/**
 * 获取商品详情
 * @param productId 商品ID
 * @returns Promise<IProductDetailResponse>
 */
export const getProductDetail = async (productId: string): Promise<IProductDetailResponse> => {
  const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
};

/**
 * 获取推荐商品
 * @param limit 返回数量限制
 * @returns Promise<IProduct[]>
 */
export const getRecommendedProducts = async (limit: number = 10): Promise<IProduct[]> => {
  const response = await fetch(`${API_BASE_URL}/products/recommended?limit=${limit}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
};

/**
 * 获取热门商品
 * @param limit 返回数量限制
 * @returns Promise<IProduct[]>
 */
export const getPopularProducts = async (limit: number = 10): Promise<IProduct[]> => {
  const response = await fetch(`${API_BASE_URL}/products/popular?limit=${limit}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
};

/**
 * 获取商品分类列表
 * @returns Promise<string[]>
 */
export const getProductCategories = async (): Promise<string[]> => {
  const response = await fetch(`${API_BASE_URL}/products/categories`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
};