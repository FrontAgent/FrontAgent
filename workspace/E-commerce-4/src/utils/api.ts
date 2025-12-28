const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
  status: number;
}

interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
}

function getAuthToken(): string | null {
  return localStorage.getItem('token');
}

function buildHeaders(customHeaders?: Record<string, string>): Headers {
  const headers = new Headers({
    'Content-Type': 'application/json',
    ...customHeaders,
  });

  const token = getAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return headers;
}

async function request<T>(url: string, options: RequestOptions): Promise<ApiResponse<T>> {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  
  const headers = buildHeaders(options.headers);
  
  const fetchOptions: RequestInit = {
    method: options.method,
    headers,
  };

  if (options.body && options.method !== 'GET') {
    fetchOptions.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(fullUrl, fetchOptions);
    
    let data: T;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text() as unknown as T;
    }

    if (!response.ok) {
      const errorMessage = typeof data === 'object' && data !== null && 'message' in data
        ? (data as { message: string }).message
        : `HTTP error! status: ${response.status}`;
      
      throw new Error(errorMessage);
    }

    return {
      data,
      success: true,
      status: response.status,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unexpected error occurred');
  }
}

export const api = {
  get<T>(url: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return request<T>(url, { method: 'GET', headers });
  },

  post<T>(url: string, data?: unknown, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return request<T>(url, { method: 'POST', body: data, headers });
  },

  put<T>(url: string, data?: unknown, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return request<T>(url, { method: 'PUT', body: data, headers });
  },

  delete<T>(url: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return request<T>(url, { method: 'DELETE', headers });
  },
};

export { API_BASE_URL };