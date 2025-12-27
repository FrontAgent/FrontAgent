import React from 'react';

/**
 * Card component props interface
 */
interface ICardProps {
  /** Card title */
  title?: string;
  /** Card content */
  children: React.ReactNode;
  /** Card actions area */
  actions?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Card variant style */
  variant?: 'default' | 'outlined' | 'elevated';
  /** Card padding size */
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

/**
 * Card component for displaying content blocks
 * @param props - Card component props
 * @returns Card JSX element
 */
export const Card: React.FC<ICardProps> = ({
  title,
  children,
  actions,
  className = '',
  variant = 'default',
  padding = 'md'
}) => {
  const baseClasses = 'rounded-lg transition-all duration-200';
  
  const variantClasses = {
    default: 'bg-white border border-gray-200',
    outlined: 'bg-white border-2 border-gray-300',
    elevated: 'bg-white shadow-lg hover:shadow-xl'
  };
  
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-6',
    lg: 'p-8'
  };
  
  const cardClasses = [
    baseClasses,
    variantClasses[variant],
    paddingClasses[padding],
    className
  ].filter(Boolean).join(' ');
  
  return (
    <div className={cardClasses}>
      {title && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {title}
          </h3>
        </div>
      )}
      
      <div className="text-gray-700">
        {children}
      </div>
      
      {actions && (
        <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end gap-2">
          {actions}
        </div>
      )}
    </div>
  );
};

export default Card;