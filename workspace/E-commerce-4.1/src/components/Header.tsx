import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import SearchBar from './SearchBar';
import CartIcon from './CartIcon';

const Header: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <header className="sticky top-0 z-50 bg-white shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">E</span>
              </div>
              <span className="text-xl font-bold text-gray-800 hidden sm:block">
                E-Shop
              </span>
            </Link>

            <nav className="hidden md:flex items-center space-x-6">
              <Link
                to="/"
                className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
              >
                首页
              </Link>
              <Link
                to="/products"
                className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
              >
                商品列表
              </Link>
              <Link
                to="/categories"
                className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
              >
                分类
              </Link>
              <Link
                to="/about"
                className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
              >
                关于我们
              </Link>
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden lg:block w-64">
              <SearchBar />
            </div>

            <CartIcon />

            <button
              onClick={toggleMobileMenu}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Toggle menu"
            >
              <svg
                className="w-6 h-6 text-gray-700"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {isMobileMenuOpen ? (
                  <path d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <div className="mb-4 lg:hidden">
              <SearchBar />
            </div>
            <nav className="flex flex-col space-y-3">
              <Link
                to="/"
                className="text-gray-700 hover:text-blue-600 font-medium py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                首页
              </Link>
              <Link
                to="/products"
                className="text-gray-700 hover:text-blue-600 font-medium py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                商品列表
              </Link>
              <Link
                to="/categories"
                className="text-gray-700 hover:text-blue-600 font-medium py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                分类
              </Link>
              <Link
                to="/about"
                className="text-gray-700 hover:text-blue-600 font-medium py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                关于我们
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;