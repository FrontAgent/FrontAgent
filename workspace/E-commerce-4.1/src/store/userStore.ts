import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserStore {
  user: User | null;
  isLoggedIn: boolean;
  login: (user: User) => void;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      user: null,
      isLoggedIn: false,
      login: (user: User) => {
        set({
          user,
          isLoggedIn: true,
        });
      },
      logout: () => {
        set({
          user: null,
          isLoggedIn: false,
        });
      },
      updateUser: (userData: Partial<User>) => {
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                ...userData,
                updatedAt: new Date().toISOString(),
              }
            : null,
        }));
      },
    }),
    {
      name: 'user-storage',
      partialize: (state) => ({
        user: state.user,
        isLoggedIn: state.isLoggedIn,
      }),
    }
  )
);