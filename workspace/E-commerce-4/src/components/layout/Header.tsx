import React, { useState } from 'react';

export interface HeaderProps {
  logo?: React.ReactNode;
  className?: string;
  sticky?: boolean;
  onLoginClick?: () => void;
  isLoggedIn?: boolean;
  userAvatar?: string;
  userName?: string;
  onLogoutClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  logo = 'Logo',
  className = '',
  sticky = true,
  onLoginClick,
  isLoggedIn = false,
  userAvatar,
  userName,
  onLogoutClick,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const positionClass = sticky ? 'sticky top-0' : 'relative';

  return (
    <header
      className={`${positionClass} z-50 bg-white shadow-sm border-b border-gray-200 ${className}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo区域 - 左侧 */}
          <div className="flex-shrink-0">
            <div className="text-xl font-bold text-gray-900">
              {logo}
            </div>
          </div>

          {/* 导航区域 - 中间 (桌面端) */}
          <div className="hidden md:flex flex-1 justify-center px-8">
            <nav className="flex space-x-8">
              <a href="/" className="text-gray-600 hover:text-gray-900">首页</a>
              <a href="/products" className="text-gray-600 hover:text-gray-900">商品</a>
              <a href="/cart" className="text-gray-600 hover:text-gray-900">购物车</a>
            </nav>
          </div>

          {/* 用户操作区域 - 右侧 */}
          <div className="flex items-center space-x-4">
            {/* 桌面端用户区域 */}
            <div className="hidden md:flex items-center space-x-4">
              {isLoggedIn ? (
                <div className="relative">
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center space-x-2 focus:outline-none"
                  >
                    {userAvatar ? (
                      <img
                        src={userAvatar}
                        alt={userName || 'User'}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
                        {userName?.charAt(0).toUpperCase() || 'U'}
                      </div>
                    )}
                    <span className="text-gray-700 text-sm">{userName}</span>
                    <svg
                      className={`w-4 h-4 text-gray-500 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onLogoutClick?.();
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        退出登录
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={onLoginClick}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  登录
                </button>
              )}
            </div>

            {/* 移动端汉堡菜单按钮 */}
            <button
              onClick={toggleMobileMenu}
              className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              aria-expanded={isMobileMenuOpen}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 移动端菜单 */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="px-4 py-4">
            <nav className="flex flex-col space-y-2">
              <a href="/" className="text-gray-600 hover:text-gray-900 py-2">首页</a>
              <a href="/products" className="text-gray-600 hover:text-gray-900 py-2">商品</a>
              <a href="/cart" className="text-gray-600 hover:text-gray-900 py-2">购物车</a>
            </nav>
          </div>
          
          <div className="px-4 py-4 border-t border-gray-200">
            {isLoggedIn ? (
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  {userAvatar ? (
                    <img
                      src={userAvatar}
                      alt={userName || 'User'}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                      {userName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                  <span className="text-gray-900 font-medium">{userName}</span>
                </div>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onLogoutClick?.();
                  }}
                  className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  退出登录
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onLoginClick?.();
                }}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                登录
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};