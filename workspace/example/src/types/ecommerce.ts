export type TCurrencyCode = 'CNY' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'CAD';

export type TCountryCode =
  | 'CN'
  | 'US'
  | 'GB'
  | 'DE'
  | 'FR'
  | 'IT'
  | 'ES'
  | 'JP'
  | 'KR'
  | 'CA'
  | 'AU'
  | 'NZ'
  | 'SG'
  | 'HK'
  | 'TW';

export type TPaymentProvider = 'stripe' | 'paypal' | 'adyen' | 'wechat_pay' | 'alipay' | 'cod';

export type TShipmentProvider = 'ups' | 'fedex' | 'dhl' | 'sf_express' | 'ems' | 'other';

export type TDiscountType = 'percentage' | 'fixed_amount';

export type TProductStatus = 'draft' | 'active' | 'archived';

export type TInventoryPolicy = 'deny' | 'continue';

export type TOrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

export type TFulfillmentStatus = 'unfulfilled' | 'partial' | 'fulfilled';

export type TPaymentStatus = 'unpaid' | 'authorized' | 'paid' | 'partially_refunded' | 'refunded' | 'voided';

export type TUserRole = 'customer' | 'admin' | 'staff';

export type TAddressType = 'shipping' | 'billing';

export interface IMoney {
  /** 货币金额（最小货币单位，如分/cent），避免浮点误差 */
  amount: number;
  /** ISO 4217 货币代码 */
  currency: TCurrencyCode;
}

export interface IDateRange {
  /** 起始时间（ISO 8601） */
  startAt: string;
  /** 结束时间（ISO 8601） */
  endAt: string;
}

export interface IImage {
  /** 图片唯一标识 */
  id: string;
  /** 图片地址 */
  url: string;
  /** 图片替代文本 */
  alt?: string;
  /** 图片宽度（像素） */
  width?: number;
  /** 图片高度（像素） */
  height?: number;
}

export interface ISeo {
  /** SEO 标题 */
  title?: string;
  /** SEO 描述 */
  description?: string;
  /** SEO 关键词 */
  keywords?: string[];
  /** 规范链接 */
  canonicalUrl?: string;
}

export interface IAuditFields {
  /** 创建时间（ISO 8601） */
  createdAt: string;
  /** 更新时间（ISO 8601） */
  updatedAt: string;
}

export interface ICategory extends IAuditFields {
  /** 分类唯一标识 */
  id: string;
  /** 分类名称 */
  name: string;
  /** 分类别名（URL 友好） */
  slug: string;
  /** 分类描述 */
  description?: string;
  /** 分类图片 */
  image?: IImage;
  /** 父分类 ID */
  parentId?: string;
  /** 用于排序的权重（越小越靠前） */
  sortOrder?: number;
  /** 是否启用 */
  isActive: boolean;
  /** SEO 信息 */
  seo?: ISeo;
}

export interface IProductOptionValue {
  /** 选项值唯一标识 */
  id: string;
  /** 选项值名称（如 Red、XL） */
  name: string;
}

export interface IProductOption {
  /** 选项唯一标识 */
  id: string;
  /** 选项名称（如 Color、Size） */
  name: string;
  /** 选项可选值 */
  values: IProductOptionValue[];
}

export interface IProductVariant {
  /** 变体唯一标识 */
  id: string;
  /** 变体 SKU */
  sku: string;
  /** 变体条形码 */
  barcode?: string;
  /** 变体标题（可用于展示） */
  title?: string;
  /** 变体价格 */
  price: IMoney;
  /** 原价/划线价 */
  compareAtPrice?: IMoney;
  /** 成本价（用于利润核算） */
  cost?: IMoney;
  /** 是否需要配送（数字商品可为 false） */
  requiresShipping: boolean;
  /** 重量（克） */
  weightGrams?: number;
  /** 可售库存数量 */
  inventoryQuantity: number;
  /** 库存策略：缺货时拒绝/继续售卖 */
  inventoryPolicy: TInventoryPolicy;
  /** 选项组合映射（key 为选项名，value 为选项值名） */
  selectedOptions: Record<string, string>;
  /** 变体图片 */
  image?: IImage;
  /** 是否启用 */
  isActive: boolean;
}

export interface IProduct extends IAuditFields {
  /** 商品唯一标识 */
  id: string;
  /** 商品名称 */
  name: string;
  /** 商品别名（URL 友好） */
  slug: string;
  /** 商品状态 */
  status: TProductStatus;
  /** 商品描述（富文本/Markdown 由业务约束） */
  description?: string;
  /** 商品简述 */
  summary?: string;
  /** 商品主图 */
  thumbnail?: IImage;
  /** 商品图片集合 */
  images?: IImage[];
  /** 分类 ID 列表 */
  categoryIds: string[];
  /** 商品标签 */
  tags?: string[];
  /** 品牌 */
  brand?: string;
  /** 默认币种价格（无变体时可用） */
  price?: IMoney;
  /** 原价/划线价（无变体时可用） */
  compareAtPrice?: IMoney;
  /** 是否有多变体 */
  hasVariants: boolean;
  /** 商品选项定义（如颜色、尺寸） */
  options?: IProductOption[];
  /** 商品变体集合 */
  variants?: IProductVariant[];
  /** 是否需要配送（无变体时可用） */
  requiresShipping?: boolean;
  /** SEO 信息 */
  seo?: ISeo;
  /** 元数据（用于扩展） */
  metadata?: Record<string, string>;
}

export interface ICartItem {
  /** 购物车项唯一标识 */
  id: string;
  /** 商品 ID */
  productId: string;
  /** 变体 ID（若商品有变体） */
  variantId?: string;
  /** 数量 */
  quantity: number;
  /** 加入时的单价快照 */
  unitPrice: IMoney;
  /** 加入时的名称快照 */
  title: string;
  /** 加入时的 SKU 快照 */
  sku?: string;
  /** 加入时的图片快照 */
  image?: IImage;
  /** 是否需要配送 */
  requiresShipping: boolean;
  /** 自定义属性（如刻字信息） */
  properties?: Record<string, string>;
}

export interface IDiscount {
  /** 折扣唯一标识 */
  id: string;
  /** 折扣名称 */
  name: string;
  /** 折扣类型 */
  type: TDiscountType;
  /** 折扣值：百分比（0-100）或固定金额（最小货币单位） */
  value: number;
  /** 折扣适用币种（固定金额折扣使用） */
  currency?: TCurrencyCode;
  /** 折扣码（若为码券） */
  code?: string;
  /** 生效时间范围 */
  activeRange?: IDateRange;
}

export interface ICartTotals {
  /** 商品小计 */
  subtotal: IMoney;
  /** 折扣总额 */
  discountTotal: IMoney;
  /** 运费 */
  shippingTotal: IMoney;
  /** 税费 */
  taxTotal: IMoney;
  /** 应付总额 */
  total: IMoney;
}

export interface ICart extends IAuditFields {
  /** 购物车唯一标识 */
  id: string;
  /** 关联用户 ID（游客可为空） */
  userId?: string;
  /** 购物车项 */
  items: ICartItem[];
  /** 已应用折扣 */
  discounts?: IDiscount[];
  /** 价格汇总 */
  totals: ICartTotals;
  /** 购物车币种 */
  currency: TCurrencyCode;
  /** 购物车备注 */
  note?: string;
}

export interface IAddress {
  /** 地址唯一标识 */
  id: string;
  /** 地址类型 */
  type: TAddressType;
  /** 收件人/联系人姓名 */
  fullName: string;
  /** 手机/电话 */
  phone?: string;
  /** 国家/地区代码（ISO 3166-1 alpha-2） */
  country: TCountryCode;
  /** 省/州 */
  province?: string;
  /** 市 */
  city?: string;
  /** 区/县 */
  district?: string;
  /** 街道地址第一行 */
  addressLine1: string;
  /** 街道地址第二行 */
  addressLine2?: string;
  /** 邮编 */
  postalCode?: string;
  /** 公司名称 */
  company?: string;
  /** 是否为默认地址 */
  isDefault?: boolean;
}

export interface IUser extends IAuditFields {
  /** 用户唯一标识 */
  id: string;
  /** 用户角色 */
  role: TUserRole;
  /** 用户邮箱 */
  email: string;
  /** 邮箱是否已验证 */
  emailVerified: boolean;
  /** 用户手机号 */
  phone?: string;
  /** 手机号是否已验证 */
  phoneVerified?: boolean;
  /** 用户昵称 */
  name?: string;
  /** 用户头像 */
  avatar?: IImage;
  /** 地址簿 */
  addresses?: IAddress[];
  /** 用户是否被禁用 */
  isDisabled: boolean;
  /** 元数据（用于扩展） */
  metadata?: Record<string, string>;
}

export interface IOrderLineItem {
  /** 订单行项目唯一标识 */
  id: string;
  /** 商品 ID */
  productId: string;
  /** 变体 ID（若有） */
  variantId?: string;
  /** 行项目标题快照 */
  title: string;
  /** 行项目 SKU 快照 */
  sku?: string;
  /** 行项目图片快照 */
  image?: IImage;
  /** 数量 */
  quantity: number;
  /** 单价快照 */
  unitPrice: IMoney;
  /** 行小计（unitPrice * quantity - lineDiscounts） */
  lineSubtotal: IMoney;
  /** 行折扣合计 */
  lineDiscountTotal?: IMoney;
  /** 是否需要配送 */
  requiresShipping: boolean;
  /** 自定义属性 */
  properties?: Record<string, string>;
}

export interface IOrderShipping {
  /** 配送地址 */
  address: IAddress;
  /** 配送方式名称 */
  methodName?: string;
  /** 承运商 */
  provider?: TShipmentProvider;
  /** 运单号 */
  trackingNumber?: string;
  /** 追踪链接 */
  trackingUrl?: string;
  /** 运费 */
  shippingFee: IMoney;
}

export interface IOrderPayment {
  /** 支付方式提供方 */
  provider: TPaymentProvider;
  /** 支付状态 */
  status: TPaymentStatus;
  /** 支付交易号（第三方返回） */
  transactionId?: string;
  /** 已支付金额 */
  paidAmount?: IMoney;
  /** 支付时间（ISO 8601） */
  paidAt?: string;
}

export interface IOrderTotals {
  /** 商品小计 */
  subtotal: IMoney;
  /** 折扣总额 */
  discountTotal: IMoney;
  /** 运费 */
  shippingTotal: IMoney;
  /** 税费 */
  taxTotal: IMoney;
  /** 退款总额 */
  refundTotal?: IMoney;
  /** 应付总额 */
  total: IMoney;
}

export interface IOrder extends IAuditFields {
  /** 订单唯一标识 */
  id: string;
  /** 订单号（对用户可见） */
  orderNumber: string;
  /** 关联用户 ID（游客订单可为空） */
  userId?: string;
  /** 下单时用户邮箱快照 */
  customerEmail: string;
  /** 订单状态 */
  status: TOrderStatus;
  /** 履约状态 */
  fulfillmentStatus: TFulfillmentStatus;
  /** 支付信息 */
  payment: IOrderPayment;
  /** 订单行项目 */
  items: IOrderLineItem[];
  /** 已应用折扣 */
  discounts?: IDiscount[];
  /** 配送信息（数字商品可为空） */
  shipping?: IOrderShipping;
  /** 账单地址 */
  billingAddress?: IAddress;
  /** 价格汇总 */
  totals: IOrderTotals;
  /** 订单币种 */
  currency: TCurrencyCode;
  /** 订单备注（客户备注） */
  note?: string;
  /** 后台备注（仅内部） */
  internalNote?: string;
  /** 取消原因 */
  cancelReason?: string;
}