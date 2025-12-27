export interface IProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  currency: string;
  sku: string;
  stock: number;
  images: IProductImage[];
  category: ICategory;
  brand?: string;
  tags: string[];
  rating: number;
  reviewCount: number;
  attributes: IProductAttribute[];
  variants?: IProductVariant[];
  createdAt: string;
  updatedAt: string;
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

export interface IProductVariant {
  id: string;
  productId: string;
  sku: string;
  price: number;
  stock: number;
  attributes: IProductAttribute[];
  image?: IProductImage;
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
  productCount: number;
}

export interface IUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  role: 'customer' | 'admin' | 'vendor';
  status: 'active' | 'inactive' | 'suspended';
  emailVerified: boolean;
  phoneVerified: boolean;
  addresses: IAddress[];
  preferences: IUserPreferences;
  createdAt: string;
  updatedAt: string;
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

export interface IUserPreferences {
  language: string;
  currency: string;
  newsletter: boolean;
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
}

export interface ICartItem {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  addedAt: string;
  product: IProduct;
  variant?: IProductVariant;
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
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IOrder {
  id: string;
  orderNumber: string;
  userId: string;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  items: IOrderItem[];
  shippingAddress: IAddress;
  billingAddress: IAddress;
  payment: IPayment;
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  notes?: string;
  trackingNumber?: string;
  estimatedDelivery?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IOrderItem {
  id: string;
  productId: string;
  variantId?: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  total: number;
  image: string;
  attributes?: IProductAttribute[];
}

export interface IPayment {
  id: string;
  method: 'credit_card' | 'debit_card' | 'paypal' | 'stripe' | 'bank_transfer' | 'cash_on_delivery';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded';
  amount: number;
  currency: string;
  transactionId?: string;
  gatewayResponse?: Record<string, unknown>;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IReview {
  id: string;
  productId: string;
  userId: string;
  rating: number;
  title: string;
  content: string;
  images?: string[];
  helpful: number;
  verified: boolean;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface IWishlist {
  id: string;
  userId: string;
  name: string;
  description?: string;
  isPublic: boolean;
  items: IWishlistItem[];
  createdAt: string;
  updatedAt: string;
}

export interface IWishlistItem {
  id: string;
  productId: string;
  variantId?: string;
  addedAt: string;
  product: IProduct;
  variant?: IProductVariant;
}

export interface ICoupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed' | 'free_shipping';
  value: number;
  minimumAmount?: number;
  maximumDiscount?: number;
  usageLimit?: number;
  usageCount: number;
  applicableProducts?: string[];
  applicableCategories?: string[];
  excludedProducts?: string[];
  excludedCategories?: string[];
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface INotification {
  id: string;
  userId: string;
  type: 'order' | 'payment' | 'shipping' | 'promotion' | 'account' | 'system';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

export interface IFilterOptions {
  categories?: string[];
  brands?: string[];
  priceRange?: {
    min: number;
    max: number;
  };
  rating?: number;
  inStock?: boolean;
  tags?: string[];
  attributes?: Record<string, string[]>;
}

export interface ISortOptions {
  field: 'name' | 'price' | 'rating' | 'createdAt' | 'reviewCount';
  order: 'asc' | 'desc';
}

export interface IPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface IApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
  errors?: string[];
}

export interface IProductListResponse {
  products: IProduct[];
  pagination: IPagination;
  filters: IFilterOptions;
  sort: ISortOptions;
}

export interface IOrderListResponse {
  orders: IOrder[];
  pagination: IPagination;
}

export interface IReviewListResponse {
  reviews: IReview[];
  pagination: IPagination;
  averageRating: number;
  ratingDistribution: Record<number, number>;
}

export type TSearchSuggestion = {
  type: 'product' | 'category' | 'brand';
  value: string;
  url?: string;
  image?: string;
  price?: number;
};

export interface ISearchResponse {
  suggestions: TSearchSuggestion[];
  products: IProduct[];
  categories: ICategory[];
  brands: string[];
  pagination: IPagination;
}