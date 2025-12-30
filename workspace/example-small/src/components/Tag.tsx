/**
 * 自定义标签组件
 * TODO: 需要替换为 ant-design 的 Tag 组件
 */

import React from 'react';

interface TagProps {
  children: React.ReactNode;
  color?: 'blue' | 'green' | 'red' | 'orange';
}

export const Tag: React.FC<TagProps> = ({ children, color = 'blue' }) => {
  const colorStyles = {
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
    orange: 'bg-orange-100 text-orange-800'
  };

  return (
    <span className={`inline-block px-2 py-1 text-xs rounded ${colorStyles[color]}`}>
      {children}
    </span>
  );
};
