/**
 * 自定义标签组件
 * 使用 ant-design 的 Tag 组件
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