/**
 * 自定义按钮组件
 * 使用 ant-design 的 Button 组件
 */

import React from 'react';
import { Button as AntButton } from 'antd';

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
  const antdType = type === 'danger' ? 'primary' : type;
  const danger = type === 'danger';

  return (
    <AntButton
      type={antdType}
      danger={danger}
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {children}
    </AntButton>
  );
};