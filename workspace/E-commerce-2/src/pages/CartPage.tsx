import React from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import CartItem from '../components/CartItem';
import CartSummary from '../components/CartSummary';
import { useCartStore } from '../stores/cartStore';

/**
 * CartPage 组件
 * 
 * 购物车页面，展示用户添加到购物车的商品列表和订单摘要。
 * 
 * 功能：
 * - 从 zustand store 获取购物车数据
 * - 渲染商品列表和订单摘要
 * - 响应式布局（移动端垂直堆叠，桌面端左右分栏）
 * - 处理空购物车状态
 * 
 * @returns {JSX.Element} 购物车页面组件
 */
const CartPage: React.FC = () => {
  const { items } = useCartStore();

  const isEmpty = items.length === 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">购物车</h1>

        {isEmpty ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="max-w-md mx-auto">
              <svg
                className="mx-auto h-24 w-24 text-gray-400 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                购物车是空的
              </h2>
              <p className="text-gray-600 mb-6">
                您还没有添加任何商品到购物车
              </p>
              <Link
                to="/"
                className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                继续购物
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-sm">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">
                    商品列表 ({items.length} 件商品)
                  </h2>
                </div>
                <div className="divide-y divide-gray-200">
                  {items.map((item) => (
                    <CartItem key={item.id} item={item} />
                  ))}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <Link
                  to="/"
                  className="text-blue-600 hover:text-blue-700 font-medium flex items-center"
                >
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  继续购物
                </Link>
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="sticky top-8">
                <CartSummary />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default CartPage;