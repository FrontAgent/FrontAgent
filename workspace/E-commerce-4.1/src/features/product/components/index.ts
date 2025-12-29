import React from 'react';

export type ProductId = string;

export interface Money {
  currency: string;
  amount: number;
}

export interface ProductImage {
  url: string;
  alt?: string;
}

export interface ProductSummary {
  id: ProductId;
  title: string;
  subtitle?: string;
  price?: Money;
  compareAtPrice?: Money;
  rating?: number;
  reviewCount?: number;
  images?: ProductImage[];
  badges?: string[];
  inStock?: boolean;
}

export interface ProductDetail extends ProductSummary {
  description?: string;
  highlights?: string[];
  specifications?: Record<string, string>;
  skuOptions?: SkuOptionGroup[];
}

export interface SkuOption {
  id: string;
  label: string;
  disabled?: boolean;
}

export interface SkuOptionGroup {
  id: string;
  name: string;
  options: SkuOption[];
}

export type ProductFilterValue = string | number | boolean | string[] | number[];

export interface ProductFiltersState {
  query?: string;
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'rating_desc';
  inStockOnly?: boolean;
  priceMin?: number;
  priceMax?: number;
  facets?: Record<string, ProductFilterValue>;
}

export interface ProductCardProps {
  product: ProductSummary;
  onClick?: (productId: ProductId) => void;
  onAddToCart?: (productId: ProductId) => void;
  className?: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onClick,
  onAddToCart,
  className,
}) => {
  // TODO: 接入真实 UI 组件与样式（如卡片、图片、价格、评分、优惠等）
  const title = product.title ?? 'Untitled Product';
  const priceText =
    product.price != null ? `${product.price.currency} ${product.price.amount.toFixed(2)}` : '—';

  return (
    <div
      className={className}
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(product.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick?.(product.id);
      }}
      aria-label={`Open product ${title}`}
      style={{
        border: '1px solid rgba(0,0,0,0.1)',
        borderRadius: 8,
        padding: 12,
        display: 'grid',
        gap: 8,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div
          aria-hidden="true"
          style={{
            width: 56,
            height: 56,
            borderRadius: 8,
            background: 'rgba(0,0,0,0.05)',
            flex: '0 0 auto',
          }}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title}
          </div>
          {product.subtitle ? (
            <div style={{ opacity: 0.8, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {product.subtitle}
            </div>
          ) : null}
          <div style={{ marginTop: 4, fontSize: 13 }}>{priceText}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          {/* TODO: 评分与库存状态展示 */}
          {product.inStock === false ? 'Out of stock' : 'In stock'}
        </div>

        <AddToCartButton
          disabled={product.inStock === false}
          onClick={() => onAddToCart?.(product.id)}
        />
      </div>
    </div>
  );
};

export interface ProductFilterBarProps {
  value: ProductFiltersState;
  onChange: (next: ProductFiltersState) => void;
  className?: string;
}

export const ProductFilterBar: React.FC<ProductFilterBarProps> = ({ value, onChange, className }) => {
  // TODO: 接入真实筛选 UI（搜索、排序、价格区间、Facet 多选等）
  return (
    <div
      className={className}
      style={{
        border: '1px solid rgba(0,0,0,0.1)',
        borderRadius: 8,
        padding: 12,
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 12, opacity: 0.8 }}>Search</span>
        <input
          value={value.query ?? ''}
          onChange={(e) => onChange({ ...value, query: e.target.value })}
          placeholder="Search products"
          style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.15)' }}
        />
      </label>

      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 12, opacity: 0.8 }}>Sort</span>
        <select
          value={value.sort ?? 'relevance'}
          onChange={(e) => onChange({ ...value, sort: e.target.value as ProductFiltersState['sort'] })}
          style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.15)' }}
        >
          <option value="relevance">Relevance</option>
          <option value="newest">Newest</option>
          <option value="price_asc">Price ↑</option>
          <option value="price_desc">Price ↓</option>
          <option value="rating_desc">Rating ↓</option>
        </select>
      </label>

      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={value.inStockOnly ?? false}
          onChange={(e) => onChange({ ...value, inStockOnly: e.target.checked })}
        />
        <span style={{ fontSize: 12, opacity: 0.8 }}>In stock only</span>
      </label>
    </div>
  );
};

export interface ProductDetailInfoProps {
  product: ProductDetail;
  className?: string;
}

export const ProductDetailInfo: React.FC<ProductDetailInfoProps> = ({ product, className }) => {
  // TODO: 接入真实详情页 UI（图库、富文本详情、参数表、面包屑等）
  const priceText =
    product.price != null ? `${product.price.currency} ${product.price.amount.toFixed(2)}` : '—';

  return (
    <section className={className} style={{ display: 'grid', gap: 12 }}>
      <header style={{ display: 'grid', gap: 4 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>{product.title}</h1>
        {product.subtitle ? <div style={{ opacity: 0.8 }}>{product.subtitle}</div> : null}
        <div style={{ fontWeight: 600 }}>{priceText}</div>
      </header>

      {product.description ? <p style={{ margin: 0, opacity: 0.9 }}>{product.description}</p> : null}

      {product.highlights?.length ? (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {product.highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      ) : null}

      {product.specifications && Object.keys(product.specifications).length ? (
        <dl style={{ margin: 0, display: 'grid', gap: 6 }}>
          {Object.entries(product.specifications).map(([k, v]) => (
            <div key={k} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12 }}>
              <dt style={{ opacity: 0.75 }}>{k}</dt>
              <dd style={{ margin: 0 }}>{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
};

export interface SkuSelectorValue {
  selectedOptions: Record<string, string | undefined>;
}

export interface SkuSelectorProps {
  optionGroups: SkuOptionGroup[];
  value: SkuSelectorValue;
  onChange: (next: SkuSelectorValue) => void;
  className?: string;
}

export const SkuSelector: React.FC<SkuSelectorProps> = ({ optionGroups, value, onChange, className }) => {
  // TODO: 接入真实 SKU 选择交互（禁用组合、默认值、可用性提示等）
  return (
    <div className={className} style={{ display: 'grid', gap: 12 }}>
      {optionGroups.map((group) => {
        const selected = value.selectedOptions[group.id] ?? '';
        return (
          <label key={group.id} style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>{group.name}</span>
            <select
              value={selected}
              onChange={(e) =>
                onChange({
                  selectedOptions: { ...value.selectedOptions, [group.id]: e.target.value || undefined },
                })
              }
              style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.15)' }}
            >
              <option value="">Select</option>
              {group.options.map((opt) => (
                <option key={opt.id} value={opt.id} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
};

export interface AddToCartButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const AddToCartButton: React.FC<AddToCartButtonProps> = ({
  onClick,
  disabled,
  loading,
  className,
  children,
}) => {
  // TODO: 接入真实加购逻辑（埋点、库存校验、乐观更新、Toast 等）
  const isDisabled = disabled || loading;

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      style={{
        padding: '8px 10px',
        borderRadius: 8,
        border: '1px solid rgba(0,0,0,0.15)',
        background: isDisabled ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.02)',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {children ?? (loading ? 'Adding…' : 'Add to cart')}
    </button>
  );
};