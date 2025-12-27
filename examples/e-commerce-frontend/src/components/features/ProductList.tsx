import React, { useState, useMemo } from 'react';
import { useProductStore } from '../../stores/useProductStore';
import { IProduct, IFilterOptions } from '../../types/product';
import { ProductCard } from '../ui/ProductCard';
import { FilterPanel } from '../ui/FilterPanel';
import { Pagination } from '../ui/Pagination';

/**
 * 商品列表展示组件
 * 支持分页和筛选功能
 */
export const ProductList: React.FC = () => {
  const { 
    products, 
    filteredProducts, 
    isLoading, 
    error,
    filters,
    pagination,
    setFilters,
    setCurrentPage,
    setPageSize
  } = useProductStore();

  const [localFilters, setLocalFilters] = useState<IFilterOptions>(filters);

  /**
   * 处理筛选条件变更
   */
  const handleFilterChange = (newFilters: IFilterOptions): void => {
    setLocalFilters(newFilters);
    setFilters(newFilters);
    setCurrentPage(1); // 重置到第一页
  };

  /**
   * 处理分页变更
   */
  const handlePageChange = (page: number): void => {
    setCurrentPage(page);
  };

  /**
   * 处理每页显示数量变更
   */
  const handlePageSizeChange = (pageSize: number): void => {
    setPageSize(pageSize);
    setCurrentPage(1); // 重置到第一页
  };

  /**
   * 计算分页数据
   */
  const paginatedProducts = useMemo(() => {
    const startIndex = (pagination.currentPage - 1) * pagination.pageSize;
    const endIndex = startIndex + pagination.pageSize;
    return filteredProducts.slice(startIndex, endIndex);
  }, [filteredProducts, pagination.currentPage, pagination.pageSize]);

  /**
   * 渲染加载状态
   */
  const renderLoading = (): JSX.Element => (
    <div className="flex justify-center items-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <span className="ml-2 text-gray-600">加载中...</span>
    </div>
  );

  /**
   * 渲染错误状态
   */
  const renderError = (): JSX.Element => (
    <div className="text-center py-12">
      <div className="text-red-600 mb-2">加载失败</div>
      <div className="text-gray-500 text-sm">{error}</div>
    </div>
  );

  /**
   * 渲染空状态
   */
  const renderEmptyState = (): JSX.Element => (
    <div className="text-center py-12">
      <div className="text-gray-500 mb-2">暂无商品数据</div>
      <div className="text-gray-400 text-sm">
        {Object.keys(filters).length > 0 ? '请尝试调整筛选条件' : '请稍后再试'}
      </div>
    </div>
  );

  /**
   * 渲染商品列表
   */
  const renderProductList = (): JSX.Element => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-600">
          共找到 {filteredProducts.length} 件商品
        </div>
        <div className="text-sm text-gray-600">
          第 {pagination.currentPage} 页，共 {Math.ceil(filteredProducts.length / pagination.pageSize)} 页
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {paginatedProducts.map((product: IProduct) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      
      {filteredProducts.length > pagination.pageSize && (
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={Math.ceil(filteredProducts.length / pagination.pageSize)}
          pageSize={pagination.pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </div>
  );

  if (isLoading) {
    return renderLoading();
  }

  if (error) {
    return renderError();
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* 筛选面板 */}
        <div className="lg:w-1/4">
          <FilterPanel
            filters={localFilters}
            onFilterChange={handleFilterChange}
            availableCategories={Array.from(new Set(products.map(p => p.category)))}
            availableBrands={Array.from(new Set(products.map(p => p.brand)))}
          />
        </div>
        
        {/* 商品列表 */}
        <div className="lg:w-3/4">
          {filteredProducts.length === 0 ? renderEmptyState() : renderProductList()}
        </div>
      </div>
    </div>
  );
};

export default ProductList;