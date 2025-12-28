import { get } from './client';
import type { Order, Paginated, Pagination } from './types';

export type ListOrdersParams = {
  page?: number;
  pageSize?: number;
  status?: string;
};

export type OrdersListResponse = {
  items: Order[];
  pagination: Pagination;
};

export const ordersApi = {
  list(params?: ListOrdersParams): Promise<OrdersListResponse> {
    return get<OrdersListResponse>('/orders', { params });
  },
  detail(orderId: string): Promise<Order> {
    return get<Order>(`/orders/${encodeURIComponent(orderId)}`);
  },
};

export default ordersApi;
