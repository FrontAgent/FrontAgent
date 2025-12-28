export type ApiErrorCode =
  | 'UNKNOWN'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR';

export type ApiError = {
  code: ApiErrorCode;
  message: string;
  status?: number;
  details?: Record<string, unknown>;
  requestId?: string;
};

export type ID = string;

export type ISODateString = string;

export type UserRole = 'user' | 'admin';

export type User = {
  id: ID;
  name: string;
  email: string;
  avatarUrl?: string;
  role?: UserRole;
  createdAt?: ISODateString;
  updatedAt?: ISODateString;
};

export type AuthToken = {
  accessToken: string;
  tokenType?: 'Bearer';
  expiresAt?: ISODateString;
  refreshToken?: string;
};

export type AuthResponse = {
  user: User;
  token: AuthToken;
};

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type Money = {
  currency: string;
  amount: number;
};

export type Address = {
  name?: string;
  phone?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
};

export type OrderItem = {
  id: ID;
  productId: ID;
  name: string;
  imageUrl?: string;
  unitPrice: Money;
  quantity: number;
  subtotal?: Money;
};

export type Order = {
  id: ID;
  userId?: ID;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: Money;
  shippingFee?: Money;
  discount?: Money;
  tax?: Money;
  total: Money;
  shippingAddress?: Address;
  createdAt: ISODateString;
  updatedAt?: ISODateString;
};

export type ProductStatus = 'active' | 'inactive' | 'out_of_stock';

export type Product = {
  id: ID;
  name: string;
  description?: string;
  imageUrl?: string;
  images?: string[];
  price: Money;
  originalPrice?: Money;
  status?: ProductStatus;
  sku?: string;
  stock?: number;
  categoryId?: ID;
  categoryName?: string;
  tags?: string[];
  rating?: number;
  reviewCount?: number;
  createdAt?: ISODateString;
  updatedAt?: ISODateString;
};

export type CartItem = {
  id: ID;
  productId: ID;
  product?: Pick<Product, 'id' | 'name' | 'imageUrl' | 'price' | 'status' | 'stock'>;
  quantity: number;
  selected?: boolean;
  addedAt?: ISODateString;
};

export type Cart = {
  items: CartItem[];
  subtotal?: Money;
  totalQuantity?: number;
  updatedAt?: ISODateString;
};

export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
};

export type Paginated<T> = {
  items: T[];
  pagination: Pagination;
};

export type ApiResponse<T> = {
  data: T;
  error?: never;
};

export type ApiFailure = {
  data?: never;
  error: ApiError;
};

export type ApiResult<T> = ApiResponse<T> | ApiFailure;