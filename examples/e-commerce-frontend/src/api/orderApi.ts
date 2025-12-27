import { TOrderStatus, IOrder, IOrderCreate, IOrderListResponse, IOrderUpdateStatus } from '../types/order';

/**
 * 订单API接口类
 * 提供订单相关的所有API调用功能
 */
class OrderApi {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
  }

  /**
   * 获取认证token
   */
  private getAuthToken(): string | null {
    return localStorage.getItem('authToken');
  }

  /**
   * 构建请求头
   */
  private buildHeaders(): HeadersInit {
    const token = this.getAuthToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * 处理API响应
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: '网络请求失败',
      }));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * 创建订单
   * @param orderData 订单创建数据
   * @returns 创建的订单信息
   */
  async createOrder(orderData: IOrderCreate): Promise<IOrder> {
    const response = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(orderData),
    });

    return this.handleResponse<IOrder>(response);
  }

  /**
   * 获取订单列表
   * @param params 查询参数
   * @returns 订单列表响应
   */
  async getOrderList(params?: {
    page?: number;
    limit?: number;
    status?: TOrderStatus;
    startDate?: string;
    endDate?: string;
  }): Promise<IOrderListResponse> {
    const searchParams = new URLSearchParams();

    if (params?.page) {
      searchParams.append('page', params.page.toString());
    }
    if (params?.limit) {
      searchParams.append('limit', params.limit.toString());
    }
    if (params?.status) {
      searchParams.append('status', params.status);
    }
    if (params?.startDate) {
      searchParams.append('startDate', params.startDate);
    }
    if (params?.endDate) {
      searchParams.append('endDate', params.endDate);
    }

    const url = `${this.baseUrl}/orders${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.buildHeaders(),
    });

    return this.handleResponse<IOrderListResponse>(response);
  }

  /**
   * 获取订单详情
   * @param orderId 订单ID
   * @returns 订单详情
   */
  async getOrderDetail(orderId: string): Promise<IOrder> {
    const response = await fetch(`${this.baseUrl}/orders/${orderId}`, {
      method: 'GET',
      headers: this.buildHeaders(),
    });

    return this.handleResponse<IOrder>(response);
  }

  /**
   * 更新订单状态
   * @param orderId 订单ID
   * @param statusData 状态更新数据
   * @returns 更新后的订单信息
   */
  async updateOrderStatus(
    orderId: string,
    statusData: IOrderUpdateStatus
  ): Promise<IOrder> {
    const response = await fetch(`${this.baseUrl}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: this.buildHeaders(),
      body: JSON.stringify(statusData),
    });

    return this.handleResponse<IOrder>(response);
  }

  /**
   * 取消订单
   * @param orderId 订单ID
   * @param reason 取消原因
   * @returns 更新后的订单信息
   */
  async cancelOrder(orderId: string, reason?: string): Promise<IOrder> {
    const response = await fetch(`${this.baseUrl}/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({ reason }),
    });

    return this.handleResponse<IOrder>(response);
  }

  /**
   * 确认收货
   * @param orderId 订单ID
   * @returns 更新后的订单信息
   */
  async confirmReceipt(orderId: string): Promise<IOrder> {
    const response = await fetch(`${this.baseUrl}/orders/${orderId}/confirm`, {
      method: 'POST',
      headers: this.buildHeaders(),
    });

    return this.handleResponse<IOrder>(response);
  }

  /**
   * 申请退款
   * @param orderId 订单ID
   * @param reason 退款原因
   * @returns 更新后的订单信息
   */
  async requestRefund(orderId: string, reason: string): Promise<IOrder> {
    const response = await fetch(`${this.baseUrl}/orders/${orderId}/refund`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({ reason }),
    });

    return this.handleResponse<IOrder>(response);
  }

  /**
   * 获取订单统计信息
   * @param params 统计参数
   * @returns 订单统计数据
   */
  async getOrderStatistics(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{
    totalOrders: number;
    totalAmount: number;
    statusCounts: Record<TOrderStatus, number>;
    monthlyData: Array<{
      month: string;
      orders: number;
      amount: number;
    }>;
  }> {
    const searchParams = new URLSearchParams();

    if (params?.startDate) {
      searchParams.append('startDate', params.startDate);
    }
    if (params?.endDate) {
      searchParams.append('endDate', params.endDate);
    }

    const url = `${this.baseUrl}/orders/statistics${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.buildHeaders(),
    });

    return this.handleResponse(response);
  }
}

// 导出单例实例
export const orderApi = new OrderApi();
export default orderApi;