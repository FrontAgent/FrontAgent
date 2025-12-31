/**
 * 标签组件 - 基于 ant-design Tag 组件封装
 */

import React from 'react';
import { Tag as AntTag } from 'antd';

interface TagProps {
  children: React.ReactNode;
  color?: 'blue' | 'green' | 'red' | 'orange';
}

export const Tag: React.FC<TagProps> = ({ children, color = 'blue' }) => {
  return (
    <AntTag color={color}>
      {children}
    </AntTag>
  );
};