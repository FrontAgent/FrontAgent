import { get } from './client';
import type { Product, Pagination } from './types';

export type ListProductsParams = {
  q?: string;
  page?: number;
  pageSize?: number;
  categoryId?: string;
  sort?: string;
};

export type ProductsListResponse = {
  items: Product[];
  pagination: Pagination;
};

export const productsApi = {
  list(params?: ListProductsParams): Promise<ProductsListResponse> {
    return get<ProductsListResponse>('/products', { params });
  },
  detail(productId: string): Promise<Product> {
    return get<Product>(`/products/${encodeURIComponent(productId)}`);
  },
};

export default productsApi;
