import React from 'react';

/**
 * Card component props interface
 */
interface ICardProps {
  /** Card title */
  title?: string;
  /** Card subtitle */
  subtitle?: string;
  /** Card content */
  children: React.ReactNode;
  /** Card footer content */
  footer?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Card variant style */
  variant?: 'default' | 'outlined' | 'elevated';
  /** Click handler */
  onClick?: () => void;
}

/**
 * Card component for displaying product information and content cards
 * @param props - Card component props
 * @returns Card component
 */
export const Card: React.FC<ICardProps> = ({
  title,
  subtitle,
  children,
  footer,
  className = '',
  variant = 'default',
  onClick
}) => {
  const baseClasses = 'rounded-lg p-6 transition-all duration-200';
  
  const variantClasses = {
    default: 'bg-white shadow-sm',
    outlined: 'bg-white border border-gray-200',
    elevated: 'bg-white shadow-lg hover:shadow-xl'
  };

  const clickableClasses = onClick ? 'cursor-pointer hover:scale-[1.02]' : '';

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${clickableClasses} ${className}`}
      onClick={onClick}
    >
      {(title || subtitle) && (
        <div className="mb-4">
          {title && (
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-sm text-gray-600">
              {subtitle}
            </p>
          )}
        </div>
      )}
      
      <div className="text-gray-800">
        {children}
      </div>
      
      {footer && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;