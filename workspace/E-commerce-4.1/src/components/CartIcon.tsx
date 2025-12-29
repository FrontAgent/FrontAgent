import React from 'react';

interface CartIconProps {
  count: number;
  onClick: () => void;
}

export const CartIcon: React.FC<CartIconProps> = ({ count, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="relative p-2 hover:bg-gray-100 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
      aria-label={`购物车，${count}件商品`}
    >
      <svg
        className="w-6 h-6 text-gray-700"
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
      {count > 0 && (
        <span
          className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse"
          style={{
            animation: 'pulse 0.5s ease-in-out',
          }}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
};