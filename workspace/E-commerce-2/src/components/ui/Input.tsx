import React from 'react';

/**
 * Input 组件的属性接口
 * @interface IInputProps
 * @extends {React.InputHTMLAttributes<HTMLInputElement>}
 */
export interface IInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * 输入框标签
   * @type {string}
   * @optional
   */
  label?: string;
  
  /**
   * 错误提示信息
   * @type {string}
   * @optional
   */
  error?: string;
  
  /**
   * 辅助文本
   * @type {string}
   * @optional
   */
  helperText?: string;
}

/**
 * Input 输入框组件
 * 支持标签、错误提示和辅助文本的完整表单控件
 * 
 * @component
 * @example
 * ```tsx
 * <Input 
 *   label="用户名" 
 *   placeholder="请输入用户名"
 *   error="用户名不能为空"
 * />
 * ```
 */
const Input = React.forwardRef<HTMLInputElement, IInputProps>(
  ({ label, error, helperText, className = '', ...props }, ref) => {
    const inputClasses = `
      w-full
      px-3
      py-2
      border
      rounded-md
      outline-none
      transition-colors
      duration-200
      ${error 
        ? 'border-red-500 focus:border-red-600 focus:ring-2 focus:ring-red-200' 
        : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
      }
      ${props.disabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'bg-white'}
      ${className}
    `.trim().replace(/\s+/g, ' ');

    const labelClasses = `
      block
      mb-1
      text-sm
      font-medium
      ${error ? 'text-red-600' : 'text-gray-700'}
    `.trim().replace(/\s+/g, ' ');

    const messageClasses = `
      mt-1
      text-sm
      ${error ? 'text-red-600' : 'text-gray-500'}
    `.trim().replace(/\s+/g, ' ');

    return (
      <div className="w-full">
        {label && (
          <label className={labelClasses}>
            {label}
          </label>
        )}
        
        <input
          ref={ref}
          className={inputClasses}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${props.id}-error` : helperText ? `${props.id}-helper` : undefined
          }
          {...props}
        />
        
        {error && (
          <p 
            id={`${props.id}-error`}
            className={messageClasses}
            role="alert"
          >
            {error}
          </p>
        )}
        
        {!error && helperText && (
          <p 
            id={`${props.id}-helper`}
            className={messageClasses}
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;