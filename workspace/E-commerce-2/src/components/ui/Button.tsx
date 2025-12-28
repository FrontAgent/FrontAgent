import React from 'react';

/**
 * Button 组件的属性接口
 * @interface IButtonProps
 * @extends {React.ButtonHTMLAttributes<HTMLButtonElement>}
 */
export interface IButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * 按钮变体样式
   * @type {'primary' | 'secondary' | 'outline' | 'ghost'}
   */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  
  /**
   * 按钮尺寸
   * @type {'sm' | 'md' | 'lg'}
   */
  size?: 'sm' | 'md' | 'lg';
  
  /**
   * 是否显示加载状态
   * @type {boolean}
   */
  isLoading?: boolean;
}

/**
 * 获取按钮变体样式类名
 * @param {IButtonProps['variant']} variant - 按钮变体
 * @returns {string} Tailwind CSS 类名
 */
const getVariantClasses = (variant: IButtonProps['variant'] = 'primary'): string => {
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-300',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 active:bg-gray-800 disabled:bg-gray-300',
    outline: 'bg-transparent border-2 border-blue-600 text-blue-600 hover:bg-blue-50 active:bg-blue-100 disabled:border-blue-300 disabled:text-blue-300',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200 disabled:text-gray-300'
  };
  
  return variants[variant];
};

/**
 * 获取按钮尺寸样式类名
 * @param {IButtonProps['size']} size - 按钮尺寸
 * @returns {string} Tailwind CSS 类名
 */
const getSizeClasses = (size: IButtonProps['size'] = 'md'): string => {
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };
  
  return sizes[size];
};

/**
 * Button 组件
 * 支持多种变体、尺寸和加载状态的按钮组件
 * 
 * @component
 * @example
 * <Button variant="primary" size="md" onClick={handleClick}>
 *   Click Me
 * </Button>
 */
const Button = React.forwardRef<HTMLButtonElement, IButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const baseClasses = 'inline-flex items-center justify-center font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:cursor-not-allowed';
    
    const variantClasses = getVariantClasses(variant);
    const sizeClasses = getSizeClasses(size);
    
    const combinedClasses = `${baseClasses} ${variantClasses} ${sizeClasses} ${className}`.trim();
    
    return (
      <button
        ref={ref}
        className={combinedClasses}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;