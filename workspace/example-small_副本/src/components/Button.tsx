/**
 * 自定义按钮组件
 * TODO: 需要替换为 ant-design 的 Button 组件
 */

import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'primary' | 'default' | 'danger';
  disabled?: boolean;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  type = 'default',
  disabled = false,
  className = ''
}) => {
  const baseStyles = 'px-4 py-2 rounded-md font-medium transition-colors';

  const typeStyles = {
    primary: 'bg-blue-500 text-white hover:bg-blue-600',
    default: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    danger: 'bg-red-500 text-white hover:bg-red-600'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${typeStyles[type]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {children}
    </button>
  );
};
