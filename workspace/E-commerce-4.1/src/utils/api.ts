import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

// API基础URL
export const API_BASE_URL = 'https://fakestoreapi.com';

// 类型定义
export interface Product {
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

export interface Category {
  id: string;
  name: string;
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}

// 创建axios实例
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response.data;
  },
  (error: AxiosError) => {
    return Promise.reject(handleApiError(error));
  }
);

// 错误处理函数
export const handleApiError = (error: AxiosError): ApiError => {
  if (error.response) {
    return {
      message: error.response.data?.message || 'Server error occurred',
      status: error.response.status,
      code: error.code,
    };
  } else if (error.request) {
    return {
      message: 'No response from server',
      code: error.code,
    };
  } else {
    return {
      message: error.message || 'Request failed',
      code: error.code,
    };
  }
};

// API方法
export const fetchProducts = async (limit?: number): Promise<Product[]> => {
  const url = limit ? `/products?limit=${limit}` : '/products';
  return apiClient.get(url);
};

export const fetchProductById = async (id: number): Promise<Product> => {
  return apiClient.get(`/products/${id}`);
};

export const fetchCategories = async (): Promise<string[]> => {
  return apiClient.get('/products/categories');
};

export const fetchProductsByCategory = async (category: string): Promise<Product[]> => {
  return apiClient.get(`/products/category/${category}`);
};

export const createProduct = async (product: Omit<Product, 'id'>): Promise<Product> => {
  return apiClient.post('/products', product);
};

export const updateProduct = async (id: number, product: Partial<Product>): Promise<Product> => {
  return apiClient.put(`/products/${id}`, product);
};

export const deleteProduct = async (id: number): Promise<Product> => {
  return apiClient.delete(`/products/${id}`);
};

export default apiClient;