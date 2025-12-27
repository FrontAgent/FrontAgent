import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface IUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  phone?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ILoginCredentials {
  email: string;
  password: string;
}

export interface IRegisterData extends ILoginCredentials {
  name: string;
  phone?: string;
}

export interface IUserStore {
  // State
  user: IUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (credentials: ILoginCredentials) => Promise<void>;
  register: (data: IRegisterData) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<IUser>) => Promise<void>;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}

/**
 * 用户状态管理Store
 * 使用Zustand进行状态管理，支持持久化存储
 */
export const useUserStore = create<IUserStore>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Actions
      login: async (credentials: ILoginCredentials) => {
        try {
          set({ isLoading: true, error: null });

          // 模拟API调用
          await new Promise(resolve => setTimeout(resolve, 1000));

          // 模拟登录成功
          const mockUser: IUser = {
            id: '1',
            email: credentials.email,
            name: 'Demo User',
            avatar: undefined,
            phone: undefined,
            address: undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          set({
            user: mockUser,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : '登录失败',
          });
          throw error;
        }
      },

      register: async (data: IRegisterData) => {
        try {
          set({ isLoading: true, error: null });

          // 模拟API调用
          await new Promise(resolve => setTimeout(resolve, 1000));

          // 模拟注册成功
          const newUser: IUser = {
            id: Date.now().toString(),
            email: data.email,
            name: data.name,
            phone: data.phone,
            avatar: undefined,
            address: undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          set({
            user: newUser,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : '注册失败',
          });
          throw error;
        }
      },

      logout: () => {
        set({
          user: null,
          isAuthenticated: false,
          error: null,
        });
      },

      updateProfile: async (data: Partial<IUser>) => {
        try {
          set({ isLoading: true, error: null });

          const currentUser = get().user;
          if (!currentUser) {
            throw new Error('用户未登录');
          }

          // 模拟API调用
          await new Promise(resolve => setTimeout(resolve, 500));

          const updatedUser: IUser = {
            ...currentUser,
            ...data,
            updatedAt: new Date().toISOString(),
          };

          set({
            user: updatedUser,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : '更新失败',
          });
          throw error;
        }
      },

      clearError: () => {
        set({ error: null });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },
    }),
    {
      name: 'user-store',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);