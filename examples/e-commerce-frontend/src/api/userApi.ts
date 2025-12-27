import { TUser, TLoginRequest, TRegisterRequest, TApiResponse } from '../types/userTypes';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

class UserApiService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<TApiResponse<T>> {
    const token = localStorage.getItem('authToken');
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'API request failed');
      }

      return {
        success: true,
        data: data.data || data,
        message: data.message,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        message: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * 用户登录
   */
  async login(credentials: TLoginRequest): Promise<TApiResponse<{ user: TUser; token: string }>> {
    return this.request<{ user: TUser; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  /**
   * 用户注册
   */
  async register(userData: TRegisterRequest): Promise<TApiResponse<{ user: TUser; token: string }>> {
    return this.request<{ user: TUser; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(): Promise<TApiResponse<TUser>> {
    return this.request<TUser>('/auth/me', {
      method: 'GET',
    });
  }

  /**
   * 更新用户信息
   */
  async updateUser(userData: Partial<TUser>): Promise<TApiResponse<TUser>> {
    return this.request<TUser>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  /**
   * 修改密码
   */
  async changePassword(passwords: {
    currentPassword: string;
    newPassword: string;
  }): Promise<TApiResponse<null>> {
    return this.request<null>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(passwords),
    });
  }

  /**
   * 用户登出
   */
  async logout(): Promise<TApiResponse<null>> {
    const token = localStorage.getItem('authToken');
    
    if (token) {
      try {
        await this.request<null>('/auth/logout', {
          method: 'POST',
        });
      } catch (error) {
        console.error('Logout request failed:', error);
      }
    }

    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');

    return {
      success: true,
      data: null,
      message: 'Logged out successfully',
    };
  }

  /**
   * 刷新访问令牌
   */
  async refreshToken(): Promise<TApiResponse<{ token: string }>> {
    return this.request<{ token: string }>('/auth/refresh', {
      method: 'POST',
    });
  }

  /**
   * 验证邮箱
   */
  async verifyEmail(token: string): Promise<TApiResponse<null>> {
    return this.request<null>(`/auth/verify-email?token=${token}`, {
      method: 'POST',
    });
  }

  /**
   * 发送重置密码邮件
   */
  async forgotPassword(email: string): Promise<TApiResponse<null>> {
    return this.request<null>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  /**
   * 重置密码
   */
  async resetPassword(data: {
    token: string;
    password: string;
  }): Promise<TApiResponse<null>> {
    return this.request<null>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const userApi = new UserApiService();
export default userApi;