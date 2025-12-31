/**
 * 自定义头部组件
 * TODO: 需要替换为 ant-design 的 Layout.Header 组件
 */

import React from 'react';
import { Button } from './Button';
import { Badge } from './Badge';

export const Header: React.FC = () => {
  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-xl">
            E
          </div>
          <span className="text-xl font-bold text-gray-800">E-Shop</span>
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex space-x-6">
          <a href="#" className="text-gray-600 hover:text-blue-500 transition-colors">首页</a>
          <a href="#" className="text-gray-600 hover:text-blue-500 transition-colors">商品分类</a>
          <a href="#" className="text-gray-600 hover:text-blue-500 transition-colors">优惠活动</a>
          <a href="#" className="text-gray-600 hover:text-blue-500 transition-colors">关于我们</a>
        </nav>

        {/* Actions */}
        <div className="flex items-center space-x-4">
          <Badge count={3}>
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </button>
          </Badge>
          <Button type="primary">登录</Button>
        </div>
      </div>
    </header>
  );
};
