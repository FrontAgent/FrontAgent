import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * 商品接口定义
 */
export interface IProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  images: string[];
  categoryId: string;
  categoryName: string;
  brand?: string;
  rating: number;
  reviewCount: number;
  stock: number;
  tags: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 商品分类接口定义
 */
export interface ICategory {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  image?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 搜索过滤器接口定义
 */
export interface ISearchFilters {
  categoryId?: string;
  priceRange?: {
    min: number;
    max: number;
  };
  brand?: string;
  rating?: number;
  tags?: string[];
  inStock?: boolean;
}

/**
 * 分页信息接口定义
 */
export interface IPagination {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * 商品状态管理Store接口
 */
interface IProductStore {
  // 状态
  products: IProduct[];
  categories: ICategory[];
  searchResults: IProduct[];
  searchQuery: string;
  filters: ISearchFilters;
  pagination: IPagination;
  loading: {
    products: boolean;
    categories: boolean;
    search: boolean;
  };
  error: {
    products: string | null;
    categories: string | null;
    search: string | null;
  };

  // Actions
  fetchProducts: (page?: number, pageSize?: number) => Promise<void>;
  fetchCategories: () => Promise<void>;
  searchProducts: (query: string, filters?: ISearchFilters) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setFilters: (filters: ISearchFilters) => void;
  clearSearch: () => void;
  setLoading: (type: keyof IProductStore['loading'], loading: boolean) => void;
  setError: (type: keyof IProductStore['error'], error: string | null) => void;
  getProductById: (id: string) => IProduct | undefined;
  getCategoryById: (id: string) => ICategory | undefined;
  getProductsByCategory: (categoryId: string) => IProduct[];
}

/**
 * 默认分页信息
 */
const defaultPagination: IPagination = {
  currentPage: 1,
  pageSize: 20,
  totalItems: 0,
  totalPages: 0,
  hasNext: false,
  hasPrevious: false,
};

/**
 * 默认搜索过滤器
 */
const defaultFilters: ISearchFilters = {};

/**
 * 商品状态管理Store实现
 */
export const useProductStore = create<IProductStore>()(
  devtools(
    (set, get) => ({
      // 初始状态
      products: [],
      categories: [],
      searchResults: [],
      searchQuery: '',
      filters: defaultFilters,
      pagination: defaultPagination,
      loading: {
        products: false,
        categories: false,
        search: false,
      },
      error: {
        products: null,
        categories: null,
        search: null,
      },

      /**
       * 获取商品列表
       */
      fetchProducts: async (page = 1, pageSize = 20) => {
        const { setLoading, setError } = get();
        
        try {
          setLoading('products', true);
          setError('products', null);

          // 模拟API调用
          // 实际项目中这里应该是真实的API请求
          const response = await new Promise<{
            products: IProduct[];
            pagination: IPagination;
          }>((resolve) => {
            setTimeout(() => {
              resolve({
                products: [],
                pagination: {
                  ...defaultPagination,
                  currentPage: page,
                  pageSize,
                },
              });
            }, 1000);
          });

          set((state) => ({
            products: response.products,
            pagination: response.pagination,
          }));
        } catch (error) {
          setError('products', error instanceof Error ? error.message : '获取商品列表失败');
        } finally {
          setLoading('products', false);
        }
      },

      /**
       * 获取商品分类列表
       */
      fetchCategories: async () => {
        const { setLoading, setError } = get();
        
        try {
          setLoading('categories', true);
          setError('categories', null);

          // 模拟API调用
          const response = await new Promise<ICategory[]>((resolve) => {
            setTimeout(() => {
              resolve([]);
            }, 800);
          });

          set({ categories: response });
        } catch (error) {
          setError('categories', error instanceof Error ? error.message : '获取分类列表失败');
        } finally {
          setLoading('categories', false);
        }
      },

      /**
       * 搜索商品
       */
      searchProducts: async (query: string, filters = {}) => {
        const { setLoading, setError } = get();
        
        try {
          setLoading('search', true);
          setError('search', null);

          // 模拟API调用
          const response = await new Promise<IProduct[]>((resolve) => {
            setTimeout(() => {
              resolve([]);
            }, 600);
          });

          set((state) => ({
            searchResults: response,
            searchQuery: query,
            filters,
          }));
        } catch (error) {
          setError('search', error instanceof Error ? error.message : '搜索商品失败');
        } finally {
          setLoading('search', false);
        }
      },

      /**
       * 设置搜索关键词
       */
      setSearchQuery: (query: string) => {
        set({ searchQuery: query });
      },

      /**
       * 设置搜索过滤器
       */
      setFilters: (filters: ISearchFilters) => {
        set({ filters });
      },

      /**
       * 清空搜索
       */
      clearSearch: () => {
        set({
          searchResults: [],
          searchQuery: '',
          filters: defaultFilters,
        });
      },

      /**
       * 设置加载状态
       */
      setLoading: (type, loading) => {
        set((state) => ({
          loading: {
            ...state.loading,
            [type]: loading,
          },
        }));
      },

      /**
       * 设置错误信息
       */
      setError: (type, error) => {
        set((state) => ({
          error: {
            ...state.error,
            [type]: error,
          },
        }));
      },

      /**
       * 根据ID获取商品
       */
      getProductById: (id: string) => {
        const { products, searchResults } = get();
        return products.find(product => product.id === id) || 
               searchResults.find(product => product.id === id);
      },

      /**
       * 根据ID获取分类
       */
      getCategoryById: (id: string) => {
        const { categories } = get();
        return categories.find(category => category.id === id);
      },

      /**
       * 根据分类ID获取商品列表
       */
      getProductsByCategory: (categoryId: string) => {
        const { products } = get();
        return products.filter(product => product.categoryId === categoryId);
      },
    }),
    {
      name: 'product-store',
    }
  )
);