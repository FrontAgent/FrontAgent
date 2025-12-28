import React, { useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import type { TProduct } from '@/types';

type ProductCardProps = {
  product: TProduct;
  onAddToCart?: (product: TProduct) => void;
  onOpenDetail?: (product: TProduct) => void;
  className?: string;
};

type ProductLike = {
  id?: string | number;
  title?: string;
  name?: string;
  price?: number | string;
  thumbnail?: string;
  image?: string;
  images?: string[];
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value.replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const formatPrice = (price: unknown): string => {
  const n = toNumber(price);
  if (n === null) return typeof price === 'string' ? price : '—';
  try {
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(n);
  } catch {
    return `¥${n.toFixed(2)}`;
  }
};

const getProductTitle = (product: ProductLike): string => {
  return (product.title ?? product.name ?? '未命名商品').toString();
};

const getProductImage = (product: ProductLike): string | undefined => {
  return (
    product.thumbnail ??
    product.image ??
    (Array.isArray(product.images) ? product.images[0] : undefined) ??
    undefined
  );
};

const getProductId = (product: ProductLike): string => {
  const id = product.id;
  if (typeof id === 'string') return id;
  if (typeof id === 'number') return String(id);
  return getProductTitle(product);
};

const useDefaultProductCardActions = (): {
  onAddToCart: (product: TProduct) => void;
  onOpenDetail: (product: TProduct) => void;
} => {
  const onAddToCart = React.useCallback((product: TProduct) => {
    void product;
    // TODO: 从 store 读取默认动作（需等 store 定义后再补全）
  }, []);

  const onOpenDetail = React.useCallback((product: TProduct) => {
    void product;
    // TODO: 从 store 读取默认动作（需等 store 定义后再补全）
  }, []);

  return { onAddToCart, onOpenDetail };
};

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  onOpenDetail,
  className,
}) => {
  const defaults = useDefaultProductCardActions();

  const resolvedOnAddToCart = onAddToCart ?? defaults.onAddToCart;
  const resolvedOnOpenDetail = onOpenDetail ?? defaults.onOpenDetail;

  const { title, imageUrl, priceText, productKey } = useMemo(() => {
    const p = product as unknown as ProductLike;
    const t = getProductTitle(p);
    const img = getProductImage(p);
    const price = formatPrice(p.price);
    const key = getProductId(p);
    return { title: t, imageUrl: img, priceText: price, productKey: key };
  }, [product]);

  return (
    <article
      className={[
        'group relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition',
        'hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md',
        className ?? '',
      ].join(' ')}
      data-product-id={productKey}
    >
      <div className="w-full">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
              暂无图片
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 p-4">
          <h3 className="line-clamp-2 text-sm font-medium text-gray-900">{title}</h3>
          <div className="text-base font-semibold text-gray-900">{priceText}</div>

          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => resolvedOnOpenDetail(product)}
            >
              查看详情
            </Button>
            <Button type="button" className="flex-1" onClick={() => resolvedOnAddToCart(product)}>
              加入购物车
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;