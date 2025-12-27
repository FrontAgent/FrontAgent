import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface IUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

interface IPermission {
  id: string;
  name: string;
  resource: string;
  action: string;
}

interface IRole {
  id: string;
  name: string;
  permissions: IPermission[];
}

interface IUserState {
  user: IUser | null;
  token: string | null;
  refreshToken: string | null;
  roles: IRole[];
  permissions: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  updateProfile: (userData: Partial<IUser>) => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (roleName: string) => boolean;
  setUser: (user: IUser) => void;
  setToken: (token: string) => void;
  clearAuth: () => void;
}

export const useUserStore = create<IUserState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      roles: [],
      permissions: [],
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          });
          
          if (!response.ok) {
            throw new Error('Login failed');
          }
          
          const data = await response.json();
          const { user, token, refreshToken, roles, permissions } = data;
          
          const permissionNames = permissions.map((p: IPermission) => `${p.resource}:${p.action}`);
          
          set({
            user,
            token,
            refreshToken,
            roles,
            permissions: permissionNames,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          refreshToken: null,
          roles: [],
          permissions: [],
          isAuthenticated: false,
        });
      },

      refreshToken: async () => {
        const { refreshToken: currentRefreshToken } = get();
        if (!currentRefreshToken) {
          throw new Error('No refresh token available');
        }
        
        try {
          const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken: currentRefreshToken }),
          });
          
          if (!response.ok) {
            throw new Error('Token refresh failed');
          }
          
          const data = await response.json();
          const { token, refreshToken } = data;
          
          set({ token, refreshToken });
        } catch (error) {
          get().logout();
          throw error;
        }
      },

      updateProfile: async (userData: Partial<IUser>) => {
        const { token } = get();
        if (!token) {
          throw new Error('Not authenticated');
        }
        
        set({ isLoading: true });
        try {
          const response = await fetch('/api/user/profile', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(userData),
          });
          
          if (!response.ok) {
            throw new Error('Profile update failed');
          }
          
          const updatedUser = await response.json();
          set({ user: updatedUser, isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      hasPermission: (permission: string) => {
        const { permissions } = get();
        return permissions.includes(permission);
      },

      hasRole: (roleName: string) => {
        const { roles } = get();
        return roles.some(role => role.name === roleName);
      },

      setUser: (user: IUser) => {
        set({ user });
      },

      setToken: (token: string) => {
        set({ token });
      },

      clearAuth: () => {
        set({
          user: null,
          token: null,
          refreshToken: null,
          roles: [],
          permissions: [],
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'user-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        roles: state.roles,
        permissions: state.permissions,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);