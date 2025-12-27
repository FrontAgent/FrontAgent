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
  status: ProductStatus;
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
  type: 'text' | 'number' | 'boolean' | 'select';
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

export enum ProductStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  OUT_OF_STOCK = 'out_of_stock',
  DRAFT = 'draft',
  ARCHIVED = 'archived'
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
  items: ICartItem[];
  totalAmount: number;
  currency: string;
  discountAmount: number;
  taxAmount: number;
  shippingAmount: number;
  finalAmount: number;
  couponCode?: string;
  createdAt: Date;
  updatedAt: Date;
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
  status: UserStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  preferences: IUserPreferences;
  addresses: IAddress[];
  paymentMethods: IPaymentMethod[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserPreferences {
  language: string;
  currency: string;
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  theme: 'light' | 'dark' | 'auto';
}

export interface IAddress {
  id: string;
  type: 'shipping' | 'billing';
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

export interface IPaymentMethod {
  id: string;
  type: 'credit_card' | 'debit_card' | 'paypal' | 'bank_transfer';
  isDefault: boolean;
  lastFour?: string;
  expiryMonth?: number;
  expiryYear?: number;
  brand?: string;
  paypalEmail?: string;
}

export enum UserRole {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
  MODERATOR = 'moderator'
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  BANNED = 'banned'
}

export interface IOrder {
  id: string;
  orderNumber: string;
  userId: string;
  user: IUser;
  items: IOrderItem[];
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  shippingAddress: IAddress;
  billingAddress: IAddress;
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  trackingNumber?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
}

export interface IOrderItem {
  id: string;
  productId: string;
  product: IProduct;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  selectedAttributes: Record<string, string>;
}

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
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
  helpfulCount: number;
  verifiedPurchase: boolean;
  status: ReviewStatus;
  createdAt: Date;
  updatedAt: Date;
}

export enum ReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
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
  name: string;
  description?: string;
  type: CouponType;
  value: number;
  minimumAmount?: number;
  maximumDiscount?: number;
  usageLimit?: number;
  usageCount: number;
  applicableProducts?: string[];
  applicableCategories?: string[];
  startDate: Date;
  endDate: Date;
  isActive: boolean;
}

export enum CouponType {
  PERCENTAGE = 'percentage',
  FIXED_AMOUNT = 'fixed_amount',
  FREE_SHIPPING = 'free_shipping'
}

export interface INotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: Date;
}

export enum NotificationType {
  ORDER_CONFIRMED = 'order_confirmed',
  ORDER_SHIPPED = 'order_shipped',
  ORDER_DELIVERED = 'order_delivered',
  PRODUCT_AVAILABLE = 'product_available',
  PRICE_DROP = 'price_drop',
  PROMOTION = 'promotion',
  SYSTEM = 'system'
}

export type TApiResponse<T> = {
  data: T;
  message: string;
  success: boolean;
};

export type TPaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type TSortOption = {
  field: string;
  direction: 'asc' | 'desc';
};

export type TFilterOption = {
  field: string;
  value: string | string[] | number | boolean;
  operator?: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin';
};

export type TSearchParams = {
  page?: number;
  limit?: number;
  sort?: TSortOption;
  filters?: TFilterOption[];
  search?: string;
};