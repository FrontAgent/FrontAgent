export interface IApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: string[];
}

export interface IPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface IPaginatedResponse<T> extends IApiResponse<T[]> {
  pagination: IPagination;
}

export interface IUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  phone?: string;
  role: 'admin' | 'customer' | 'vendor';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IAuthState {
  user: IUser | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface ILoginCredentials {
  email: string;
  password: string;
}

export interface IRegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface IProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  currency: string;
  sku: string;
  stock: number;
  images: string[];
  category: ICategory;
  brand?: string;
  rating: number;
  reviewCount: number;
  isActive: boolean;
  tags: string[];
  attributes: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface ICategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentId?: string;
  isActive: boolean;
  children?: ICategory[];
}

export interface ICartItem {
  id: string;
  productId: string;
  product: IProduct;
  quantity: number;
  price: number;
  addedAt: string;
}

export interface ICart {
  id: string;
  items: ICartItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  updatedAt: string;
}

export interface IAddress {
  id: string;
  type: 'billing' | 'shipping';
  firstName: string;
  lastName: string;
  company?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  isDefault: boolean;
}

export interface IOrder {
  id: string;
  orderNumber: string;
  userId: string;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  items: IOrderItem[];
  billingAddress: IAddress;
  shippingAddress: IAddress;
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  paymentMethod: string;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  trackingNumber?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IOrderItem {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  quantity: number;
  price: number;
  total: number;
}

export interface IReview {
  id: string;
  userId: string;
  productId: string;
  rating: number;
  title: string;
  content: string;
  images?: string[];
  isVerified: boolean;
  helpfulCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface IWishlist {
  id: string;
  userId: string;
  productId: string;
  product: IProduct;
  addedAt: string;
}

export type TSortOption = 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc' | 'rating-desc' | 'newest' | 'oldest';

export interface IFilterOptions {
  categories: string[];
  priceRange: [number, number];
  brands: string[];
  rating: number;
  inStock: boolean;
}

export interface ISearchParams {
  query?: string;
  category?: string;
  page?: number;
  limit?: number;
  sort?: TSortOption;
  filters?: IFilterOptions;
}

export interface INotification {
  id: string;
  userId: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  isRead: boolean;
  actionUrl?: string;
  createdAt: string;
}

export type TTheme = 'light' | 'dark' | 'system';

export interface IAppSettings {
  theme: TTheme;
  language: string;
  currency: string;
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
}

export type TApiError = {
  code: string;
  message: string;
  details?: Record<string, any>;
};

export type TLoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface IFormErrors {
  [key: string]: string | undefined;
}