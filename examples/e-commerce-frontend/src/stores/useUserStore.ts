import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 用户信息接口
 */
interface IUser {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 用户认证状态接口
 */
interface IAuthState {
  isAuthenticated: boolean;
  token: string | null;
  refreshToken: string | null;
}

/**
 * 用户Store状态接口
 */
interface IUserStore {
  // 状态
  user: IUser | null;
  authState: IAuthState;
  isLoading: boolean;
  error: string | null;

  // 登录相关
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;

  // 注册相关
  register: (userData: {
    email: string;
    password: string;
    username: string;
    firstName: string;
    lastName: string;
  }) => Promise<void>;

  // 用户信息相关
  fetchUserProfile: () => Promise<void>;
  updateProfile: (userData: Partial<IUser>) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;

  // 清除错误
  clearError: () => void;
}

/**
 * 用户状态管理Store
 */
export const useUserStore = create<IUserStore>()(
  persist(
    (set, get) => ({
      // 初始状态
      user: null,
      authState: {
        isAuthenticated: false,
        token: null,
        refreshToken: null,
      },
      isLoading: false,
      error: null,

      /**
       * 用户登录
       * @param email 邮箱
       * @param password 密码
       */
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          // TODO: 实现实际的API调用
          // const response = await userApi.login({ email, password });
          const mockResponse = {
            user: {
              id: '1',
              email,
              username: email.split('@')[0],
              firstName: 'John',
              lastName: 'Doe',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            token: 'mock-jwt-token',
            refreshToken: 'mock-refresh-token',
          };

          set({
            user: mockResponse.user,
            authState: {
              isAuthenticated: true,
              token: mockResponse.token,
              refreshToken: mockResponse.refreshToken,
            },
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Login failed',
            isLoading: false,
          });
        }
      },

      /**
       * 用户登出
       */
      logout: () => {
        set({
          user: null,
          authState: {
            isAuthenticated: false,
            token: null,
            refreshToken: null,
          },
          error: null,
        });
      },

      /**
       * 刷新Token
       */
      refreshToken: async () => {
        const { refreshToken: currentRefreshToken } = get().authState;
        if (!currentRefreshToken) {
          get().logout();
          return;
        }

        try {
          // TODO: 实现实际的API调用
          // const response = await userApi.refreshToken(currentRefreshToken);
          const mockResponse = {
            token: 'new-mock-jwt-token',
            refreshToken: 'new-mock-refresh-token',
          };

          set(state => ({
            authState: {
              ...state.authState,
              token: mockResponse.token,
              refreshToken: mockResponse.refreshToken,
            },
          }));
        } catch (error) {
          get().logout();
        }
      },

      /**
       * 用户注册
       * @param userData 用户注册数据
       */
      register: async (userData: {
        email: string;
        password: string;
        username: string;
        firstName: string;
        lastName: string;
      }) => {
        set({ isLoading: true, error: null });
        try {
          // TODO: 实现实际的API调用
          // await userApi.register(userData);
          
          // 注册成功后自动登录
          await get().login(userData.email, userData.password);
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Registration failed',
            isLoading: false,
          });
        }
      },

      /**
       * 获取用户信息
       */
      fetchUserProfile: async () => {
        const { token } = get().authState;
        if (!token) return;

        set({ isLoading: true, error: null });
        try {
          // TODO: 实现实际的API调用
          // const user = await userApi.getProfile(token);
          const mockUser: IUser = {
            id: '1',
            email: 'user@example.com',
            username: 'user',
            firstName: 'John',
            lastName: 'Doe',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          set({ user: mockUser, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch profile',
            isLoading: false,
          });
        }
      },

      /**
       * 更新用户信息
       * @param userData 要更新的用户数据
       */
      updateProfile: async (userData: Partial<IUser>) => {
        const { token } = get().authState;
        if (!token) return;

        set({ isLoading: true, error: null });
        try {
          // TODO: 实现实际的API调用
          // const updatedUser = await userApi.updateProfile(token, userData);
          const updatedUser = { ...get().user, ...userData, updatedAt: new Date().toISOString() };

          set({ user: updatedUser, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to update profile',
            isLoading: false,
          });
        }
      },

      /**
       * 修改密码
       * @param oldPassword 旧密码
       * @param newPassword 新密码
       */
      changePassword: async (oldPassword: string, newPassword: string) => {
        const { token } = get().authState;
        if (!token) return;

        set({ isLoading: true, error: null });
        try {
          // TODO: 实现实际的API调用
          // await userApi.changePassword(token, { oldPassword, newPassword });
          set({ isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to change password',
            isLoading: false,
          });
        }
      },

      /**
       * 清除错误信息
       */
      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'user-store',
      partialize: (state) => ({
        user: state.user,
        authState: state.authState,
      }),
    }
  )
);