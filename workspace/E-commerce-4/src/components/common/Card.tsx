import React from 'react';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({ title, children, className = '', onClick }) => {
  return (
    <div
      className={`bg-white rounded-lg shadow-md p-6 ${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''} ${className}`}
      onClick={onClick}
    >
      {title && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        </div>
      )}
      <div className="text-gray-600">{children}</div>
    </div>
  );
};

export default Card;