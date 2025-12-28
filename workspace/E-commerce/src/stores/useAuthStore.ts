import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type AuthUser = Record<string, unknown> | null;

export interface AuthState {
  user: AuthUser;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (payload: { user: AuthUser; accessToken: string | null }) => void;
  logout: () => void;
}

const computeIsAuthenticated = (accessToken: string | null) => Boolean(accessToken);

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      setAuth: ({ user, accessToken }) =>
        set({
          user: user ?? null,
          accessToken: accessToken ?? null,
          isAuthenticated: computeIsAuthenticated(accessToken ?? null),
        }),
      logout: () =>
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.isAuthenticated = computeIsAuthenticated(state.accessToken);
      },
    }
  )
);