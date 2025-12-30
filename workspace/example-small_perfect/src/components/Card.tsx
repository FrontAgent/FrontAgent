/**
 * 自定义卡片组件
 * TODO: 需要替换为 ant-design 的 Card 组件
 */

import React from 'react';
import { Card as AntCard } from 'antd';

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
    <AntCard
      title={title}
      hoverable={hoverable}
      className={className}
    >
      {children}
    </AntCard>
  );
};