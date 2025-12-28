export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  stock: number;
  rating?: number;
  reviews?: number;
}

export type ProductCategory = 
  | 'electronics' 
  | 'clothing' 
  | 'food' 
  | 'books' 
  | 'home' 
  | 'sports';