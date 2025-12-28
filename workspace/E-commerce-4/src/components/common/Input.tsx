import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className = '', disabled, ...props }, ref) => {
    const baseInputStyles = 'w-full px-3 py-2 border rounded-lg transition-colors duration-200 outline-none';
    
    const stateStyles = error
      ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-200'
      : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200';
    
    const disabledStyles = disabled
      ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
      : 'bg-white';
    
    const iconPaddingLeft = leftIcon ? 'pl-10' : '';
    const iconPaddingRight = rightIcon ? 'pr-10' : '';

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            disabled={disabled}
            className={`${baseInputStyles} ${stateStyles} ${disabledStyles} ${iconPaddingLeft} ${iconPaddingRight} ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1 text-sm text-red-500">{error}</p>
        )}
        {!error && helperText && (
          <p className="mt-1 text-sm text-gray-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;