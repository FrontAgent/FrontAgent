export interface IProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  images: string[];
  categoryId: string;
  category: ICategory;
  brand: string;
  sku: string;
  stock: number;
  rating: number;
  reviewCount: number;
  tags: string[];
  attributes: IProductAttribute[];
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  parent?: ICategory;
  children?: ICategory[];
  image?: string;
  level: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProductAttribute {
  id: string;
  name: string;
  value: string;
  type: AttributeType;
}

export enum ProductStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  OUT_OF_STOCK = 'out_of_stock',
  DISCONTINUED = 'discontinued'
}

export enum AttributeType {
  TEXT = 'text',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  SELECT = 'select',
  MULTI_SELECT = 'multi_select'
}

export interface IUser {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  dateOfBirth?: Date;
  gender?: Gender;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  status: UserStatus;
  preferences: IUserPreferences;
  addresses: IAddress[];
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
  PREFER_NOT_TO_SAY = 'prefer_not_to_say'
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_VERIFICATION = 'pending_verification'
}

export interface IUserPreferences {
  language: string;
  currency: string;
  timezone: string;
  notifications: INotificationSettings;
  privacy: IPrivacySettings;
}

export interface INotificationSettings {
  email: boolean;
  sms: boolean;
  push: boolean;
  marketing: boolean;
  orderUpdates: boolean;
  promotions: boolean;
}

export interface IPrivacySettings {
  profileVisibility: ProfileVisibility;
  showOnlineStatus: boolean;
  allowDataCollection: boolean;
}

export enum ProfileVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
  FRIENDS_ONLY = 'friends_only'
}

export interface IAddress {
  id: string;
  userId: string;
  type: AddressType;
  firstName: string;
  lastName: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  isDefault: boolean;
  coordinates?: ICoordinates;
}

export enum AddressType {
  SHIPPING = 'shipping',
  BILLING = 'billing',
  BOTH = 'both'
}

export interface ICoordinates {
  latitude: number;
  longitude: number;
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
  sessionId: string;
  items: ICartItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  updatedAt: Date;
  expiresAt: Date;
}

export interface IOrder {
  id: string;
  orderNumber: string;
  userId: string;
  user: IUser;
  status: OrderStatus;
  items: IOrderItem[];
  shippingAddress: IAddress;
  billingAddress: IAddress;
  paymentMethod: IPaymentMethod;
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  notes?: string;
  trackingNumber?: string;
  estimatedDelivery?: Date;
  actualDelivery?: Date;
  createdAt: Date;
  updatedAt: Date;
  history: IOrderHistory[];
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
  REFUNDED = 'refunded',
  RETURNED = 'returned'
}

export interface IOrderHistory {
  id: string;
  orderId: string;
  status: OrderStatus;
  note?: string;
  timestamp: Date;
  userId?: string;
}

export interface IPaymentMethod {
  id: string;
  type: PaymentType;
  name: string;
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
  billingAddress?: IAddress;
}

export enum PaymentType {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  PAYPAL = 'paypal',
  APPLE_PAY = 'apple_pay',
  GOOGLE_PAY = 'google_pay',
  BANK_TRANSFER = 'bank_transfer',
  CASH_ON_DELIVERY = 'cash_on_delivery'
}

export interface IReview {
  id: string;
  productId: string;
  userId: string;
  user: IUser;
  rating: number;
  title: string;
  content: string;
  images?: string[];
  isVerified: boolean;
  helpfulCount: number;
  reportedCount: number;
  status: ReviewStatus;
  createdAt: Date;
  updatedAt: Date;
}

export enum ReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  FLAGGED = 'flagged'
}

export interface IWishlist {
  id: string;
  userId: string;
  name: string;
  isDefault: boolean;
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
  usedCount: number;
  validFrom: Date;
  validUntil: Date;
  isActive: boolean;
  applicableCategories?: string[];
  applicableProducts?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export enum CouponType {
  PERCENTAGE = 'percentage',
  FIXED_AMOUNT = 'fixed_amount',
  FREE_SHIPPING = 'free_shipping',
  BUY_X_GET_Y = 'buy_x_get_y'
}

export interface IShippingMethod {
  id: string;
  name: string;
  description: string;
  price: number;
  estimatedDays: number;
  carrier: string;
  trackingAvailable: boolean;
  isActive: boolean;
}

export interface ITaxRate {
  id: string;
  country: string;
  state?: string;
  rate: number;
  name: string;
  isActive: boolean;
}

export interface IDiscount {
  id: string;
  type: DiscountType;
  value: number;
  description: string;
  code?: string;
  minimumAmount?: number;
  validFrom: Date;
  validUntil: Date;
  usageLimit?: number;
  usedCount: number;
}

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED_AMOUNT = 'fixed_amount',
  FREE_SHIPPING = 'free_shipping'
}

export interface IPaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: SortOrder;
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc'
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
  error?: IApiError;
  message?: string;
}

export interface IApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface ISearchFilters {
  query?: string;
  categoryId?: string;
  brand?: string;
  priceMin?: number;
  priceMax?: number;
  rating?: number;
  inStock?: boolean;
  tags?: string[];
  attributes?: Record<string, string[]>;
}

export interface ISearchResult {
  products: IProduct[];
  facets: ISearchFacets;
  total: number;
  query: string;
  took: number;
}

export interface ISearchFacets {
  categories: Array<{ id: string; name: string; count: number }>;
  brands: Array<{ name: string; count: number }>;
  priceRanges: Array<{ min: number; max: number; count: number }>;
  ratings: Array<{ rating: number; count: number }>;
  attributes: Record<string, Array<{ value: string; count: number }>>;
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
  ORDER_UPDATE = 'order_update',
  PAYMENT_CONFIRMATION = 'payment_confirmation',
  SHIPPING_UPDATE = 'shipping_update',
  PROMOTION = 'promotion',
  REVIEW_REQUEST = 'review_request',
  PRICE_DROP = 'price_drop',
  BACK_IN_STOCK = 'back_in_stock'
}

export interface IAnalytics {
  userId: string;
  events: IAnalyticsEvent[];
  preferences: IAnalyticsPreferences;
}

export interface IAnalyticsEvent {
  type: string;
  timestamp: Date;
  data: Record<string, any>;
  sessionId: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface IAnalyticsPreferences {
  trackingEnabled: boolean;
  dataRetentionDays: number;
  anonymizeData: boolean;
}

export type TProductStatus = keyof typeof ProductStatus;
export type TUserStatus = keyof typeof UserStatus;
export type TGender = keyof typeof Gender;
export type TAddressType = keyof typeof AddressType;
export type TOrderStatus = keyof typeof OrderStatus;
export type TPaymentType = keyof typeof PaymentType;
export type TReviewStatus = keyof typeof ReviewStatus;
export type TCouponType = keyof typeof CouponType;
export type TDiscountType = keyof typeof DiscountType;
export type TSortOrder = keyof typeof SortOrder;
export type TNotificationType = keyof typeof NotificationType;
export type TProfileVisibility = keyof typeof ProfileVisibility;