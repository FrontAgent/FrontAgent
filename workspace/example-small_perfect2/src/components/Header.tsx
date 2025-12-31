/**
 * 自定义头部组件
 * 使用 ant-design 的 Layout.Header 组件
 */

import React from 'react';
import { Layout, Menu, Button, Badge, Space } from 'antd';
import { ShoppingCartOutlined } from '@ant-design/icons';

const { Header: AntHeader } = Layout;

export const Header: React.FC = () => {
  const menuItems = [
    { key: 'home', label: '首页' },
    { key: 'category', label: '商品分类' },
    { key: 'promotion', label: '优惠活动' },
    { key: 'about', label: '关于我们' },
  ];

  return (
    <AntHeader style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          background: '#1677ff', 
          borderRadius: '8px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          color: '#fff', 
          fontWeight: 'bold', 
          fontSize: '20px' 
        }}>
          E
        </div>
        <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#262626' }}>E-Shop</span>
      </div>

      {/* Navigation */}
      <Menu
        mode="horizontal"
        items={menuItems}
        style={{ flex: 1, minWidth: 0, border: 'none', justifyContent: 'center' }}
      />

      {/* Actions */}
      <Space size="middle">
        <Badge count={3}>
          <Button type="text" icon={<ShoppingCartOutlined style={{ fontSize: '20px' }} />} />
        </Badge>
        <Button type="primary">登录</Button>
      </Space>
    </AntHeader>
  );
};