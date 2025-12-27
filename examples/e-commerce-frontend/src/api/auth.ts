我将为您创建用户认证相关的API函数文件。首先让我查看现有的文件结构，然后创建完整的认证API。
/**
 * 用户认证API模块
 * 提供登录、注册、登出等认证相关功能
 */

export interface ILoginRequest {
  email: string;
  password: string;
}

export interface IRegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface IAuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
  };
  token: string;
  refreshToken: string;
  expiresIn: number;
}

export interface IApiError {
  message: string;
  code?: string;
  status?: number;
}

export interface ITokenData {
  token: string;
  refreshToken: string;
  expiresAt: number;
}

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api';
const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user_data';

/**
 * 存储认证信息到本地存储
 */
const storeAuthData = (authData: IAuthResponse): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, authData.token);
    localStorage.setItem(REFRESH_TOKEN_KEY, authData.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(authData.user));
  }
};

/**
 * 从本地存储获取认证信息
 */
const getStoredAuthData = (): ITokenData | null => {
  if (typeof window === 'undefined') return null;

  const token = localStorage.getItem(TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24小时

  if (token && refreshToken) {
    return { token, refreshToken, expiresAt };
  }

  return null;
};

/**
 * 清除本地存储的认证信息
 */
const clearAuthData = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
};

/**
 * 获取存储的用户信息
 */
export const getStoredUser = () => {
  if (typeof window === 'undefined') return null;
  
  const userData = localStorage.getItem(USER_KEY);
  return userData ? JSON.parse(userData) : null;
};

/**
 * 处理API响应
 */
const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      message: '网络请求失败',
      status: response.status
    }));
    
    throw {
      message: errorData.message || '请求失败',
      code: errorData.code,
      status: response.status
    } as IApiError;
  }

  return response.json();
};

/**
 * 创建带认证头的请求配置
 */
const createAuthHeaders = (token?: string): HeadersInit => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

/**
 * 用户登录
 */
export const login = async (credentials: ILoginRequest): Promise<IAuthResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: createAuthHeaders(),
      body: JSON.stringify(credentials),
    });

    const authData = await handleResponse<IAuthResponse>(response);
    storeAuthData(authData);
    
    return authData;
  } catch (error) {
    console.error('登录失败:', error);
    throw error;
  }
};

/**
 * 用户注册
 */
export const register = async (userData: IRegisterRequest): Promise<IAuthResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: createAuthHeaders(),
      body: JSON.stringify(userData),
    });

    const authData = await handleResponse<IAuthResponse>(response);
    storeAuthData(authData);
    
    return authData;
  } catch (error) {
    console.error('注册失败:', error);
    throw error;
  }
};

/**
 * 用户登出
 */
export const logout = async (): Promise<void> => {
  try {
    const authData = getStoredAuthData();
    
    if (authData?.token) {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: createAuthHeaders(authData.token),
      });
    }
  } catch (error) {
    console.error('登出请求失败:', error);
  } finally {
    clearAuthData();
  }
};

/**
 * 刷新访问令牌
 */
export const refreshAccessToken = async (): Promise<string> => {
  try {
    const authData = getStoredAuthData();
    
    if (!authData?.refreshToken) {
      throw new Error('没有可用的刷新令牌');
    }

    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: createAuthHeaders(),
      body: JSON.stringify({
        refreshToken: authData.refreshToken,
      }),
    });

    const data = await handleResponse<{ token: string; expiresIn: number }>(response);
    
    // 更新存储的令牌
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, data.token);
    }
    
    return data.token;
  } catch (error) {
    console.error('刷新令牌失败:', error);
    clearAuthData();
    throw error;
  }
};

/**
 * 获取当前用户信息
 */
export const getCurrentUser = async () => {
  try {
    const authData = getStoredAuthData();
    
    if (!authData?.token) {
      throw new Error('用户未登录');
    }

    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: createAuthHeaders(authData.token),
    });

    return handleResponse(response);
  } catch (error) {
    console.error('获取用户信息失败:', error);
    throw error;
  }
};

/**
 * 检查用户是否已认证
 */
export const isAuthenticated = (): boolean => {
  const authData = getStoredAuthData();
  return !!(authData?.token && authData.expiresAt > Date.now());
};

/**
 * 获取当前访问令牌
 */
export const getCurrentToken = (): string | null => {
  const authData = getStoredAuthData();
  return authData?.token || null;
};

/**
 * 更新用户资料
 */
export const updateProfile = async (profileData: {
  name?: string;
  avatar?: string;
}): Promise<{ user: any }> => {
  try {
    const authData = getStoredAuthData();
    
    if (!authData?.token) {
      throw new Error('用户未登录');
    }

    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: 'PUT',
      headers: createAuthHeaders(authData.token),
      body: JSON.stringify(profileData),
    });

    const data = await handleResponse<{ user: any }>(response);
    
    // 更新本地存储的用户信息
    if (typeof window !== 'undefined') {
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    }
    
    return data;
  } catch (error) {
    console.error('更新用户资料失败:', error);
    throw error;
  }
};

/**
 * 修改密码
 */
export const changePassword = async (passwords: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> => {
  try {
    const authData = getStoredAuthData();
    
    if (!authData?.token) {
      throw new Error('用户未登录');
    }

    const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: createAuthHeaders(authData.token),
      body: JSON.stringify(passwords),
    });

    await handleResponse(response);
  } catch (error) {
    console.error('修改密码失败:', error);
    throw error;
  }
};

/**
 * 发送密码重置邮件
 */
export const requestPasswordReset = async (email: string): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: createAuthHeaders(),
      body: JSON.stringify({ email }),
    });

    await handleResponse(response);
  } catch (error) {
    console.error('发送密码重置邮件失败:', error);
    throw error;
  }
};

/**
 * 重置密码
 */
export const resetPassword = async (data: {
  token: string;
  password: string;
}): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: createAuthHeaders(),
      body: JSON.stringify(data),
    });

    await handleResponse(response);
  } catch (error) {
    console.error('重置密码失败:', error);
    throw error;
  }
};