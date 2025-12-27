export interface IUser {
  /** 用户唯一标识符 */
  id: string;
  /** 用户名 */
  username: string;
  /** 邮箱地址 */
  email: string;
  /** 真实姓名 */
  fullName: string;
  /** 手机号码 */
  phone?: string;
  /** 用户角色 */
  role: TUserRole;
  /** 用户头像URL */
  avatar?: string;
  /** 是否激活 */
  isActive: boolean;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

export interface IProduct {
  /** 商品唯一标识符 */
  id: string;
  /** 商品名称 */
  name: string;
  /** 商品描述 */
  description: string;
  /** 商品价格 */
  price: number;
  /** 商品原价 */
  originalPrice?: number;
  /** 商品图片URLs */
  images: string[];
  /** 库存数量 */
  stock: number;
  /** 分类ID */
  categoryId: string;
  /** 分类信息 */
  category?: ICategory;
  /** 商品标签 */
  tags: string[];
  /** 商品规格 */
  specifications?: Record<string, string>;
  /** 是否上架 */
  isActive: boolean;
  /** 是否推荐 */
  isRecommended: boolean;
  /** 销量 */
  salesCount: number;
  /** 评分 */
  rating: number;
  /** 评价数量 */
  reviewCount: number;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

export interface ICategory {
  /** 分类唯一标识符 */
  id: string;
  /** 分类名称 */
  name: string;
  /** 分类描述 */
  description?: string;
  /** 分类图标URL */
  icon?: string;
  /** 父分类ID */
  parentId?: string;
  /** 子分类 */
  children?: ICategory[];
  /** 排序权重 */
  sortOrder: number;
  /** 是否激活 */
  isActive: boolean;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

export interface IAddress {
  /** 地址唯一标识符 */
  id: string;
  /** 收货人姓名 */
  recipientName: string;
  /** 收货人手机号 */
  recipientPhone: string;
  /** 省份 */
  province: string;
  /** 城市 */
  city: string;
  /** 区县 */
  district: string;
  /** 详细地址 */
  detail: string;
  /** 邮政编码 */
  postalCode?: string;
  /** 是否默认地址 */
  isDefault: boolean;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

export interface ICartItem {
  /** 购物车项唯一标识符 */
  id: string;
  /** 用户ID */
  userId: string;
  /** 商品ID */
  productId: string;
  /** 商品信息 */
  product?: IProduct;
  /** 购买数量 */
  quantity: number;
  /** 添加时间 */
  addedAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

export interface IOrderItem {
  /** 订单项唯一标识符 */
  id: string;
  /** 商品ID */
  productId: string;
  /** 商品信息 */
  product?: IProduct;
  /** 商品名称快照 */
  productName: string;
  /** 商品图片快照 */
  productImage: string;
  /** 购买单价 */
  unitPrice: number;
  /** 购买数量 */
  quantity: number;
  /** 小计金额 */
  subtotal: number;
}

export interface IOrder {
  /** 订单唯一标识符 */
  id: string;
  /** 订单号 */
  orderNumber: string;
  /** 用户ID */
  userId: string;
  /** 用户信息 */
  user?: IUser;
  /** 订单项列表 */
  items: IOrderItem[];
  /** 收货地址ID */
  addressId: string;
  /** 收货地址 */
  address?: IAddress;
  /** 订单总金额 */
  totalAmount: number;
  /** 运费 */
  shippingFee: number;
  /** 优惠金额 */
  discountAmount: number;
  /** 实际支付金额 */
  paidAmount: number;
  /** 订单状态 */
  status: TOrderStatus;
  /** 支付状态 */
  paymentStatus: TPaymentStatus;
  /** 支付方式 */
  paymentMethod?: string;
  /** 支付时间 */
  paidAt?: Date;
  /** 发货时间 */
  shippedAt?: Date;
  /** 完成时间 */
  completedAt?: Date;
  /** 取消时间 */
  cancelledAt?: Date;
  /** 取消原因 */
  cancelReason?: string;
  /** 备注 */
  remark?: string;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

export interface IReview {
  /** 评价唯一标识符 */
  id: string;
  /** 订单ID */
  orderId: string;
  /** 商品ID */
  productId: string;
  /** 用户ID */
  userId: string;
  /** 用户信息 */
  user?: IUser;
  /** 评分 (1-5) */
  rating: number;
  /** 评价内容 */
  content: string;
  /** 评价图片 */
  images?: string[];
  /** 是否匿名 */
  isAnonymous: boolean;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

export interface ICoupon {
  /** 优惠券唯一标识符 */
  id: string;
  /** 优惠券名称 */
  name: string;
  /** 优惠券描述 */
  description?: string;
  /** 优惠券码 */
  code: string;
  /** 优惠类型 */
  discountType: 'percentage' | 'fixed';
  /** 优惠值 */
  discountValue: number;
  /** 使用门槛金额 */
  minAmount?: number;
  /** 最大优惠金额 */
  maxDiscountAmount?: number;
  /** 使用开始时间 */
  validFrom: Date;
  /** 使用结束时间 */
  validTo: Date;
  /** 使用次数限制 */
  usageLimit?: number;
  /** 已使用次数 */
  usedCount: number;
  /** 是否激活 */
  isActive: boolean;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

export interface IWishlistItem {
  /** 收藏项唯一标识符 */
  id: string;
  /** 用户ID */
  userId: string;
  /** 商品ID */
  productId: string;
  /** 商品信息 */
  product?: IProduct;
  /** 收藏时间 */
  addedAt: Date;
}

export type TUserRole = 'customer' | 'admin' | 'seller';

export type TOrderStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'processing' 
  | 'shipped' 
  | 'delivered' 
  | 'cancelled' 
  | 'refunded';

export type TPaymentStatus = 
  | 'pending' 
  | 'paid' 
  | 'failed' 
  | 'refunded' 
  | 'partially_refunded';

export type TDiscountType = 'percentage' | 'fixed';

export interface IPaginationParams {
  /** 页码 (从1开始) */
  page: number;
  /** 每页数量 */
  pageSize: number;
}

export interface IPaginationResult<T> {
  /** 数据列表 */
  data: T[];
  /** 总数量 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页数量 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
  /** 是否有上一页 */
  hasPrevious: boolean;
  /** 是否有下一页 */
  hasNext: boolean;
}

export interface ISearchParams extends IPaginationParams {
  /** 搜索关键词 */
  keyword?: string;
  /** 排序字段 */
  sortBy?: string;
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
  /** 筛选条件 */
  filters?: Record<string, any>;
}

export interface IApiResponse<T = any> {
  /** 是否成功 */
  success: boolean;
  /** 响应数据 */
  data?: T;
  /** 错误信息 */
  error?: string;
  /** 错误代码 */
  code?: string;
  /** 时间戳 */
  timestamp: string;
}

export interface ILoginRequest {
  /** 用户名或邮箱 */
  username: string;
  /** 密码 */
  password: string;
}

export interface ILoginResponse {
  /** 访问令牌 */
  accessToken: string;
  /** 刷新令牌 */
  refreshToken: string;
  /** 用户信息 */
  user: IUser;
  /** 令牌过期时间 */
  expiresIn: number;
}

export interface IRegisterRequest {
  /** 用户名 */
  username: string;
  /** 邮箱 */
  email: string;
  /** 密码 */
  password: string;
  /** 确认密码 */
  confirmPassword: string;
  /** 真实姓名 */
  fullName: string;
  /** 手机号 */
  phone?: string;
}

export interface IChangePasswordRequest {
  /** 旧密码 */
  oldPassword: string;
  /** 新密码 */
  newPassword: string;
  /** 确认新密码 */
  confirmPassword: string;
}

export interface IUpdateProfileRequest {
  /** 真实姓名 */
  fullName?: string;
  /** 手机号 */
  phone?: string;
  /** 头像 */
  avatar?: string;
}

export interface IResetPasswordRequest {
  /** 邮箱 */
  email: string;
}

export interface IConfirmResetPasswordRequest {
  /** 重置令牌 */
  token: string;
  /** 新密码 */
  newPassword: string;
  /** 确认新密码 */
  confirmPassword: string;
}