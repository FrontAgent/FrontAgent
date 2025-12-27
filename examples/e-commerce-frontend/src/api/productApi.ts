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
  totalPages: number;
}

export interface IProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  search?: string;
  sortBy?: 'price' | 'rating' | 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface IProductListParams {
  page?: number;
  limit?: number;
  filters?: IProductFilters;
}

const API_BASE_URL = '/api/products';

/**
 * 获取产品列表
 * @param params 查询参数
 * @returns 产品列表响应
 */
export const getProducts = async (params?: IProductListParams): Promise<IProductListResponse> => {
  const searchParams = new URLSearchParams();
  
  if (params?.page) {
    searchParams.append('page', params.page.toString());
  }
  
  if (params?.limit) {
    searchParams.append('limit', params.limit.toString());
  }
  
  if (params?.filters) {
    const { filters } = params;
    
    if (filters.category) {
      searchParams.append('category', filters.category);
    }
    
    if (filters.minPrice !== undefined) {
      searchParams.append('minPrice', filters.minPrice.toString());
    }
    
    if (filters.maxPrice !== undefined) {
      searchParams.append('maxPrice', filters.maxPrice.toString());
    }
    
    if (filters.rating !== undefined) {
      searchParams.append('rating', filters.rating.toString());
    }
    
    if (filters.search) {
      searchParams.append('search', filters.search);
    }
    
    if (filters.sortBy) {
      searchParams.append('sortBy', filters.sortBy);
    }
    
    if (filters.sortOrder) {
      searchParams.append('sortOrder', filters.sortOrder);
    }
  }
  
  const url = `${API_BASE_URL}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch products: ${response.statusText}`);
  }
  
  return response.json();
};

/**
 * 获取产品详情
 * @param id 产品ID
 * @returns 产品详情
 */
export const getProductById = async (id: string): Promise<IProduct> => {
  const response = await fetch(`${API_BASE_URL}/${id}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch product: ${response.statusText}`);
  }
  
  return response.json();
};

/**
 * 获取产品分类列表
 * @returns 分类列表
 */
export const getProductCategories = async (): Promise<string[]> => {
  const response = await fetch(`${API_BASE_URL}/categories`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch categories: ${response.statusText}`);
  }
  
  return response.json();
};

/**
 * 获取推荐产品
 * @param limit 返回数量限制
 * @returns 推荐产品列表
 */
export const getRecommendedProducts = async (limit: number = 10): Promise<IProduct[]> => {
  const response = await fetch(`${API_BASE_URL}/recommended?limit=${limit}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch recommended products: ${response.statusText}`);
  }
  
  return response.json();
};

/**
 * 搜索产品
 * @param query 搜索关键词
 * @param limit 返回数量限制
 * @returns 搜索结果
 */
export const searchProducts = async (query: string, limit: number = 20): Promise<IProduct[]> => {
  const searchParams = new URLSearchParams({
    q: query,
    limit: limit.toString()
  });
  
  const response = await fetch(`${API_BASE_URL}/search?${searchParams.toString()}`);
  
  if (!response.ok) {
    throw new Error(`Failed to search products: ${response.statusText}`);
  }
  
  return response.json();
};