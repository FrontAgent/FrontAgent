import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Input size variant
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Input validation state
   */
  state?: 'default' | 'error' | 'success';
  /**
   * Label text
   */
  label?: string;
  /**
   * Helper text
   */
  helperText?: string;
  /**
   * Error message
   */
  errorMessage?: string;
  /**
   * Left icon element
   */
  leftIcon?: React.ReactNode;
  /**
   * Right icon element
   */
  rightIcon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({
  className = '',
  size = 'md',
  state = 'default',
  label,
  helperText,
  errorMessage,
  leftIcon,
  rightIcon,
  disabled,
  ...props
}, ref) => {
  const baseClasses = 'flex w-full rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50';
  
  const sizeClasses = {
    sm: 'h-8 px-2 text-sm',
    md: 'h-10 px-3 text-sm',
    lg: 'h-12 px-4 text-base'
  };
  
  const stateClasses = {
    default: 'border-gray-300 bg-white focus:border-blue-500 focus:ring-blue-500',
    error: 'border-red-500 bg-white focus:border-red-500 focus:ring-red-500',
    success: 'border-green-500 bg-white focus:border-green-500 focus:ring-green-500'
  };
  
  const inputClasses = `${baseClasses} ${sizeClasses[size]} ${stateClasses[state]} ${className}`;
  
  const hasError = state === 'error' && errorMessage;
  const hasHelper = helperText && !hasError;
  
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          className={`${inputClasses} ${leftIcon ? 'pl-10' : ''} ${rightIcon ? 'pr-10' : ''}`}
          disabled={disabled}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            {rightIcon}
          </div>
        )}
      </div>
      {hasError && (
        <p className="mt-1 text-sm text-red-600">
          {errorMessage}
        </p>
      )}
      {hasHelper && (
        <p className="mt-1 text-sm text-gray-500">
          {helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;