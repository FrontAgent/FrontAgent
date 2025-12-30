import { create } from 'zustand';

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

interface ProductState {
  products: Product[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  selectedCategory: string;
  fetchProducts: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string) => void;
  filteredProducts: () => Product[];
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  loading: false,
  error: null,
  searchQuery: '',
  selectedCategory: '',

  fetchProducts: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch('https://fakestoreapi.com/products');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: Product[] = await response.json();
      set({ products: data, loading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch products';
      set({ error: errorMessage, loading: false });
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  setSelectedCategory: (category: string) => {
    set({ selectedCategory: category });
  },

  filteredProducts: () => {
    const { products, searchQuery, selectedCategory } = get();
    
    return products.filter((product) => {
      const matchesSearch = searchQuery === '' || 
        product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory === '' || 
        product.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  },
}));