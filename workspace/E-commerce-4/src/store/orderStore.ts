import { create } from 'zustand';
import { Order, OrderStatus } from '../types';

interface OrderState {
  orders: Order[];
  isLoading: boolean;
  error: string | null;

  // Order management
  fetchOrders: () => Promise<void>;
  getOrderById: (orderId: string) => Order | undefined;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  createOrder: (order: Omit<Order, 'id' | 'createdAt'>) => Promise<string>;

  // Error handling
  clearError: () => void;
  setError: (error: string) => void;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  isLoading: false,
  error: null,

  fetchOrders: async () => {
    set({ isLoading: true, error: null });

    try {
      // TODO: Replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Mock orders data
      const mockOrders: Order[] = [
        {
          id: 'ORD20240115001',
          userId: '1',
          items: [
            {
              productId: '1',
              name: '无线蓝牙耳机 Pro',
              image: 'https://picsum.photos/seed/prod1/400/400',
              price: 299,
              quantity: 1,
            },
          ],
          totalAmount: 299,
          status: 'delivered',
          address: {
            id: '1',
            userId: '1',
            name: '张三',
            phone: '13800138000',
            province: '广东省',
            city: '深圳市',
            district: '南山区',
            detail: '科技园路100号',
            isDefault: true,
          },
          createdAt: '2024-01-15T10:30:00Z',
          paidAt: '2024-01-15T10:35:00Z',
        },
        {
          id: 'ORD20240116001',
          userId: '1',
          items: [
            {
              productId: '2',
              name: '智能手表 Ultra',
              image: 'https://picsum.photos/seed/prod2/400/400',
              price: 1299,
              quantity: 1,
            },
          ],
          totalAmount: 1299,
          status: 'shipped',
          address: {
            id: '1',
            userId: '1',
            name: '张三',
            phone: '13800138000',
            province: '广东省',
            city: '深圳市',
            district: '南山区',
            detail: '科技园路100号',
            isDefault: true,
          },
          createdAt: '2024-01-16T14:20:00Z',
          paidAt: '2024-01-16T14:25:00Z',
        },
      ];

      set({ orders: mockOrders, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '获取订单失败',
        isLoading: false,
      });
    }
  },

  getOrderById: (orderId: string) => {
    const { orders } = get();
    return orders.find((order) => order.id === orderId);
  },

  updateOrderStatus: async (orderId: string, status: OrderStatus) => {
    set({ isLoading: true, error: null });

    try {
      // TODO: Replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 500));

      set((state) => ({
        orders: state.orders.map((order) =>
          order.id === orderId ? { ...order, status } : order
        ),
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '更新订单状态失败',
        isLoading: false,
      });
    }
  },

  createOrder: async (orderData: Omit<Order, 'id' | 'createdAt'>) => {
    set({ isLoading: true, error: null });

    try {
      // TODO: Replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 500));

      const newOrder: Order = {
        ...orderData,
        id: `ORD${Date.now()}`,
        createdAt: new Date().toISOString(),
      };

      set((state) => ({
        orders: [newOrder, ...state.orders],
        isLoading: false,
      }));

      return newOrder.id;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '创建订单失败',
        isLoading: false,
      });
      throw error;
    }
  },

  clearError: () => {
    set({ error: null });
  },

  setError: (error: string) => {
    set({ error });
  },
}));
