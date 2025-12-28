export type TCurrencyCode =
  | 'CNY'
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'JPY'
  | 'KRW'
  | 'AUD'
  | 'CAD'
  | 'HKD'
  | 'SGD';

export type TLocaleTag =
  | 'zh-CN'
  | 'zh-HK'
  | 'zh-TW'
  | 'en-US'
  | 'en-GB'
  | 'ja-JP'
  | 'ko-KR';

export type TId = string;

export type TStockStatus = 'in_stock' | 'out_of_stock' | 'low_stock' | 'preorder';

export type TProductStatus = 'active' | 'inactive' | 'archived';

export type TImageType = 'main' | 'gallery' | 'thumbnail';

export type TCartItemType = 'product' | 'gift' | 'bundle';

export type TMoneyAmountMinor = number;

export type TRatio = number;

export type TWeightUnit = 'g' | 'kg' | 'lb' | 'oz';

export type TDimensionUnit = 'mm' | 'cm' | 'm' | 'in';

export interface IISODateTimeStringBrand {
  readonly __brand: 'ISODateTimeString';
}

/**
 * ISO 8601 date-time string. Prefer using a validated string from server.
 */
export type TISODateTimeString = string & IISODateTimeStringBrand;

/**
 * Monetary value stored in minor units (e.g., cents).
 */
export interface IMoney {
  /**
   * Currency code in ISO 4217.
   */
  currency: TCurrencyCode;
  /**
   * Amount in minor units. Example: 1999 => 19.99.
   */
  amountMinor: TMoneyAmountMinor;
}

/**
 * Price with optional comparison/reference price and discount information.
 */
export interface IPrice {
  /**
   * Current payable amount.
   */
  current: IMoney;
  /**
   * Optional original/reference price for display (e.g., strikethrough).
   */
  original?: IMoney;
  /**
   * Discount ratio in range (0, 1]. Example: 0.8 means 20% off.
   */
  discountRatio?: TRatio;
  /**
   * Optional tax-included flag to support UI badges.
   */
  taxIncluded?: boolean;
}

/**
 * A single image asset for product/category.
 */
export interface IImage {
  id: TId;
  /**
   * Publicly accessible URL.
   */
  url: string;
  /**
   * Optional alternative text for accessibility.
   */
  alt?: string;
  /**
   * Image pixel width.
   */
  width?: number;
  /**
   * Image pixel height.
   */
  height?: number;
  /**
   * Image semantic type.
   */
  type?: TImageType;
}

/**
 * Product category taxonomy node.
 */
export interface ICategory {
  id: TId;
  /**
   * Category name for display.
   */
  name: string;
  /**
   * Optional slug for routing/SEO.
   */
  slug?: string;
  /**
   * Optional category image.
   */
  image?: IImage;
  /**
   * Parent category id for hierarchical navigation.
   */
  parentId?: TId;
  /**
   * Sort order (ascending).
   */
  sortOrder?: number;
}

/**
 * Physical attributes for shipping calculation.
 */
export interface IShippingProfile {
  weight?: {
    value: number;
    unit: TWeightUnit;
  };
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: TDimensionUnit;
  };
}

/**
 * Simplified product inventory state for list and cart UI.
 */
export interface IInventory {
  status: TStockStatus;
  /**
   * Available quantity (if known).
   */
  quantityAvailable?: number;
}

/**
 * Minimal product type to support product list and cart presentation.
 */
export interface IProduct {
  id: TId;
  /**
   * Stable SKU identifier.
   */
  sku: string;
  /**
   * Display title of product.
   */
  title: string;
  /**
   * Optional short description for list view.
   */
  shortDescription?: string;
  /**
   * Optional long description for detail view.
   */
  description?: string;
  /**
   * Product lifecycle status.
   */
  status: TProductStatus;
  /**
   * Product categories.
   */
  categories: ICategory[];
  /**
   * Product main image, if available.
   */
  mainImage?: IImage;
  /**
   * Product gallery images.
   */
  images?: IImage[];
  /**
   * Current pricing information.
   */
  price: IPrice;
  /**
   * Inventory summary for UI badges and cart constraints.
   */
  inventory: IInventory;
  /**
   * Optional shipping attributes.
   */
  shipping?: IShippingProfile;
  /**
   * Product attributes for variant-like display (minimal key/value).
   */
  attributes?: ReadonlyArray<{
    key: string;
    value: string;
  }>;
  /**
   * Optional creation time.
   */
  createdAt?: TISODateTimeString;
  /**
   * Optional update time.
   */
  updatedAt?: TISODateTimeString;
}

/**
 * Minimal list response for catalog browsing.
 */
export interface ICatalogListResult {
  items: IProduct[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Pagination input commonly used by product list pages.
 */
export interface IPaginationInput {
  page: number;
  pageSize: number;
}

/**
 * Simple sorting for product list.
 */
export type TProductSort =
  | 'relevance'
  | 'newest'
  | 'price_asc'
  | 'price_desc'
  | 'title_asc'
  | 'title_desc';

export interface IProductListQuery {
  /**
   * Free-text search keyword.
   */
  keyword?: string;
  /**
   * Filter by category id.
   */
  categoryId?: TId;
  /**
   * Filter by product status.
   */
  status?: TProductStatus;
  /**
   * Sort order.
   */
  sort?: TProductSort;
  /**
   * Pagination input.
   */
  pagination: IPaginationInput;
}

/**
 * Snapshot of money used in orders/cart to avoid recomputing after price changes.
 */
export interface IPriceSnapshot {
  /**
   * Unit price at the moment the item is added/updated.
   */
  unit: IMoney;
  /**
   * Optional original unit price at snapshot time.
   */
  originalUnit?: IMoney;
}

/**
 * A single line item in the shopping cart.
 */
export interface ICartItem {
  id: TId;
  type: TCartItemType;
  productId: TId;
  /**
   * Redundant fields for fast cart rendering; should be kept consistent with product snapshot.
   */
  title: string;
  sku: string;
  /**
   * Optional image shown in cart.
   */
  image?: IImage;
  /**
   * Quantity of product.
   */
  quantity: number;
  /**
   * Unit pricing snapshot for consistent display.
   */
  price: IPriceSnapshot;
  /**
   * Optional selected attributes (e.g., color, size) for display.
   */
  selectedOptions?: ReadonlyArray<{
    name: string;
    value: string;
  }>;
  /**
   * Inventory status at the time of last validation.
   */
  inventory?: IInventory;
  /**
   * Item-level notes.
   */
  note?: string;
}

/**
 * Cart pricing summary.
 */
export interface ICartTotals {
  /**
   * Sum of item line totals (unit * quantity), excluding discounts if represented separately.
   */
  itemsSubtotal: IMoney;
  /**
   * Optional discount total to display.
   */
  discountTotal?: IMoney;
  /**
   * Optional shipping total if calculated.
   */
  shippingTotal?: IMoney;
  /**
   * Optional tax total if calculated.
   */
  taxTotal?: IMoney;
  /**
   * Final payable total.
   */
  grandTotal: IMoney;
}

/**
 * Shopping cart object to support cart page rendering.
 */
export interface ICart {
  id: TId;
  /**
   * Currency used by the cart.
   */
  currency: TCurrencyCode;
  /**
   * Cart items.
   */
  items: ICartItem[];
  /**
   * Totals calculated by backend or client.
   */
  totals: ICartTotals;
  /**
   * Total quantity across all items.
   */
  totalQuantity: number;
  /**
   * Optional updated time for optimistic UI.
   */
  updatedAt?: TISODateTimeString;
}

/**
 * Utility type: product list item minimal subset.
 */
export type TProductListItem = Pick<
  IProduct,
  'id' | 'sku' | 'title' | 'shortDescription' | 'status' | 'categories' | 'mainImage' | 'price' | 'inventory'
>;

/**
 * Utility type: minimal cart display row.
 */
export type TCartDisplayRow = Pick<
  ICartItem,
  'id' | 'productId' | 'title' | 'sku' | 'image' | 'quantity' | 'price' | 'selectedOptions' | 'inventory'
>;