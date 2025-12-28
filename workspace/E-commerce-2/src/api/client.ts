/**
 * API Response Interface
 * @template T - The type of data returned in the response
 */
export interface IApiResponse<T> {
  data: T;
  message: string;
  status: number;
  success: boolean;
}

/**
 * API Base URL Configuration
 */
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000/api';

/**
 * Request Options Interface
 */
interface IRequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
}

/**
 * API Client Object
 * Provides methods for making HTTP requests using native fetch
 */
export const apiClient = {
  /**
   * Performs a GET request
   * @template T - The expected response data type
   * @param {string} endpoint - The API endpoint path
   * @param {IRequestOptions} options - Optional request configuration
   * @returns {Promise<IApiResponse<T>>} The API response
   */
  async get<T>(endpoint: string, options?: IRequestOptions): Promise<IApiResponse<T>> {
    try {
      const url = new URL(`${API_BASE_URL}${endpoint}`);
      
      if (options?.params) {
        Object.entries(options.params).forEach(([key, value]) => {
          url.searchParams.append(key, String(value));
        });
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw new Error(`GET request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Performs a POST request
   * @template T - The expected response data type
   * @param {string} endpoint - The API endpoint path
   * @param {unknown} body - The request body data
   * @param {IRequestOptions} options - Optional request configuration
   * @returns {Promise<IApiResponse<T>>} The API response
   */
  async post<T>(endpoint: string, body?: unknown, options?: IRequestOptions): Promise<IApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw new Error(`POST request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Performs a PUT request
   * @template T - The expected response data type
   * @param {string} endpoint - The API endpoint path
   * @param {unknown} body - The request body data
   * @param {IRequestOptions} options - Optional request configuration
   * @returns {Promise<IApiResponse<T>>} The API response
   */
  async put<T>(endpoint: string, body?: unknown, options?: IRequestOptions): Promise<IApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw new Error(`PUT request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Performs a DELETE request
   * @template T - The expected response data type
   * @param {string} endpoint - The API endpoint path
   * @param {IRequestOptions} options - Optional request configuration
   * @returns {Promise<IApiResponse<T>>} The API response
   */
  async delete<T>(endpoint: string, options?: IRequestOptions): Promise<IApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw new Error(`DELETE request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
};