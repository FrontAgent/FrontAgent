import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 用户信息接口
 */
export interface IUserInfo {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 用户状态接口
 */
export interface IUserState {
  // 状态
  isAuthenticated: boolean;
  userInfo: IUserInfo | null;
  isLoading: boolean;
  error: string | null;

  // 操作方法
  login: (userInfo: IUserInfo) => void;
  logout: () => void;
  updateUserInfo: (userInfo: Partial<IUserInfo>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

/**
 * 用户状态管理 Store
 * 使用 Zustand 进行状态管理，支持持久化存储
 */
export const useUserStore = create<IUserState>()(
  persist(
    (set, get) => ({
      // 初始状态
      isAuthenticated: false,
      userInfo: null,
      isLoading: false,
      error: null,

      /**
       * 用户登录
       * @param userInfo 用户信息
       */
      login: (userInfo: IUserInfo) => {
        set({
          isAuthenticated: true,
          userInfo,
          error: null,
        });
      },

      /**
       * 用户登出
       */
      logout: () => {
        set({
          isAuthenticated: false,
          userInfo: null,
          error: null,
        });
      },

      /**
       * 更新用户信息
       * @param userInfo 用户信息更新数据
       */
      updateUserInfo: (userInfo: Partial<IUserInfo>) => {
        const currentUserInfo = get().userInfo;
        if (!currentUserInfo) {
          return;
        }

        set({
          userInfo: {
            ...currentUserInfo,
            ...userInfo,
            updatedAt: new Date().toISOString(),
          },
        });
      },

      /**
       * 设置加载状态
       * @param loading 加载状态
       */
      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      /**
       * 设置错误信息
       * @param error 错误信息
       */
      setError: (error: string | null) => {
        set({ error });
      },

      /**
       * 清除错误信息
       */
      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'user-storage',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        userInfo: state.userInfo,
      }),
    }
  )
);