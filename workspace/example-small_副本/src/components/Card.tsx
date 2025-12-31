/**
 * 自定义卡片组件
 * TODO: 需要替换为 ant-design 的 Card 组件
 */

import React from 'react';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  hoverable?: boolean;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  title,
  children,
  hoverable = false,
  className = ''
}) => {
  return (
    <div
      className={`
        bg-white rounded-lg shadow-md p-4
        ${hoverable ? 'hover:shadow-lg transition-shadow cursor-pointer' : ''}
        ${className}
      `}
    >
      {title && (
        <h3 className="text-lg font-semibold mb-3 border-b pb-2">
          {title}
        </h3>
      )}
      <div>{children}</div>
    </div>
  );
};
