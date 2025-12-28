import { create } from 'zustand';
import { productsApi } from '../api/productsApi';

type Product = Awaited<ReturnType<typeof productsApi.list>> extends (infer T)[] ? T : unknown;

export interface ProductsState {
  products: Product[];
  loading: boolean;
  error: string | null;
  fetchProducts: (options?: { force?: boolean }) => Promise<void>;
}

export const useProductsStore = create<ProductsState>((set, get) => ({
  products: [],
  loading: false,
  error: null,

  fetchProducts: async (options) => {
    const force = options?.force ?? false;

    // Cache strategy placeholder: if we already have products, avoid refetch unless forced
    if (!force && get().products.length > 0) return;

    set({ loading: true, error: null });

    try {
      const products = await productsApi.list();
      set({ products: (products ?? []) as Product[], loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ loading: false, error: message });
    }
  },
}));