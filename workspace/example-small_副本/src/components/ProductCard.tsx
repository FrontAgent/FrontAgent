/**
 * 商品卡片组件
 * TODO: 需要将内部使用的自定义组件替换为 ant-design 组件
 */

import React from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { Tag } from './Tag';

interface ProductCardProps {
  id: number;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  tags?: string[];
}

export const ProductCard: React.FC<ProductCardProps> = ({
  name,
  price,
  originalPrice,
  image,
  tags = []
}) => {
  return (
    <Card hoverable>
      {/* 商品图片 */}
      <div className="relative mb-3">
        <img
          src={image}
          alt={name}
          className="w-full h-48 object-cover rounded-md"
        />
        {originalPrice && (
          <div className="absolute top-2 right-2">
            <Tag color="red">特价</Tag>
          </div>
        )}
      </div>

      {/* 商品信息 */}
      <div className="space-y-2">
        <h4 className="text-base font-medium text-gray-800 line-clamp-2 h-12">
          {name}
        </h4>

        {/* 标签 */}
        {tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {tags.map((tag, idx) => (
              <Tag key={idx} color="blue">{tag}</Tag>
            ))}
          </div>
        )}

        {/* 价格 */}
        <div className="flex items-baseline space-x-2">
          <span className="text-xl font-bold text-red-500">¥{price}</span>
          {originalPrice && (
            <span className="text-sm text-gray-400 line-through">¥{originalPrice}</span>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2 mt-3">
          <Button type="primary" className="flex-1">
            加入购物车
          </Button>
          <Button type="default">
            收藏
          </Button>
        </div>
      </div>
    </Card>
  );
};
