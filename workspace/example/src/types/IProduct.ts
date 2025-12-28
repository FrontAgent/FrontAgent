import type { TCurrencyCode } from './TCurrencyCode';
import type { TMoney } from './TMoney';

/**
 * 产品分类信息。
 */
export interface IProductCategory {
  /** 分类唯一标识 */
  id: string;
  /** 分类名称 */
  title: string;
  /** 分类路径（可选），如 ["电子产品","手机"] */
  path?: string[];
}

/**
 * 产品图片信息。
 */
export interface IProductImage {
  /** 图片地址 */
  url: string;
  /** 备用文本（可选） */
  alt?: string;
  /** 图片宽度（可选） */
  width?: number;
  /** 图片高度（可选） */
  height?: number;
}

/**
 * 产品评价汇总信息。
 */
export interface IProductRating {
  /** 平均评分（0-5） */
  average: number;
  /** 评价数量 */
  count: number;
}

/**
 * 产品接口。
 */
export interface IProduct {
  /** 产品唯一标识 */
  id: string;
  /** 产品标题 */
  title: string;
  /** 产品简短描述（可选） */
  description?: string;

  /**
   * 价格数值（以主货币单位表示，如 19.99）。
   * 与 currency 一起形成最小可用价格描述。
   */
  price: number;

  /** 货币代码（ISO 4217，如 "USD"） */
  currency: TCurrencyCode;

  /**
   * 完整金额信息（可选）。
   * 当需要避免浮点误差或携带更多定价信息时使用。
   */
  money?: TMoney;

  /** 主图 URL（兼容字段） */
  imageUrl: string;

  /** 图片列表（可选） */
  images?: IProductImage[];

  /** 分类信息（可选） */
  category?: IProductCategory;

  /** SKU（可选） */
  sku?: string;

  /** 库存数量（可选） */
  stock?: number;

  /** 是否可购买（可选） */
  isAvailable?: boolean;

  /** 评分信息（可选） */
  rating?: IProductRating;

  /** 标签（可选） */
  tags?: string[];

  /** 创建时间（ISO 字符串，可选） */
  createdAt?: string;

  /** 更新时间（ISO 字符串，可选） */
  updatedAt?: string;
}