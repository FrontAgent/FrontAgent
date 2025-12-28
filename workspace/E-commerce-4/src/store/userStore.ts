import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  phone?: string;
  nickname?: string;
  createdAt: string;
}

interface UserState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Auth methods
  login: (email: string, password: string) => Promise<boolean>;
  register: (username: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;

  // User profile methods
  updateProfile: (updates: Partial<User>) => Promise<boolean>;

  // Error handling
  clearError: () => void;
  setError: (error: string) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          // TODO: Replace with actual API call
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Mock successful login
          const mockUser: User = {
            id: '1',
            username: email.split('@')[0],
            email,
            createdAt: new Date().toISOString(),
          };

          set({ user: mockUser, isAuthenticated: true, isLoading: false });
          return true;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '登录失败',
            isLoading: false
          });
          return false;
        }
      },

      register: async (username: string, email: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          // TODO: Replace with actual API call
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Mock successful registration
          const mockUser: User = {
            id: Math.random().toString(36).substr(2, 9),
            username,
            email,
            createdAt: new Date().toISOString(),
          };

          set({ user: mockUser, isAuthenticated: true, isLoading: false });
          return true;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '注册失败',
            isLoading: false
          });
          return false;
        }
      },

      logout: () => {
        set({ user: null, isAuthenticated: false, error: null });
      },

      updateProfile: async (updates: Partial<User>) => {
        set({ isLoading: true, error: null });

        try {
          // TODO: Replace with actual API call
          await new Promise((resolve) => setTimeout(resolve, 500));

          set((state) => ({
            user: state.user ? { ...state.user, ...updates } : null,
            isLoading: false,
          }));
          return true;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '更新失败',
            isLoading: false
          });
          return false;
        }
      },

      clearError: () => {
        set({ error: null });
      },

      setError: (error: string) => {
        set({ error });
      },
    }),
    {
      name: 'user-storage',
    }
  )
);
