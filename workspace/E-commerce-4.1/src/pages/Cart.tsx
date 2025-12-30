import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCartStore } from '../store/cartStore';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';

export const Cart: React.FC = () => {
  const { cartItems, updateQuantity, removeFromCart } = useCartStore();

  const totalPrice = useMemo(() => {
    return cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
  }, [cartItems]);

  const handleQuantityChange = (id: number, newQuantity: number) => {
    if (newQuantity > 0) {
      updateQuantity(id, newQuantity);
    }
  };

  const handleCheckout = () => {
    alert('订单提交成功！感谢您的购买。');
  };

  if (cartItems.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto text-center">
          <ShoppingBag className="w-24 h-24 mx-auto text-gray-300 mb-6" />
          <h2 className="text-2xl font-bold text-gray-800 mb-4">购物车是空的</h2>
          <p className="text-gray-600 mb-8">还没有添加任何商品，快去挑选喜欢的商品吧！</p>
          <Link
            to="/"
            className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            继续购物
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">购物车</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="hidden md:grid md:grid-cols-12 gap-4 bg-gray-50 px-6 py-4 font-semibold text-gray-700 border-b">
              <div className="col-span-5">商品</div>
              <div className="col-span-2 text-center">单价</div>
              <div className="col-span-3 text-center">数量</div>
              <div className="col-span-2 text-right">小计</div>
            </div>

            <div className="divide-y">
              {cartItems.map((item) => (
                <div key={item.id} className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    <div className="col-span-1 md:col-span-5 flex items-center gap-4">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                      <div>
                        <h3 className="font-semibold text-gray-800">{item.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">{item.category}</p>
                      </div>
                    </div>

                    <div className="col-span-1 md:col-span-2 md:text-center">
                      <span className="text-gray-700 font-medium">¥{item.price.toFixed(2)}</span>
                    </div>

                    <div className="col-span-1 md:col-span-3 flex items-center justify-center gap-3">
                      <button
                        onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                        className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 hover:bg-gray-100 transition-colors"
                        aria-label="减少数量"
                      >
                        <Minus className="w-4 h-4 text-gray-600" />
                      </button>
                      <span className="w-12 text-center font-medium text-gray-800">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                        className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 hover:bg-gray-100 transition-colors"
                        aria-label="增加数量"
                      >
                        <Plus className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>

                    <div className="col-span-1 md:col-span-2 flex items-center justify-between md:justify-end gap-4">
                      <span className="text-lg font-bold text-gray-800">
                        ¥{(item.price * item.quantity).toFixed(2)}
                      </span>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                        aria-label="删除商品"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
            <h2 className="text-xl font-bold text-gray-800 mb-6">订单摘要</h2>

            <div className="space-y-4 mb-6">
              <div className="flex justify-between text-gray-600">
                <span>商品数量</span>
                <span>{cartItems.reduce((sum, item) => sum + item.quantity, 0)} 件</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>小计</span>
                <span>¥{totalPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>运费</span>
                <span className="text-green-600">免费</span>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-800">总计</span>
                  <span className="text-2xl font-bold text-blue-600">
                    ¥{totalPrice.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              去结算
            </button>

            <Link
              to="/"
              className="block text-center text-blue-600 hover:text-blue-700 mt-4 transition-colors"
            >
              继续购物
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};