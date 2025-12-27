export interface IProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  sku: string;
  stock: number;
  images: IProductImage[];
  category: IProductCategory;
  brand?: string;
  tags: string[];
  rating: number;
  reviewCount: number;
  status: ProductStatus;
  attributes: Record<string, string>;
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

export interface IProductCategory {
  id: string;
  name: string;
  slug: string;
  parentId?: string;
  level: number;
  children?: IProductCategory[];
}

export interface IProductList {
  products: IProduct[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface IProductFilter {
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  tags?: string[];
  status?: ProductStatus;
  search?: string;
  sortBy?: ProductSortBy;
  sortOrder?: SortOrder;
}

export interface IProductVariant {
  id: string;
  productId: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  attributes: Record<string, string>;
  image?: IProductImage;
}

export interface IProductReview {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  title: string;
  content: string;
  images: string[];
  helpfulCount: number;
  verified: boolean;
  createdAt: Date;
}

export type ProductStatus = 'active' | 'inactive' | 'draft' | 'archived';

export type ProductSortBy = 'name' | 'price' | 'rating' | 'createdAt' | 'reviewCount';

export type SortOrder = 'asc' | 'desc';

export type TProductCard = Pick<IProduct, 'id' | 'name' | 'price' | 'originalPrice' | 'images' | 'rating' | 'reviewCount' | 'status'>;

export type TProductDetail = IProduct & {
  variants: IProductVariant[];
  reviews: IProductReview[];
  relatedProducts: IProduct[];
};

export type TProductSearchResult = {
  products: TProductCard[];
  suggestions: string[];
  categories: IProductCategory[];
  total: number;
};