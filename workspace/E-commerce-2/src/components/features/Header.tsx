import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { useCartStore } from '../../stores/cartStore';

/**
 * Header component
 * 
 * Displays the application header with navigation links and shopping cart badge.
 * Features:
 * - Brand name/logo
 * - Navigation menu (Home, Cart)
 * - Shopping cart icon with item count badge
 * - Responsive layout using Tailwind CSS
 * 
 * @returns {JSX.Element} The rendered header component
 */
const Header: React.FC = () => {
  const items = useCartStore((state) => state.items);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <header className="bg-white shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <Link 
            to="/" 
            className="flex items-center space-x-2 text-xl sm:text-2xl font-bold text-gray-900 hover:text-blue-600 transition-colors"
          >
            <span>🛍️</span>
            <span className="hidden sm:inline">E-Shop</span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center space-x-4 sm:space-x-8">
            <Link
              to="/"
              className="text-sm sm:text-base font-medium text-gray-700 hover:text-blue-600 transition-colors"
            >
              Home
            </Link>

            {/* Cart Icon with Badge */}
            <Link
              to="/cart"
              className="relative flex items-center text-gray-700 hover:text-blue-600 transition-colors"
              aria-label={`Shopping cart with ${totalItems} items`}
            >
              <ShoppingCart className="w-6 h-6 sm:w-7 sm:h-7" />
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {totalItems > 99 ? '99+' : totalItems}
                </span>
              )}
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;