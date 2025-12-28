import { useState, useEffect, useCallback } from 'react';

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
  category: string;
  stock: number;
  rating: number;
}

export interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
}

const mockProducts: Product[] = [
  {
    id: '1',
    name: '无线蓝牙耳机',
    price: 299,
    description: '高品质无线蓝牙耳机，支持主动降噪，续航长达30小时',
    image: 'https://picsum.photos/seed/product1/400/400',
    category: '电子产品',
    stock: 50,
    rating: 4.5,
  },
  {
    id: '2',
    name: '智能手表',
    price: 899,
    description: '多功能智能手表，支持心率监测、运动追踪、消息提醒',
    image: 'https://picsum.photos/seed/product2/400/400',
    category: '电子产品',
    stock: 30,
    rating: 4.8,
  },
  {
    id: '3',
    name: '纯棉T恤',
    price: 99,
    description: '100%纯棉材质，舒适透气，多色可选',
    image: 'https://picsum.photos/seed/product3/400/400',
    category: '服装',
    stock: 200,
    rating: 4.2,
  },
  {
    id: '4',
    name: '运动跑鞋',
    price: 459,
    description: '轻量化设计，缓震舒适，适合日常跑步训练',
    image: 'https://picsum.photos/seed/product4/400/400',
    category: '运动',
    stock: 80,
    rating: 4.6,
  },
  {
    id: '5',
    name: '保温杯',
    price: 129,
    description: '304不锈钢内胆，12小时保温，500ml容量',
    image: 'https://picsum.photos/seed/product5/400/400',
    category: '家居',
    stock: 150,
    rating: 4.4,
  },
  {
    id: '6',
    name: '机械键盘',
    price: 399,
    description: '青轴机械键盘，RGB背光，87键紧凑布局',
    image: 'https://picsum.photos/seed/product6/400/400',
    category: '电子产品',
    stock: 45,
    rating: 4.7,
  },
  {
    id: '7',
    name: '双肩背包',
    price: 199,
    description: '大容量双肩包，防水面料，多隔层设计',
    image: 'https://picsum.photos/seed/product7/400/400',
    category: '箱包',
    stock: 100,
    rating: 4.3,
  },
  {
    id: '8',
    name: '瑜伽垫',
    price: 89,
    description: 'TPE环保材质，防滑耐磨，6mm厚度',
    image: 'https://picsum.photos/seed/product8/400/400',
    category: '运动',
    stock: 120,
    rating: 4.5,
  },
];

export function useProducts(filters?: ProductFilters) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProducts = useCallback(() => {
    setIsLoading(true);
    setError(null);

    setTimeout(() => {
      try {
        let filteredProducts = [...mockProducts];

        if (filters?.category) {
          filteredProducts = filteredProducts.filter(
            (p) => p.category === filters.category
          );
        }

        if (filters?.minPrice !== undefined) {
          filteredProducts = filteredProducts.filter(
            (p) => p.price >= filters.minPrice!
          );
        }

        if (filters?.maxPrice !== undefined) {
          filteredProducts = filteredProducts.filter(
            (p) => p.price <= filters.maxPrice!
          );
        }

        if (filters?.search) {
          const searchLower = filters.search.toLowerCase();
          filteredProducts = filteredProducts.filter(
            (p) =>
              p.name.toLowerCase().includes(searchLower) ||
              p.description.toLowerCase().includes(searchLower)
          );
        }

        setProducts(filteredProducts);
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('获取商品失败'));
        setIsLoading(false);
      }
    }, 500);
  }, [filters?.category, filters?.minPrice, filters?.maxPrice, filters?.search]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { products, isLoading, error, refetch: fetchProducts };
}

export function useProduct(id: string) {
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    setTimeout(() => {
      try {
        const foundProduct = mockProducts.find((p) => p.id === id);
        if (foundProduct) {
          setProduct(foundProduct);
        } else {
          setError(new Error('商品不存在'));
        }
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('获取商品详情失败'));
        setIsLoading(false);
      }
    }, 300);
  }, [id]);

  return { product, isLoading, error };
}