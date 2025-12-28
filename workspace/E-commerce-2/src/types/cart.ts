import { IProduct } from './product';

/**
 * 购物车商品项接口
 * 表示购物车中的单个商品项，包含商品信息、数量和价格
 */
export interface ICartItem {
  /** 商品ID */
  productId: string;
  /** 商品信息 */
  product: IProduct;
  /** 商品数量 */
  quantity: number;
  /** 单价 */
  price: number;
  /** 小计（单价 * 数量） */
  subtotal: number;
  /** 添加到购物车的时间 */
  addedAt: Date;
}

/**
 * 购物车接口
 * 表示用户的购物车，包含所有商品项和总计信息
 */
export interface ICart {
  /** 购物车ID */
  id: string;
  /** 用户ID */
  userId: string;
  /** 购物车商品项列表 */
  items: ICartItem[];
  /** 商品总数量 */
  totalQuantity: number;
  /** 商品总价 */
  totalPrice: number;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/**
 * 结账信息接口
 * 包含结账时需要的所有信息
 */
export interface ICheckoutInfo {
  /** 购物车ID */
  cartId: string;
  /** 用户ID */
  userId: string;
  /** 收货地址 */
  shippingAddress: {
    /** 收件人姓名 */
    fullName: string;
    /** 电话号码 */
    phone: string;
    /** 省份 */
    province: string;
    /** 城市 */
    city: string;
    /** 区县 */
    district: string;
    /** 详细地址 */
    detailAddress: string;
    /** 邮政编码 */
    postalCode?: string;
  };
  /** 支付方式 */
  paymentMethod: 'credit_card' | 'debit_card' | 'alipay' | 'wechat_pay' | 'cash_on_delivery';
  /** 商品总价 */
  subtotal: number;
  /** 运费 */
  shippingFee: number;
  /** 折扣金额 */
  discount: number;
  /** 最终总价 */
  totalAmount: number;
  /** 备注信息 */
  notes?: string;
  /** 优惠券代码 */
  couponCode?: string;
}