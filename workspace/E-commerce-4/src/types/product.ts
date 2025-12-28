export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  discountPrice?: number;
  image: string;
  images?: string[];
  category: string;
  stock: number;
  rating?: number;
  reviewCount?: number;
  tags?: string[];
  createdAt?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  description?: string;
  productCount?: number;
}

export type ProductCategory = 
  | 'electronics'
  | 'clothing'
  | 'home'
  | 'books'
  | 'sports'
  | 'beauty'
  | 'toys'
  | 'food'
  | 'other';

export interface ProductFilter {
  category?: ProductCategory;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  searchQuery?: string;
}

export interface ProductListResponse {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
}