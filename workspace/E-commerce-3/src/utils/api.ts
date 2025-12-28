import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
  category: string;
  stock: number;
}

interface OrderItem {
  productId: string;
  quantity: number;
}

interface Order {
  items: OrderItem[];
  totalAmount: number;
  shippingAddress: string;
  customerName: string;
  customerEmail: string;
}

interface OrderResponse {
  orderId: string;
  status: string;
  message: string;
}

interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('authToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error: AxiosError) => {
    const config = error.config as InternalAxiosRequestConfig & { _retryCount?: number };

    if (!config) {
      return Promise.reject(error);
    }

    config._retryCount = config._retryCount || 0;

    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    if (
      error.code === 'ECONNABORTED' ||
      error.code === 'ERR_NETWORK' ||
      (error.response && error.response.status >= 500)
    ) {
      if (config._retryCount < MAX_RETRIES) {
        config._retryCount += 1;
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * config._retryCount!));
        return apiClient(config);
      }
    }

    const apiError: ApiError = {
      message: error.response?.data?.message || error.message || 'An error occurred',
      code: error.code,
      status: error.response?.status,
    };

    return Promise.reject(apiError);
  }
);

export const fetchProducts = async (): Promise<Product[]> => {
  try {
    const response = await apiClient.get<Product[]>('/api/products');
    return response.data;
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
};

export const fetchProductById = async (id: string): Promise<Product> => {
  try {
    const response = await apiClient.get<Product>(`/api/products/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching product ${id}:`, error);
    throw error;
  }
};

export const submitOrder = async (order: Order): Promise<OrderResponse> => {
  try {
    const response = await apiClient.post<OrderResponse>('/api/orders', order);
    return response.data;
  } catch (error) {
    console.error('Error submitting order:', error);
    throw error;
  }
};

export default apiClient;