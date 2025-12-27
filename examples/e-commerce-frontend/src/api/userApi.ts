import { TUser, TLoginRequest, TRegisterRequest, TUpdateUserRequest } from '../types/userTypes';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api';

/**
 * 通用API响应类型
 */
interface IApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

/**
 * 通用请求头配置
 */
const getHeaders = (): HeadersInit => {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

/**
 * 处理API响应
 */
const handleResponse = async <T>(response: Response): Promise<IApiResponse<T>> => {
  try {
    const data = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        error: data.message || data.error || '请求失败',
      };
    }
    
    return {
      success: true,
      data: data.data || data,
      message: data.message,
    };
  } catch (error) {
    return {
      success: false,
      error: '网络请求失败',
    };
  }
};

/**
 * 用户登录
 */
export const login = async (credentials: TLoginRequest): Promise<IApiResponse<{
  user: TUser;
  token: string;
}>> => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(credentials),
    });
    
    return handleResponse(response);
  } catch (error) {
    return {
      success: false,
      error: '登录请求失败',
    };
  }
};

/**
 * 用户注册
 */
export const register = async (userData: TRegisterRequest): Promise<IApiResponse<{
  user: TUser;
  token: string;
}>> => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(userData),
    });
    
    return handleResponse(response);
  } catch (error) {
    return {
      success: false,
      error: '注册请求失败',
    };
  }
};

/**
 * 获取当前用户信息
 */
export const getCurrentUser = async (): Promise<IApiResponse<TUser>> => {
  try {
    const response = await fetch(`${API_BASE_URL}/user/profile`, {
      method: 'GET',
      headers: getHeaders(),
    });
    
    return handleResponse(response);
  } catch (error) {
    return {
      success: false,
      error: '获取用户信息失败',
    };
  }
};

/**
 * 更新用户信息
 */
export const updateUserProfile = async (
  userData: TUpdateUserRequest
): Promise<IApiResponse<TUser>> => {
  try {
    const response = await fetch(`${API_BASE_URL}/user/profile`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(userData),
    });
    
    return handleResponse(response);
  } catch (error) {
    return {
      success: false,
      error: '更新用户信息失败',
    };
  }
};

/**
 * 用户登出
 */
export const logout = async (): Promise<IApiResponse<void>> => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: getHeaders(),
    });
    
    // 清除本地存储的token
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    
    return handleResponse(response);
  } catch (error) {
    // 即使请求失败，也清除本地token
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    
    return {
      success: true,
      message: '登出成功',
    };
  }
};

/**
 * 刷新token
 */
export const refreshToken = async (): Promise<IApiResponse<{
  token: string;
}>> => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: getHeaders(),
    });
    
    const result = await handleResponse(response);
    
    if (result.success && result.data) {
      localStorage.setItem('authToken', result.data.token);
    }
    
    return result;
  } catch (error) {
    return {
      success: false,
      error: '刷新token失败',
    };
  }
};

/**
 * 修改密码
 */
export const changePassword = async (passwordData: {
  currentPassword: string;
  newPassword: string;
}): Promise<IApiResponse<void>> => {
  try {
    const response = await fetch(`${API_BASE_URL}/user/change-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(passwordData),
    });
    
    return handleResponse(response);
  } catch (error) {
    return {
      success: false,
      error: '修改密码失败',
    };
  }
};

/**
 * 验证token是否有效
 */
export const validateToken = async (): Promise<IApiResponse<{
  valid: boolean;
  user?: TUser;
}>> => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/validate`, {
      method: 'GET',
      headers: getHeaders(),
    });
    
    return handleResponse(response);
  } catch (error) {
    return {
      success: false,
      error: 'token验证失败',
    };
  }
};

/**
 * 发送重置密码邮件
 */
export const requestPasswordReset = async (email: string): Promise<IApiResponse<void>> => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email }),
    });
    
    return handleResponse(response);
  } catch (error) {
    return {
      success: false,
      error: '发送重置密码邮件失败',
    };
  }
};

/**
 * 重置密码
 */
export const resetPassword = async (resetData: {
  token: string;
  newPassword: string;
}): Promise<IApiResponse<void>> => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(resetData),
    });
    
    return handleResponse(response);
  } catch (error) {
    return {
      success: false,
      error: '重置密码失败',
    };
  }
};