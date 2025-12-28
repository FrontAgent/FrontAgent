import React from 'react';
import { Link } from 'react-router-dom';
import SearchBar from './SearchBar';
import CartIcon from './CartIcon';

const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 bg-white shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex-shrink-0">
            <Link to="/" className="text-2xl font-bold text-blue-600 hover:text-blue-700 transition-colors">
              ShopLogo
            </Link>
          </div>
          
          <div className="flex-1 max-w-2xl mx-8">
            <SearchBar />
          </div>
          
          <div className="flex-shrink-0">
            <CartIcon />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;