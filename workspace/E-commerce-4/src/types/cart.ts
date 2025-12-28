import { Product } from './product';

export interface CartItem {
  product: Product;
  quantity: number;
  selected: boolean;
}

export interface Cart {
  items: CartItem[];
  totalAmount: number;
  totalCount: number;
}