/**
 * 电商首页
 * TODO: 需要将所有自定义组件替换为 ant-design 组件
 */

import React from 'react';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { ProductCard } from '../components/ProductCard';
import { Tag } from '../components/Tag';

// 模拟商品数据
const mockProducts = [
  {
    id: 1,
    name: 'iPhone 15 Pro Max 256GB 深空黑色',
    price: 9999,
    originalPrice: 10999,
    image: 'https://via.placeholder.com/300x300/3498db/ffffff?text=iPhone+15',
    tags: ['热销', '新品']
  },
  {
    id: 2,
    name: 'MacBook Pro 14英寸 M3 芯片 银色',
    price: 14999,
    image: 'https://via.placeholder.com/300x300/2ecc71/ffffff?text=MacBook',
    tags: ['推荐']
  },
  {
    id: 3,
    name: 'AirPods Pro 第二代 主动降噪耳机',
    price: 1899,
    originalPrice: 2099,
    image: 'https://via.placeholder.com/300x300/e74c3c/ffffff?text=AirPods',
    tags: ['限时优惠']
  },
  {
    id: 4,
    name: 'iPad Air 11英寸 M2 芯片 深空灰色',
    price: 4799,
    image: 'https://via.placeholder.com/300x300/f39c12/ffffff?text=iPad',
    tags: ['教育优惠']
  }
];

export const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <Header />

      {/* 主要内容 */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Banner 区域 */}
        <Card className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                新春特惠，限时抢购！
              </h1>
              <p className="text-gray-600 mb-4">
                全场 8 折起，满 1000 减 100
              </p>
              <div className="flex gap-2">
                <Tag color="red">限时</Tag>
                <Tag color="orange">热卖</Tag>
              </div>
              <div className="mt-4">
                <Button type="primary">立即抢购</Button>
              </div>
            </div>
            <div className="hidden md:block">
              <img
                src="https://via.placeholder.com/400x200/9b59b6/ffffff?text=Spring+Sale"
                alt="Banner"
                className="rounded-lg"
              />
            </div>
          </div>
        </Card>

        {/* 分类导航 */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">热门分类</h2>
          <div className="flex gap-2 flex-wrap">
            <Button type="primary">全部商品</Button>
            <Button type="default">手机数码</Button>
            <Button type="default">电脑办公</Button>
            <Button type="default">家用电器</Button>
            <Button type="default">服饰鞋包</Button>
            <Button type="default">运动户外</Button>
          </div>
        </div>

        {/* 商品列表 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-800">热销商品</h2>
            <Button type="default">查看更多 →</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {mockProducts.map(product => (
              <ProductCard key={product.id} {...product} />
            ))}
          </div>
        </div>

        {/* 底部信息卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card title="正品保障">
            <p className="text-gray-600">所有商品均为正品，支持验货</p>
          </Card>
          <Card title="极速配送">
            <p className="text-gray-600">当日下单，次日送达</p>
          </Card>
          <Card title="售后无忧">
            <p className="text-gray-600">7天无理由退换货</p>
          </Card>
        </div>
      </main>

      {/* 页脚 */}
      <footer className="bg-gray-800 text-white mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p>© 2024 E-Shop. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};
