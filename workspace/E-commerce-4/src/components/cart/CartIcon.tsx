import React from 'react';
import { useCartStore } from '../../store/cartStore';

interface CartIconProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}

export const CartIcon: React.FC<CartIconProps> = ({
  size = 'md',
  className = '',
  onClick,
}) => {
  const totalItems = useCartStore((state) => state.totalItems);

  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const badgeSizeClasses = {
    sm: 'w-4 h-4 text-xs -top-1 -right-1',
    md: 'w-5 h-5 text-xs -top-2 -right-2',
    lg: 'w-6 h-6 text-sm -top-2 -right-2',
  };

  return (
    <button
      onClick={onClick}
      className={`relative inline-flex items-center justify-center p-2 rounded-full transition-colors duration-200 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${className}`}
      aria-label={`Shopping cart with ${totalItems} items`}
    >
      <svg
        className={`${sizeClasses[size]} text-gray-700 hover:text-blue-600 transition-colors duration-200`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
      {totalItems > 0 && (
        <span
          className={`absolute ${badgeSizeClasses[size]} flex items-center justify-center bg-red-500 text-white font-bold rounded-full animate-pulse`}
        >
          {totalItems > 99 ? '99+' : totalItems}
        </span>
      )}
    </button>
  );
};