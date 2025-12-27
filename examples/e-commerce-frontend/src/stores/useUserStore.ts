import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface IUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  phone?: string;
  role: 'user' | 'admin';
  createdAt: string;
  updatedAt: string;
}

interface IAuthState {
  user: IUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface IAuthActions {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  updateUser: (userData: Partial<IUser>) => void;
  setLoading: (loading: boolean) => void;
  clearError: () => void;
}

interface IAuthStore extends IAuthState, IAuthActions {
  error: string | null;
}

const mockUsers: IUser[] = [
  {
    id: '1',
    email: 'user@example.com',
    name: 'John Doe',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John',
    role: 'user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const useUserStore = create<IAuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const user = mockUsers.find(u => u.email === email);
          
          if (!user || password !== 'password') {
            set({ error: 'Invalid email or password', isLoading: false });
            return;
          }
          
          const token = `mock-token-${Date.now()}`;
          
          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({ error: 'Login failed', isLoading: false });
        }
      },

      register: async (email: string, password: string, name: string) => {
        set({ isLoading: true, error: null });
        
        try {
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const existingUser = mockUsers.find(u => u.email === email);
          
          if (existingUser) {
            set({ error: 'Email already exists', isLoading: false });
            return;
          }
          
          const newUser: IUser = {
            id: Date.now().toString(),
            email,
            name,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
            role: 'user',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          
          mockUsers.push(newUser);
          
          const token = `mock-token-${Date.now()}`;
          
          set({
            user: newUser,
            token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({ error: 'Registration failed', isLoading: false });
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        });
      },

      updateUser: (userData: Partial<IUser>) => {
        const currentUser = get().user;
        
        if (!currentUser) return;
        
        const updatedUser: IUser = {
          ...currentUser,
          ...userData,
          updatedAt: new Date().toISOString(),
        };
        
        set({ user: updatedUser });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'user-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);