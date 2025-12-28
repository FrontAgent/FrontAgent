import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 用户信息接口
 */
export interface IUser {
  /** 用户ID */
  id: string;
  /** 用户名 */
  username: string;
  /** 邮箱 */
  email: string;
  /** 头像URL */
  avatar?: string;
  /** 昵称 */
  nickname?: string;
  /** 手机号 */
  phone?: string;
  /** 创建时间 */
  createdAt?: string;
  /** 更新时间 */
  updatedAt?: string;
}

/**
 * 用户状态接口
 */
interface IUserState {
  /** 当前用户信息 */
  user: IUser | null;
  /** 是否已登录 */
  isAuthenticated: boolean;
  /** 加载状态 */
  isLoading: boolean;
}

/**
 * 用户操作接口
 */
interface IUserActions {
  /**
   * 登录
   * @param user 用户信息
   */
  login: (user: IUser) => void;
  
  /**
   * 登出
   */
  logout: () => void;
  
  /**
   * 更新用户信息
   * @param user 部分用户信息
   */
  updateUser: (user: Partial<IUser>) => void;
  
  /**
   * 检查认证状态
   */
  checkAuth: () => Promise<void>;
  
  /**
   * 设置加载状态
   * @param isLoading 加载状态
   */
  setLoading: (isLoading: boolean) => void;
}

/**
 * 用户 Store 类型
 */
type IUserStore = IUserState & IUserActions;

/**
 * 用户状态管理 Store
 * 使用 zustand 创建，支持持久化存储
 */
export const useUserStore = create<IUserStore>()(
  persist(
    (set, get) => ({
      // 初始状态
      user: null,
      isAuthenticated: false,
      isLoading: false,

      // 登录
      login: (user: IUser) => {
        set({
          user,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      // 登出
      logout: () => {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      // 更新用户信息
      updateUser: (userData: Partial<IUser>) => {
        const { user } = get();
        if (user) {
          set({
            user: {
              ...user,
              ...userData,
            },
          });
        }
      },

      // 检查认证状态
      checkAuth: async () => {
        set({ isLoading: true });
        try {
          // 这里可以调用 API 检查认证状态
          // 示例：const response = await authApi.checkAuth();
          // 如果认证有效，更新用户信息
          // set({ user: response.data, isAuthenticated: true });
          
          // 当前实现：检查本地存储的用户信息
          const { user } = get();
          if (user) {
            set({ isAuthenticated: true });
          } else {
            set({ isAuthenticated: false });
          }
        } catch (error) {
          set({
            user: null,
            isAuthenticated: false,
          });
        } finally {
          set({ isLoading: false });
        }
      },

      // 设置加载状态
      setLoading: (isLoading: boolean) => {
        set({ isLoading });
      },
    }),
    {
      name: 'user-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

/**
 * 获取当前用户信息
 */
export const selectUser = (state: IUserStore) => state.user;

/**
 * 获取认证状态
 */
export const selectIsAuthenticated = (state: IUserStore) => state.isAuthenticated;

/**
 * 获取加载状态
 */
export const selectIsLoading = (state: IUserStore) => state.isLoading;