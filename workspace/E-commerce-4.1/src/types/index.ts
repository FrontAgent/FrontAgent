export interface Product {
  id: number;
  title: string;
  price: number;
  description: string;
  category: string;
  image: string;
  rating: {
    rate: number;
    count: number;
  };
}

export interface CartItem extends Product {
  quantity: number;
}

export type Category = 
  | "electronics"
  | "jewelery"
  | "men's clothing"
  | "women's clothing";

export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
  error?: string;
}

export interface SearchParams {
  query?: string;
  category?: Category | string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: "price" | "rating" | "title";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
  total: number;
}

export interface FilterOptions {
  categories: Category[];
  priceRange: {
    min: number;
    max: number;
  };
}

export interface User {
  id: number;
  email: string;
  username: string;
  name: {
    firstname: string;
    lastname: string;
  };
  address?: {
    city: string;
    street: string;
    number: number;
    zipcode: string;
    geolocation: {
      lat: string;
      long: string;
    };
  };
  phone?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface CartState {
  items: CartItem[];
  total: number;
  itemCount: number;
}