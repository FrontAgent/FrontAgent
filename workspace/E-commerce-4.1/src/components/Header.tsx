import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useCartStore } from '../store/cartStore';

export const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const items = useCartStore((state) => state.items);
  
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <header className="sticky top-0 z-50 bg-white shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex-shrink-0">
            <Link to="/" className="text-2xl font-bold text-blue-600 hover:text-blue-700 transition-colors">
              ShopHub
            </Link>
          </div>

          <nav className="hidden md:flex items-center space-x-8">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `text-gray-700 hover:text-blue-600 transition-colors font-medium ${
                  isActive ? 'text-blue-600 border-b-2 border-blue-600' : ''
                }`
              }
            >
              首页
            </NavLink>
            <NavLink
              to="/products"
              className={({ isActive }) =>
                `text-gray-700 hover:text-blue-600 transition-colors font-medium ${
                  isActive ? 'text-blue-600 border-b-2 border-blue-600' : ''
                }`
              }
            >
              商品列表
            </NavLink>
          </nav>

          <div className="flex items-center space-x-4">
            <Link
              to="/cart"
              className="relative p-2 text-gray-700 hover:text-blue-600 transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </Link>

            <button
              className="md:hidden p-2 text-gray-700 hover:text-blue-600 transition-colors"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <nav className="flex flex-col space-y-4">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `text-gray-700 hover:text-blue-600 transition-colors font-medium px-2 py-1 ${
                    isActive ? 'text-blue-600 bg-blue-50 rounded' : ''
                  }`
                }
                onClick={() => setIsMenuOpen(false)}
              >
                首页
              </NavLink>
              <NavLink
                to="/products"
                className={({ isActive }) =>
                  `text-gray-700 hover:text-blue-600 transition-colors font-medium px-2 py-1 ${
                    isActive ? 'text-blue-600 bg-blue-50 rounded' : ''
                  }`
                }
                onClick={() => setIsMenuOpen(false)}
              >
                商品列表
              </NavLink>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};