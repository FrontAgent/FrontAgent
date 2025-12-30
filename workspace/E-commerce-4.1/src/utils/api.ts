/**
 * API请求工具模块
 * 提供商品数据的获取功能
 */

import { Product } from '../types';

/**
 * API基础配置
 */
const API_BASE_URL = 'https://fakestoreapi.com';

/**
 * 自定义API错误类
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public statusText?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * 统一的错误处理函数
 * @param error - 捕获的错误对象
 * @throws {ApiError} 格式化后的API错误
 */
const handleError = (error: unknown): never => {
  if (error instanceof ApiError) {
    throw error;
  }
  
  if (error instanceof Error) {
    throw new ApiError(error.message);
  }
  
  throw new ApiError('An unknown error occurred');
};

/**
 * 通用的fetch请求封装
 * @param endpoint - API端点路径
 * @returns Promise<T> 返回指定类型的数据
 */
const fetchApi = async <T>(endpoint: string): Promise<T> => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    
    if (!response.ok) {
      throw new ApiError(
        `HTTP error! status: ${response.status}`,
        response.status,
        response.statusText
      );
    }
    
    const data = await response.json();
    return data as T;
  } catch (error) {
    return handleError(error);
  }
};

/**
 * 获取所有商品列表
 * @returns Promise<Product[]> 商品数组
 * @example
 * const products = await fetchProducts();
 */
export const fetchProducts = async (): Promise<Product[]> => {
  return fetchApi<Product[]>('/products');
};

/**
 * 根据ID获取单个商品详情
 * @param id - 商品ID
 * @returns Promise<Product> 商品详情对象
 * @throws {ApiError} 当商品不存在时抛出错误
 * @example
 * const product = await fetchProductById(1);
 */
export const fetchProductById = async (id: number): Promise<Product> => {
  if (!id || id <= 0) {
    throw new ApiError('Invalid product ID');
  }
  
  return fetchApi<Product>(`/products/${id}`);
};

/**
 * 获取所有商品分类
 * @returns Promise<string[]> 分类名称数组
 * @example
 * const categories = await fetchCategories();
 */
export const fetchCategories = async (): Promise<string[]> => {
  return fetchApi<string[]>('/products/categories');
};

/**
 * 根据分类获取商品列表
 * @param category - 分类名称
 * @returns Promise<Product[]> 该分类下的商品数组
 * @throws {ApiError} 当分类无效时抛出错误
 * @example
 * const electronics = await fetchProductsByCategory('electronics');
 */
export const fetchProductsByCategory = async (category: string): Promise<Product[]> => {
  if (!category || category.trim() === '') {
    throw new ApiError('Invalid category name');
  }
  
  return fetchApi<Product[]>(`/products/category/${encodeURIComponent(category)}`);
};

/**
 * 导出API配置供其他模块使用
 */
export const API_CONFIG = {
  BASE_URL: API_BASE_URL,
  ENDPOINTS: {
    PRODUCTS: '/products',
    CATEGORIES: '/products/categories',
    PRODUCT_BY_ID: (id: number) => `/products/${id}`,
    PRODUCTS_BY_CATEGORY: (category: string) => `/products/category/${category}`,
  },
} as const;