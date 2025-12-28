import React, { createContext, useState, useEffect, useCallback } from 'react';
import { storage } from '../utils/storage';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (email: string, password: string, name: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = user !== null;

  useEffect(() => {
    const restoreAuth = () => {
      try {
        const token = storage.get<string>(TOKEN_KEY);
        const savedUser = storage.get<User>(USER_KEY);

        if (token && savedUser) {
          setUser(savedUser);
        }
      } catch (error) {
        console.error('Failed to restore auth state:', error);
        storage.remove(TOKEN_KEY);
        storage.remove(USER_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    restoreAuth();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      const mockToken = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const mockUser: User = {
        id: `user_${Date.now()}`,
        email,
        name: email.split('@')[0],
      };

      storage.set(TOKEN_KEY, mockToken);
      storage.set(USER_KEY, mockUser);
      setUser(mockUser);
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback((): void => {
    storage.remove(TOKEN_KEY);
    storage.remove(USER_KEY);
    setUser(null);
  }, []);

  const register = useCallback(async (email: string, password: string, name: string): Promise<void> => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (!email || !password || !name) {
        throw new Error('Email, password, and name are required');
      }

      const mockToken = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const mockUser: User = {
        id: `user_${Date.now()}`,
        email,
        name,
      };

      storage.set(TOKEN_KEY, mockToken);
      storage.set(USER_KEY, mockUser);
      setUser(mockUser);
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    register,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};