import { apiClient } from './client';

/**
 * 产品接口
 */
export interface IProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  stock: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 产品列表查询参数接口
 */
export interface IProductListParams {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

/**
 * 产品 API 接口模块
 */
export const productsApi = {
  /**
   * 获取产品列表
   * @param params - 查询参数
   * @returns Promise<IProduct[]>
   */
  async getProducts(params?: IProductListParams): Promise<IProduct[]> {
    const response = await apiClient.get<IProduct[]>('/products', { params });
    return response.data;
  },

  /**
   * 根据 ID 获取单个产品详情
   * @param id - 产品 ID
   * @returns Promise<IProduct>
   */
  async getProductById(id: string): Promise<IProduct> {
    const response = await apiClient.get<IProduct>(`/products/${id}`);
    return response.data;
  },

  /**
   * 获取产品分类列表
   * @returns Promise<string[]>
   */
  async getCategories(): Promise<string[]> {
    const response = await apiClient.get<string[]>('/products/categories');
    return response.data;
  },
};