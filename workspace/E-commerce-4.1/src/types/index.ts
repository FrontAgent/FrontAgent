export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
  category: Category;
  stock: number;
  rating?: number;
  reviews?: number;
  brand?: string;
  specifications?: Record<string, string>;
  tags?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type Category = 
  | '电子产品'
  | '服装'
  | '食品'
  | '家居'
  | '图书'
  | '运动'
  | '美妆'
  | '玩具'
  | '其他';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  phone?: string;
  address?: Address;
  createdAt: Date;
  updatedAt: Date;
}

export interface Address {
  street: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  shippingAddress: Address;
  paymentMethod: PaymentMethod;
  createdAt: Date;
  updatedAt: Date;
  deliveredAt?: Date;
}

export interface OrderItem {
  productId: string;
  productName: string;
  productImage: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export type OrderStatus = 
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type PaymentMethod = 
  | 'credit_card'
  | 'debit_card'
  | 'paypal'
  | 'alipay'
  | 'wechat_pay'
  | 'cash_on_delivery';

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  images?: string[];
  createdAt: Date;
  helpful?: number;
}

export interface FilterOptions {
  category?: Category;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  inStock?: boolean;
  brand?: string;
  sortBy?: SortOption;
}

export type SortOption = 
  | 'price_asc'
  | 'price_desc'
  | 'rating_desc'
  | 'newest'
  | 'popular';

export interface PaginationParams {
  page: number;
  pageSize: number;
  total?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface Cart {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
}

export interface Wishlist {
  userId: string;
  products: Product[];
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

export type NotificationType = 
  | 'order_update'
  | 'promotion'
  | 'system'
  | 'review';