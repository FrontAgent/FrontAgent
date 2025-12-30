/**
 * 自定义徽章组件
 * 使用 ant-design 的 Badge 组件
 */

import React from 'react';
import { Badge as AntBadge } from 'antd';

interface BadgeProps {
  count: number;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ count, children }) => {
  return (
    <AntBadge count={count} overflowCount={99}>
      {children}
    </AntBadge>
  );
};