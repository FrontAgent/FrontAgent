import React, { useState } from 'react';
import { Search, ShoppingCart, User, Menu, X } from 'lucide-react';

interface NavbarProps {
  className?: string;
}

/**
 * 导航栏组件
 * 包含搜索、购物车、用户菜单等功能
 */
const Navbar: React.FC<NavbarProps> = ({ className = '' }) => {
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  /**
   * 处理搜索提交
   */
  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    // TODO: 实现搜索功能
    console.log('搜索:', searchQuery);
  };

  /**
   * 切换移动端菜单
   */
  const toggleMobileMenu = (): void => {
    setIsMenuOpen(!isMenuOpen);
  };

  /**
   * 处理购物车点击
   */
  const handleCartClick = (): void => {
    // TODO: 实现购物车功能
  };

  /**
   * 处理用户菜单点击
   */
  const handleUserMenuClick = (): void => {
    // TODO: 实现用户菜单功能
  };

  return (
    <nav className={`bg-white shadow-md border-b border-gray-200 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <h1 className="text-2xl font-bold text-blue-600">
              ECommerce
            </h1>
          </div>

          {/* 搜索栏 - 桌面端 */}
          <div className="hidden md:block flex-1 max-w-lg mx-8">
            <form onSubmit={handleSearchSubmit} className="relative">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>): void => 
                    setSearchQuery(e.target.value)
                  }
                  placeholder="搜索商品..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
            </form>
          </div>

          {/* 右侧菜单 */}
          <div className="flex items-center space-x-4">
            {/* 购物车 */}
            <button
              onClick={handleCartClick}
              className="relative p-2 text-gray-600 hover:text-blue-600 transition-colors"
              aria-label="购物车"
            >
              <ShoppingCart className="h-6 w-6" />
              {/* 购物车数量徽章 */}
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                0
              </span>
            </button>

            {/* 用户菜单 */}
            <button
              onClick={handleUserMenuClick}
              className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
              aria-label="用户菜单"
            >
              <User className="h-6 w-6" />
            </button>

            {/* 移动端菜单按钮 */}
            <button
              onClick={toggleMobileMenu}
              className="md:hidden p-2 text-gray-600 hover:text-blue-600 transition-colors"
              aria-label="菜单"
            >
              {isMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* 移动端搜索栏 */}
        <div className="md:hidden pb-4">
          <form onSubmit={handleSearchSubmit} className="relative">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>): void => 
                  setSearchQuery(e.target.value)
                }
                placeholder="搜索商品..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
          </form>
        </div>

        {/* 移动端菜单 */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-4">
            <div className="flex flex-col space-y-4">
              <a
                href="#"
                className="text-gray-600 hover:text-blue-600 transition-colors"
              >
                首页
              </a>
              <a
                href="#"
                className="text-gray-600 hover:text-blue-600 transition-colors"
              >
                商品分类
              </a>
              <a
                href="#"
                className="text-gray-600 hover:text-blue-600 transition-colors"
              >
                优惠活动
              </a>
              <a
                href="#"
                className="text-gray-600 hover:text-blue-600 transition-colors"
              >
                关于我们
              </a>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;