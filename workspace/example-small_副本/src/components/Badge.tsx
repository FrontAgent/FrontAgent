/**
 * 自定义徽章组件
 * TODO: 需要替换为 ant-design 的 Badge 组件
 */

import React from 'react';

interface BadgeProps {
  count: number;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ count, children }) => {
  return (
    <div className="relative inline-block">
      {children}
      {count > 0 && (
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </div>
  );
};
