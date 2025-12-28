// API基础配置
export const API_BASE_URL = 'https://api.example.com';

// 通用请求函数
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data as T;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

// 商品相关类型
export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
  image: string;
  stock: number;
}

// 用户相关类型
export interface User {
  id: string;
  username: string;
  email: string;
  token: string;
}

// 订单相关类型
export interface Order {
  userId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  totalAmount: number;
  shippingAddress: string;
}

export interface OrderResponse {
  orderId: string;
  status: string;
  message: string;
}

// 获取商品列表
export async function fetchProducts(params?: {
  category?: string;
  search?: string;
}): Promise<Product[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const mockProducts: Product[] = [
        {
          id: '1',
          name: '无线蓝牙耳机',
          price: 299,
          description: '高品质音质，长续航',
          category: '电子产品',
          image: '/images/product1.jpg',
          stock: 50,
        },
        {
          id: '2',
          name: '智能手表',
          price: 1299,
          description: '健康监测，运动追踪',
          category: '电子产品',
          image: '/images/product2.jpg',
          stock: 30,
        },
        {
          id: '3',
          name: '运动鞋',
          price: 599,
          description: '舒适透气，专业运动',
          category: '服装鞋帽',
          image: '/images/product3.jpg',
          stock: 100,
        },
      ];

      let filtered = mockProducts;

      if (params?.category) {
        filtered = filtered.filter(p => p.category === params.category);
      }

      if (params?.search) {
        const searchLower = params.search.toLowerCase();
        filtered = filtered.filter(p => 
          p.name.toLowerCase().includes(searchLower) ||
          p.description.toLowerCase().includes(searchLower)
        );
      }

      resolve(filtered);
    }, 500);
  });
}

// 根据ID获取商品详情
export async function fetchProductById(id: string): Promise<Product> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const mockProduct: Product = {
        id,
        name: '无线蓝牙耳机',
        price: 299,
        description: '高品质音质，长续航，支持主动降噪',
        category: '电子产品',
        image: '/images/product1.jpg',
        stock: 50,
      };

      if (id) {
        resolve(mockProduct);
      } else {
        reject(new Error('Product not found'));
      }
    }, 300);
  });
}

// 提交订单
export async function submitOrder(order: Order): Promise<OrderResponse> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const mockResponse: OrderResponse = {
        orderId: `ORD${Date.now()}`,
        status: 'success',
        message: '订单提交成功',
      };

      resolve(mockResponse);
    }, 800);
  });
}

// 用户登录
export async function loginUser(credentials: {
  username: string;
  password: string;
}): Promise<User> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (credentials.username && credentials.password) {
        const mockUser: User = {
          id: 'user123',
          username: credentials.username,
          email: `${credentials.username}@example.com`,
          token: `token_${Date.now()}`,
        };
        resolve(mockUser);
      } else {
        reject(new Error('Invalid credentials'));
      }
    }, 600);
  });
}