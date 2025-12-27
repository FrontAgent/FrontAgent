import React, { forwardRef } from 'react';

interface IInputProps {
  /** 输入框类型 */
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';
  /** 输入框值 */
  value?: string | number;
  /** 默认值 */
  defaultValue?: string | number;
  /** 占位符文本 */
  placeholder?: string;
  /** 标签文本 */
  label?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否只读 */
  readOnly?: boolean;
  /** 是否必填 */
  required?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 输入框名称 */
  name?: string;
  /** 验证函数 */
  validate?: (value: string | number) => string | null;
  /** 错误消息 */
  error?: string;
  /** 输入事件处理函数 */
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** 焦点事件处理函数 */
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  /** 失焦事件处理函数 */
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  /** 键盘事件处理函数 */
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  /** 输入框尺寸 */
  size?: 'sm' | 'md' | 'lg';
  /** 是否显示清除按钮 */
  showClearButton?: boolean;
  /** 清除按钮点击事件 */
  onClear?: () => void;
}

/**
 * 输入框组件
 * 支持不同类型、验证、错误状态等功能
 */
export const Input = forwardRef<HTMLInputElement, IInputProps>(({
  type = 'text',
  value,
  defaultValue,
  placeholder,
  label,
  disabled = false,
  readOnly = false,
  required = false,
  className = '',
  name,
  validate,
  error,
  onChange,
  onFocus,
  onBlur,
  onKeyDown,
  size = 'md',
  showClearButton = false,
  onClear,
}, ref) => {
  const [internalValue, setInternalValue] = React.useState<string | number>(
    defaultValue || ''
  );
  const [internalError, setInternalError] = React.useState<string>('');
  const [isFocused, setIsFocused] = React.useState<boolean>(false);

  const currentValue = value !== undefined ? value : internalValue;

  /**
   * 处理输入变化
   */
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = type === 'number' ? Number(event.target.value) : event.target.value;
    
    if (value === undefined) {
      setInternalValue(newValue);
    }

    if (validate) {
      const validationError = validate(newValue);
      setInternalError(validationError || '');
    }

    onChange?.(event);
  };

  /**
   * 处理焦点事件
   */
  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    onFocus?.(event);
  };

  /**
   * 处理失焦事件
   */
  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    
    if (validate && currentValue !== undefined) {
      const validationError = validate(currentValue);
      setInternalError(validationError || '');
    }

    onBlur?.(event);
  };

  /**
   * 处理清除按钮点击
   */
  const handleClear = () => {
    if (value === undefined) {
      setInternalValue('');
    }
    setInternalError('');
    onClear?.();
  };

  /**
   * 获取输入框尺寸样式
   */
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-1.5 text-sm';
      case 'lg':
        return 'px-4 py-3 text-lg';
      default:
        return 'px-3 py-2 text-base';
    }
  };

  /**
   * 获取输入框状态样式
   */
  const getInputClasses = () => {
    const baseClasses = `
      w-full rounded-md border transition-colors duration-200
      focus:outline-none focus:ring-2 focus:ring-offset-1
      disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
      ${getSizeClasses()}
    `;

    if (disabled) {
      return `${baseClasses} bg-gray-50 border-gray-200 text-gray-500`;
    }

    if (internalError || error) {
      return `${baseClasses} border-red-300 focus:border-red-500 focus:ring-red-200 text-red-900 placeholder-red-300`;
    }

    if (isFocused) {
      return `${baseClasses} border-blue-500 focus:border-blue-500 focus:ring-blue-200`;
    }

    return `${baseClasses} border-gray-300 hover:border-gray-400 focus:border-blue-500`;
  };

  const displayError = internalError || error;

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label 
          htmlFor={name}
          className={`
            block text-sm font-medium mb-1
            ${disabled ? 'text-gray-400' : 'text-gray-700'}
            ${required ? 'after:content-["*"] after:ml-0.5 after:text-red-500' : ''}
          `}
        >
          {label}
        </label>
      )}
      
      <div className="relative">
        <input
          ref={ref}
          type={type}
          name={name}
          value={currentValue}
          defaultValue={defaultValue}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={onKeyDown}
          className={getInputClasses()}
          aria-invalid={displayError ? 'true' : 'false'}
          aria-describedby={displayError ? `${name}-error` : undefined}
        />
        
        {showClearButton && currentValue && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="
              absolute right-3 top-1/2 transform -translate-y-1/2
              text-gray-400 hover:text-gray-600 focus:outline-none
              transition-colors duration-200
            "
            aria-label="清除输入"
          >
            <svg 
              className="w-4 h-4" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M6 18L18 6M6 6l12 12" 
              />
            </svg>
          </button>
        )}
      </div>
      
      {displayError && (
        <p 
          id={`${name}-error`}
          className="mt-1 text-sm text-red-600"
          role="alert"
        >
          {displayError}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';