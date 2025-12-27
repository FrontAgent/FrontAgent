import React from 'react';
import { ShoppingCart, Plus, Minus, Trash2, CreditCard } from 'lucide-react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  stock: number;
}

interface CartStore {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getTotalPrice: () => number;
  getTotalItems: () => number;
}

const useCartStore = (): CartStore => {
  const [items, setItems] = React.useState<CartItem[]>([]);

  const addItem = React.useCallback((item: Omit<CartItem, 'quantity'>) => {
    setItems(currentItems => {
      const existingItem = currentItems.find(i => i.id === item.id);
      if (existingItem) {
        return currentItems.map(i =>
          i.id === item.id
            ? { ...i, quantity: Math.min(i.quantity + 1, i.stock) }
            : i
        );
      }
      return [...currentItems, { ...item, quantity: 1 }];
    });
  }, []);

  const removeItem = React.useCallback((id: string) => {
    setItems(currentItems => currentItems.filter(item => item.id !== id));
  }, []);

  const updateQuantity = React.useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id);
      return;
    }
    setItems(currentItems =>
      currentItems.map(item =>
        item.id === id
          ? { ...item, quantity: Math.min(quantity, item.stock) }
          : item
      )
    );
  }, [removeItem]);

  const clearCart = React.useCallback(() => {
    setItems([]);
  }, []);

  const getTotalPrice = React.useCallback(() => {
    return items.reduce((total, item) => total + item.price * item.quantity, 0);
  }, [items]);

  const getTotalItems = React.useCallback(() => {
    return items.reduce((total, item) => total + item.quantity, 0);
  }, [items]);

  return {
    items,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    getTotalPrice,
    getTotalItems,
  };
};

const CartItemComponent: React.FC<{
  item: CartItem;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
}> = ({ item, onUpdateQuantity, onRemove }) => {
  const handleQuantityChange = (newQuantity: number) => {
    onUpdateQuantity(item.id, newQuantity);
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-lg shadow-sm border">
      <img
        src={item.image}
        alt={item.name}
        className="w-16 h-16 object-cover rounded-md"
      />
      
      <div className="flex-1">
        <h3 className="font-medium text-gray-900">{item.name}</h3>
        <p className="text-sm text-gray-500">库存: {item.stock}</p>
        <p className="text-lg font-semibold text-blue-600">¥{item.price}</p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => handleQuantityChange(item.quantity - 1)}
          disabled={item.quantity <= 1}
          className="p-1 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Minus className="w-4 h-4" />
        </button>
        
        <span className="w-12 text-center font-medium">{item.quantity}</span>
        
        <button
          onClick={() => handleQuantityChange(item.quantity + 1)}
          disabled={item.quantity >= item.stock}
          className="p-1 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="text-right">
        <p className="font-semibold text-gray-900">
          ¥{(item.price * item.quantity).toFixed(2)}
        </p>
      </div>

      <button
        onClick={() => onRemove(item.id)}
        className="p-2 text-red-500 hover:bg-red-50 rounded-md"
      >
        <Trash2 className="w-5 h-5" />
      </button>
    </div>
  );
};

const CartSummary: React.FC<{
  totalItems: number;
  totalPrice: number;
  onCheckout: () => void;
  onClearCart: () => void;
}> = ({ totalItems, totalPrice, onCheckout, onClearCart }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h2 className="text-xl font-semibold mb-4">订单摘要</h2>
      
      <div className="space-y-2 mb-4">
        <div className="flex justify-between">
          <span>商品数量:</span>
          <span className="font-medium">{totalItems} 件</span>
        </div>
        <div className="flex justify-between">
          <span>商品总价:</span>
          <span className="font-medium">¥{totalPrice.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>运费:</span>
          <span className="font-medium text-green-600">免费</span>
        </div>
        <hr className="my-2" />
        <div className="flex justify-between text-lg font-semibold">
          <span>总计:</span>
          <span className="text-blue-600">¥{totalPrice.toFixed(2)}</span>
        </div>
      </div>

      <div className="space-y-2">
        <button
          onClick={onCheckout}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <CreditCard className="w-5 h-5" />
          立即结算
        </button>
        
        <button
          onClick={onClearCart}
          className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200 transition-colors"
        >
          清空购物车
        </button>
      </div>
    </div>
  );
};

const EmptyCart: React.FC = () => {
  return (
    <div className="text-center py-12">
      <ShoppingCart className="w-24 h-24 text-gray-300 mx-auto mb-4" />
      <h2 className="text-2xl font-semibold text-gray-600 mb-2">购物车为空</h2>
      <p className="text-gray-500">快去挑选你喜欢的商品吧！</p>
    </div>
  );
};

export const CartPage: React.FC = () => {
  const {
    items,
    removeItem,
    updateQuantity,
    clearCart,
    getTotalPrice,
    getTotalItems,
  } = useCartStore();

  const totalPrice = getTotalPrice();
  const totalItems = getTotalItems();

  const handleCheckout = () => {
    if (items.length === 0) {
      alert('购物车为空，无法结算');
      return;
    }
    
    // 这里可以集成实际的结算逻辑
    alert(`结算成功！总金额: ¥${totalPrice.toFixed(2)}`);
    clearCart();
  };

  const handleClearCart = () => {
    if (window.confirm('确定要清空购物车吗？')) {
      clearCart();
    }
  };

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">购物车</h1>
        <EmptyCart />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <ShoppingCart className="w-8 h-8 text-blue-600" />
        <h1 className="text-3xl font-bold">购物车</h1>
        <span className="text-gray-500">({totalItems} 件商品)</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {items.map(item => (
            <CartItemComponent
              key={item.id}
              item={item}
              onUpdateQuantity={updateQuantity}
              onRemove={removeItem}
            />
          ))}
        </div>

        <div className="lg:col-span-1">
          <CartSummary
            totalItems={totalItems}
            totalPrice={totalPrice}
            onCheckout={handleCheckout}
            onClearCart={handleClearCart}
          />
        </div>
      </div>
    </div>
  );
};

export default CartPage;