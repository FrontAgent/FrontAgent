export interface IProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  currency: string;
  images: IProductImage[];
  category: ICategory;
  brand?: string;
  sku: string;
  stock: number;
  rating: number;
  reviewCount: number;
  attributes: IProductAttribute[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IProductImage {
  id: string;
  url: string;
  alt: string;
  isMain: boolean;
  order: number;
}

export interface IProductAttribute {
  name: string;
  value: string;
  type: 'text' | 'color' | 'size' | 'number';
}

export interface ICategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentId?: string;
  level: number;
  children?: ICategory[];
}

export interface IUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other';
  role: UserRole;
  addresses: IAddress[];
  preferences: IUserPreferences;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  emailVerified: boolean;
  phoneVerified: boolean;
}

export type UserRole = 'customer' | 'admin' | 'moderator';

export interface IUserPreferences {
  language: string;
  currency: string;
  newsletter: boolean;
  notifications: INotificationPreferences;
}

export interface INotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  orderUpdates: boolean;
  promotions: boolean;
  newsletter: boolean;
}

export interface IAddress {
  id: string;
  type: 'shipping' | 'billing' | 'both';
  isDefault: boolean;
  firstName: string;
  lastName: string;
  company?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface ICartItem {
  id: string;
  productId: string;
  product: IProduct;
  quantity: number;
  selectedAttributes: Record<string, string>;
  addedAt: Date;
}

export interface ICart {
  id: string;
  userId?: string;
  items: ICartItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  couponCode?: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOrder {
  id: string;
  orderNumber: string;
  userId: string;
  user: IUser;
  items: IOrderItem[];
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: IPaymentMethod;
  shippingAddress: IAddress;
  billingAddress: IAddress;
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  couponCode?: string;
  trackingNumber?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded';

export interface IOrderItem {
  id: string;
  productId: string;
  product: IProduct;
  quantity: number;
  price: number;
  selectedAttributes: Record<string, string>;
}

export interface IPaymentMethod {
  id: string;
  type: 'credit_card' | 'debit_card' | 'paypal' | 'stripe' | 'apple_pay' | 'google_pay';
  lastFour?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

export interface IReview {
  id: string;
  productId: string;
  userId: string;
  user: IUser;
  rating: number;
  title?: string;
  content: string;
  images?: string[];
  helpful: number;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWishlist {
  id: string;
  userId: string;
  name: string;
  description?: string;
  isPublic: boolean;
  items: IWishlistItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IWishlistItem {
  id: string;
  productId: string;
  product: IProduct;
  addedAt: Date;
}

export interface ICoupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed_amount' | 'free_shipping';
  value: number;
  minimumAmount?: number;
  maximumDiscount?: number;
  applicableProducts?: string[];
  applicableCategories?: string[];
  usageLimit?: number;
  usageCount: number;
  userUsageLimit?: number;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface INotification {
  id: string;
  userId: string;
  type: 'order' | 'promotion' | 'account' | 'system';
  title: string;
  message: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: Date;
}

export interface IFilterOptions {
  categories?: string[];
  brands?: string[];
  priceRange?: [number, number];
  rating?: number;
  inStock?: boolean;
  attributes?: Record<string, string[]>;
}

export interface ISearchParams {
  query?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'price' | 'rating' | 'createdAt' | 'popularity';
  sortOrder?: 'asc' | 'desc';
  filters?: IFilterOptions;
}

export interface IPaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface IApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}