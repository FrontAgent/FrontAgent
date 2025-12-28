import React from 'react';
import ProductCard from './ProductCard';
import { IProduct } from '../../types';

/**
 * ProductList 组件属性接口
 */
interface ProductListProps {
  /** 产品数组 */
  products: IProduct[];
  /** 加载状态 */
  isLoading?: boolean;
}

/**
 * ProductList 组件
 * 
 * 用于展示产品列表的组件，使用响应式网格布局
 * - 移动端：1列
 * - 平板：2列
 * - 桌面：3-4列
 * 
 * @param {ProductListProps} props - 组件属性
 * @returns {JSX.Element} 产品列表组件
 */
const ProductList: React.FC<ProductListProps> = ({ products, isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">暂无产品</h3>
          <p className="mt-1 text-sm text-gray-500">目前没有可显示的产品信息</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
};

export default ProductList;