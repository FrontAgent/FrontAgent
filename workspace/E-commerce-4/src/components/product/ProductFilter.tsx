import React, { useState, useCallback, useMemo } from 'react';

export interface FilterOptions {
  categories: string[];
  priceRange: { min: number; max: number };
  brands: string[];
  sortBy: 'price-asc' | 'price-desc' | 'sales' | 'rating' | 'newest';
}

export interface ProductFilterProps {
  availableCategories?: string[];
  availableBrands?: string[];
  maxPrice?: number;
  value?: Partial<FilterOptions>;
  onChange?: (filters: FilterOptions) => void;
  onReset?: () => void;
  className?: string;
}

const defaultCategories = ['电子产品', '服装', '家居', '食品', '美妆', '运动'];
const defaultBrands = ['品牌A', '品牌B', '品牌C', '品牌D', '品牌E'];

const sortOptions = [
  { value: 'newest', label: '最新上架' },
  { value: 'price-asc', label: '价格从低到高' },
  { value: 'price-desc', label: '价格从高到低' },
  { value: 'sales', label: '销量优先' },
  { value: 'rating', label: '评分优先' },
] as const;

const defaultFilters: FilterOptions = {
  categories: [],
  priceRange: { min: 0, max: 10000 },
  brands: [],
  sortBy: 'newest',
};

export const ProductFilter: React.FC<ProductFilterProps> = ({
  availableCategories = defaultCategories,
  availableBrands = defaultBrands,
  maxPrice = 10000,
  value,
  onChange,
  onReset,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [internalFilters, setInternalFilters] = useState<FilterOptions>(defaultFilters);

  const filters = useMemo(() => ({
    ...defaultFilters,
    ...value,
    priceRange: {
      min: value?.priceRange?.min ?? 0,
      max: value?.priceRange?.max ?? maxPrice,
    },
  }), [value, maxPrice]);

  const currentFilters = value !== undefined ? filters : internalFilters;

  const updateFilters = useCallback((updates: Partial<FilterOptions>) => {
    const newFilters = { ...currentFilters, ...updates };
    if (value === undefined) {
      setInternalFilters(newFilters);
    }
    onChange?.(newFilters);
  }, [currentFilters, value, onChange]);

  const handleCategoryToggle = useCallback((category: string) => {
    const newCategories = currentFilters.categories.includes(category)
      ? currentFilters.categories.filter(c => c !== category)
      : [...currentFilters.categories, category];
    updateFilters({ categories: newCategories });
  }, [currentFilters.categories, updateFilters]);

  const handleBrandToggle = useCallback((brand: string) => {
    const newBrands = currentFilters.brands.includes(brand)
      ? currentFilters.brands.filter(b => b !== brand)
      : [...currentFilters.brands, brand];
    updateFilters({ brands: newBrands });
  }, [currentFilters.brands, updateFilters]);

  const handlePriceChange = useCallback((type: 'min' | 'max', value: string) => {
    const numValue = Math.max(0, Math.min(maxPrice, parseInt(value) || 0));
    updateFilters({
      priceRange: {
        ...currentFilters.priceRange,
        [type]: numValue,
      },
    });
  }, [currentFilters.priceRange, maxPrice, updateFilters]);

  const handleSortChange = useCallback((sortBy: FilterOptions['sortBy']) => {
    updateFilters({ sortBy });
  }, [updateFilters]);

  const handleReset = useCallback(() => {
    const resetFilters = { ...defaultFilters, priceRange: { min: 0, max: maxPrice } };
    if (value === undefined) {
      setInternalFilters(resetFilters);
    }
    onChange?.(resetFilters);
    onReset?.();
  }, [value, maxPrice, onChange, onReset]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (currentFilters.categories.length > 0) count++;
    if (currentFilters.brands.length > 0) count++;
    if (currentFilters.priceRange.min > 0 || currentFilters.priceRange.max < maxPrice) count++;
    if (currentFilters.sortBy !== 'newest') count++;
    return count;
  }, [currentFilters, maxPrice]);

  const FilterContent = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">商品分类</h3>
        <div className="space-y-2">
          {availableCategories.map(category => (
            <label key={category} className="flex items-center cursor-pointer group">
              <input
                type="checkbox"
                checked={currentFilters.categories.includes(category)}
                onChange={() => handleCategoryToggle(category)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
              <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">
                {category}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">价格区间</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="sr-only">最低价格</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">¥</span>
                <input
                  type="number"
                  min={0}
                  max={currentFilters.priceRange.max}
                  value={currentFilters.priceRange.min}
                  onChange={(e) => handlePriceChange('min', e.target.value)}
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="最低"
                />
              </div>
            </div>
            <span className="text-gray-400">-</span>
            <div className="flex-1">
              <label className="sr-only">最高价格</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">¥</span>
                <input
                  type="number"
                  min={currentFilters.priceRange.min}
                  max={maxPrice}
                  value={currentFilters.priceRange.max}
                  onChange={(e) => handlePriceChange('max', e.target.value)}
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="最高"
                />
              </div>
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={maxPrice}
            value={currentFilters.priceRange.max}
            onChange={(e) => handlePriceChange('max', e.target.value)}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>¥0</span>
            <span>¥{maxPrice.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">品牌</h3>
        <div className="space-y-2">
          {availableBrands.map(brand => (
            <label key={brand} className="flex items-center cursor-pointer group">
              <input
                type="checkbox"
                checked={currentFilters.brands.includes(brand)}
                onChange={() => handleBrandToggle(brand)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
              <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">
                {brand}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">排序方式</h3>
        <div className="space-y-2">
          {sortOptions.map(option => (
            <label key={option.value} className="flex items-center cursor-pointer group">
              <input
                type="radio"
                name="sortBy"
                checked={currentFilters.sortBy === option.value}
                onChange={() => handleSortChange(option.value)}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 focus:ring-2"
              />
              <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <button
          onClick={handleReset}
          className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400"
        >
          重置筛选条件
        </button>
      </div>
    </div>
  );

  return (
    <div className={className}>
      <div className="lg:hidden">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between py-3 px-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            <span className="font-medium text-gray-900">筛选</span>
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-blue-600 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isExpanded && (
          <div className="mt-2 p-4 bg-white border border-gray-200 rounded-lg shadow-lg">
            <FilterContent />
          </div>
        )}
      </div>

      <div className="hidden lg:block">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 sticky top-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">筛选条件</h2>
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center px-2.5 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">
                {activeFilterCount} 个筛选
              </span>
            )}
          </div>
          <FilterContent />
        </div>
      </div>
    </div>
  );
};

export default ProductFilter;