import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * 商品接口定义
 */
export interface IProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  stock: number;
  rating: number;
  reviews: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 购物车商品项接口定义
 */
export interface ICartItem {
  productId: string;
  quantity: number;
  addedAt: Date;
}

/**
 * 商品状态管理Store接口定义
 */
interface IProductStore {
  // 状态
  products: IProduct[];
  cart: ICartItem[];
  loading: boolean;
  error: string | null;

  // 商品相关操作
  setProducts: (products: IProduct[]) => void;
  addProduct: (product: Omit<IProduct, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateProduct: (id: string, updates: Partial<IProduct>) => void;
  removeProduct: (id: string) => void;
  getProductById: (id: string) => IProduct | undefined;

  // 购物车相关操作
  addToCart: (productId: string, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getCartItems: () => Array<ICartItem & { product: IProduct }>;
  getCartTotal: () => number;
  getCartItemCount: () => number;

  // 工具方法
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

/**
 * 生成唯一ID
 */
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * 创建商品状态管理Store
 */
export const useProductStore = create<IProductStore>()(
  devtools(
    (set, get) => ({
      // 初始状态
      products: [],
      cart: [],
      loading: false,
      error: null,

      // 商品相关操作
      setProducts: (products: IProduct[]) => {
        set({ products }, false, 'setProducts');
      },

      addProduct: (productData) => {
        const newProduct: IProduct = {
          ...productData,
          id: generateId(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        set(
          (state) => ({
            products: [...state.products, newProduct],
          }),
          false,
          'addProduct'
        );
      },

      updateProduct: (id: string, updates: Partial<IProduct>) => {
        set(
          (state) => ({
            products: state.products.map((product) =>
              product.id === id
                ? { ...product, ...updates, updatedAt: new Date() }
                : product
            ),
          }),
          false,
          'updateProduct'
        );
      },

      removeProduct: (id: string) => {
        set(
          (state) => ({
            products: state.products.filter((product) => product.id !== id),
            cart: state.cart.filter((item) => item.productId !== id),
          }),
          false,
          'removeProduct'
        );
      },

      getProductById: (id: string) => {
        return get().products.find((product) => product.id === id);
      },

      // 购物车相关操作
      addToCart: (productId: string, quantity = 1) => {
        const { products, cart } = get();
        const product = products.find((p) => p.id === productId);

        if (!product) {
          set({ error: 'Product not found' }, false, 'addToCart');
          return;
        }

        if (product.stock < quantity) {
          set({ error: 'Insufficient stock' }, false, 'addToCart');
          return;
        }

        const existingItem = cart.find((item) => item.productId === productId);

        if (existingItem) {
          const newQuantity = existingItem.quantity + quantity;
          
          if (product.stock < newQuantity) {
            set({ error: 'Insufficient stock' }, false, 'addToCart');
            return;
          }

          set(
            (state) => ({
              cart: state.cart.map((item) =>
                item.productId === productId
                  ? { ...item, quantity: newQuantity }
                  : item
              ),
              error: null,
            }),
            false,
            'addToCart'
          );
        } else {
          set(
            (state) => ({
              cart: [
                ...state.cart,
                {
                  productId,
                  quantity,
                  addedAt: new Date(),
                },
              ],
              error: null,
            }),
            false,
            'addToCart'
          );
        }
      },

      removeFromCart: (productId: string) => {
        set(
          (state) => ({
            cart: state.cart.filter((item) => item.productId !== productId),
          }),
          false,
          'removeFromCart'
        );
      },

      updateCartQuantity: (productId: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeFromCart(productId);
          return;
        }

        const { products, cart } = get();
        const product = products.find((p) => p.id === productId);
        const cartItem = cart.find((item) => item.productId === productId);

        if (!product || !cartItem) {
          return;
        }

        if (product.stock < quantity) {
          set({ error: 'Insufficient stock' }, false, 'updateCartQuantity');
          return;
        }

        set(
          (state) => ({
            cart: state.cart.map((item) =>
              item.productId === productId
                ? { ...item, quantity }
                : item
            ),
            error: null,
          }),
          false,
          'updateCartQuantity'
        );
      },

      clearCart: () => {
        set({ cart: [] }, false, 'clearCart');
      },

      getCartItems: () => {
        const { cart, products } = get();
        
        return cart
          .map((item) => {
            const product = products.find((p) => p.id === item.productId);
            return product ? { ...item, product } : null;
          })
          .filter((item): item is ICartItem & { product: IProduct } => 
            item !== null
          );
      },

      getCartTotal: () => {
        const cartItems = get().getCartItems();
        
        return cartItems.reduce((total, item) => {
          return total + (item.product.price * item.quantity);
        }, 0);
      },

      getCartItemCount: () => {
        return get().cart.reduce((count, item) => count + item.quantity, 0);
      },

      // 工具方法
      setLoading: (loading: boolean) => {
        set({ loading }, false, 'setLoading');
      },

      setError: (error: string | null) => {
        set({ error }, false, 'setError');
      },

      clearError: () => {
        set({ error: null }, false, 'clearError');
      },
    }),
    {
      name: 'product-store',
    }
  )
);