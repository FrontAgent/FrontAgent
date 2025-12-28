import React from 'react';
import { Link } from 'react-router-dom';
import { useCartStore } from '../store/cartStore';

export const CartIcon: React.FC = () => {
  const items = useCartStore((state) => state.items);
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Link to="/cart" className="relative cursor-pointer hover:text-blue-600 transition-colors">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
      {totalQuantity > 0 && (
        <span className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
          {totalQuantity}
        </span>
      )}
    </Link>
  );
};