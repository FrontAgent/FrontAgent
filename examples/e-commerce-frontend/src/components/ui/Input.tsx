import React, { forwardRef, InputHTMLAttributes } from 'react';

export interface IInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** 输入框大小 */
  size?: 'sm' | 'md' | 'lg';
  /** 验证状态 */
  state?: 'default' | 'error' | 'success';
  /** 前缀图标 */
  prefix?: React.ReactNode;
  /** 后缀图标 */
  suffix?: React.ReactNode;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否只读 */
  readonly?: boolean;
  /** 是否全宽 */
  fullWidth?: boolean;
  /** 错误信息 */
  errorMessage?: string;
  /** 帮助文本 */
  helperText?: string;
  /** 标签 */
  label?: string;
  /** 是否必填 */
  required?: boolean;
}

/**
 * Input 输入框组件
 * 支持不同类型、验证状态、前缀后缀等功能
 */
export const Input = forwardRef<HTMLInputElement, IInputProps>(
  (
    {
      className = '',
      size = 'md',
      state = 'default',
      prefix,
      suffix,
      disabled = false,
      readonly = false,
      fullWidth = false,
      errorMessage,
      helperText,
      label,
      required = false,
      type = 'text',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-5 py-3 text-lg'
    };

    const stateClasses = {
      default: 'border-gray-300 focus:border-blue-500 focus:ring-blue-500',
      error: 'border-red-500 focus:border-red-500 focus:ring-red-500',
      success: 'border-green-500 focus:border-green-500 focus:ring-green-500'
    };

    const baseInputClasses = `
      block w-full rounded-md border bg-white shadow-sm
      transition-colors duration-200 ease-in-out
      focus:outline-none focus:ring-2 focus:ring-opacity-50
      disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
      ${sizeClasses[size]}
      ${stateClasses[state]}
      ${prefix ? 'pl-10' : ''}
      ${suffix ? 'pr-10' : ''}
      ${className}
    `;

    const containerClasses = `
      relative
      ${fullWidth ? 'w-full' : ''}
    `;

    const labelClasses = `
      block text-sm font-medium text-gray-700 mb-1
      ${required ? 'after:content-["*"] after:ml-0.5 after:text-red-500' : ''}
    `;

    const messageClasses = {
      error: 'text-red-600 text-sm mt-1',
      success: 'text-green-600 text-sm mt-1',
      helper: 'text-gray-500 text-sm mt-1'
    };

    return (
      <div className={containerClasses}>
        {label && (
          <label htmlFor={inputId} className={labelClasses}>
            {label}
          </label>
        )}
        <div className="relative">
          {prefix && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">{prefix}</span>
            </div>
          )}
          <input
            ref={ref}
            type={type}
            id={inputId}
            className={baseInputClasses}
            disabled={disabled}
            readOnly={readonly}
            aria-invalid={state === 'error'}
            aria-describedby={
              errorMessage || helperText ? `${inputId}-description` : undefined
            }
            {...props}
          />
          {suffix && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">{suffix}</span>
            </div>
          )}
        </div>
        {errorMessage && (
          <p id={`${inputId}-description`} className={messageClasses.error}>
            {errorMessage}
          </p>
        )}
        {!errorMessage && helperText && (
          <p id={`${inputId}-description`} className={messageClasses.helper}>
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';