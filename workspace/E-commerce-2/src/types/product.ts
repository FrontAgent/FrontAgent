/**
 * 产品类别类型
 * 定义产品的分类
 */
export type TProductCategory = 
  | 'electronics'
  | 'clothing'
  | 'food'
  | 'books'
  | 'home'
  | 'sports'
  | 'toys'
  | 'beauty'
  | 'other';

/**
 * 产品接口
 * 定义产品的完整信息结构
 */
export interface IProduct {
  /**
   * 产品唯一标识符
   */
  id: string;

  /**
   * 产品名称
   */
  name: string;

  /**
   * 产品价格
   */
  price: number;

  /**
   * 产品描述
   */
  description: string;

  /**
   * 产品图片URL
   */
  imageUrl: string;

  /**
   * 产品类别
   */
  category: TProductCategory;

  /**
   * 库存数量
   */
  stock: number;

  /**
   * 创建时间
   */
  createdAt?: Date;

  /**
   * 更新时间
   */
  updatedAt?: Date;

  /**
   * 是否上架
   */
  isActive?: boolean;

  /**
   * 产品评分
   */
  rating?: number;

  /**
   * 评论数量
   */
  reviewCount?: number;
}

/**
 * 产品类别接口
 * 定义产品类别的详细信息
 */
export interface IProductCategory {
  /**
   * 类别标识符
   */
  id: TProductCategory;

  /**
   * 类别显示名称
   */
  name: string;

  /**
   * 类别描述
   */
  description?: string;

  /**
   * 类别图标
   */
  icon?: string;
}

/**
 * 产品筛选接口
 * 用于产品列表的筛选和查询
 */
export interface IProductFilter {
  /**
   * 产品类别筛选
   */
  category?: TProductCategory | TProductCategory[];

  /**
   * 最低价格
   */
  minPrice?: number;

  /**
   * 最高价格
   */
  maxPrice?: number;

  /**
   * 搜索关键词
   */
  keyword?: string;

  /**
   * 是否仅显示有库存的产品
   */
  inStock?: boolean;

  /**
   * 是否仅显示上架的产品
   */
  isActive?: boolean;

  /**
   * 最低评分
   */
  minRating?: number;

  /**
   * 排序字段
   */
  sortBy?: 'price' | 'name' | 'createdAt' | 'rating' | 'reviewCount';

  /**
   * 排序方向
   */
  sortOrder?: 'asc' | 'desc';

  /**
   * 页码
   */
  page?: number;

  /**
   * 每页数量
   */
  pageSize?: number;
}

/**
 * 产品创建数据传输对象
 * 用于创建新产品时的数据结构
 */
export interface IProductCreateDTO {
  name: string;
  price: number;
  description: string;
  imageUrl: string;
  category: TProductCategory;
  stock: number;
  isActive?: boolean;
}

/**
 * 产品更新数据传输对象
 * 用于更新产品时的数据结构
 */
export interface IProductUpdateDTO {
  name?: string;
  price?: number;
  description?: string;
  imageUrl?: string;
  category?: TProductCategory;
  stock?: number;
  isActive?: boolean;
}