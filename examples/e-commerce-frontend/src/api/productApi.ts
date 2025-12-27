export interface IProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  stock: number;
  rating: number;
  reviews: number;
  createdAt: string;
  updatedAt: string;
}

export interface IProductListResponse {
  products: IProduct[];
  total: number;
  page: number;
  limit: number;
}

export interface IProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  search?: string;
}

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

/**
 * 获取产品列表
 * @param page 页码
 * @param limit 每页数量
 * @param filters 过滤条件
 * @returns 产品列表响应
 */
export const getProducts = async (
  page: number = 1,
  limit: number = 10,
  filters: IProductFilters = {}
): Promise<IProductListResponse> => {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...(filters.category && { category: filters.category }),
    ...(filters.minPrice && { minPrice: filters.minPrice.toString() }),
    ...(filters.maxPrice && { maxPrice: filters.maxPrice.toString() }),
    ...(filters.rating && { rating: filters.rating.toString() }),
    ...(filters.search && { search: filters.search }),
  });

  const response = await fetch(`${API_BASE_URL}/products?${queryParams}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch products: ${response.statusText}`);
  }
  
  return response.json();
};

/**
 * 根据ID获取单个产品详情
 * @param id 产品ID
 * @returns 产品详情
 */
export const getProductById = async (id: string): Promise<IProduct> => {
  const response = await fetch(`${API_BASE_URL}/products/${id}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch product: ${response.statusText}`);
  }
  
  return response.json();
};

/**
 * 获取产品分类列表
 * @returns 分类列表
 */
export const getCategories = async (): Promise<string[]> => {
  const response = await fetch(`${API_BASE_URL}/categories`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch categories: ${response.statusText}`);
  }
  
  return response.json();
};

/**
 * 获取推荐产品
 * @param limit 推荐数量
 * @returns 推荐产品列表
 */
export const getRecommendedProducts = async (limit: number = 5): Promise<IProduct[]> => {
  const response = await fetch(`${API_BASE_URL}/products/recommended?limit=${limit}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch recommended products: ${response.statusText}`);
  }
  
  return response.json();
};

/**
 * 搜索产品
 * @param query 搜索关键词
 * @param page 页码
 * @param limit 每页数量
 * @returns 搜索结果
 */
export const searchProducts = async (
  query: string,
  page: number = 1,
  limit: number = 10
): Promise<IProductListResponse> => {
  const queryParams = new URLSearchParams({
    q: query,
    page: page.toString(),
    limit: limit.toString(),
  });

  const response = await fetch(`${API_BASE_URL}/products/search?${queryParams}`);
  
  if (!response.ok) {
    throw new Error(`Failed to search products: ${response.statusText}`);
  }
  
  return response.json();
};