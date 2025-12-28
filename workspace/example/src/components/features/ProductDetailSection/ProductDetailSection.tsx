import React, { useId, useMemo, useState } from 'react';

type UnknownRecord = Record<string, unknown>;

type ProductFallback = {
  id: string | number;
  name: string;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
  images?: Array<{ url: string; alt?: string | null } | string> | null;
  imageUrl?: string | null;
  sku?: string | null;
  stock?: number | null;
};

export type ProductDetailSectionProps<TProduct extends UnknownRecord = UnknownRecord> = {
  product?: TProduct | ProductFallback | null;
  isLoading?: boolean;
  error?: unknown;
  onAddToCart?: (args: { product: TProduct | ProductFallback; quantity: number }) => void | Promise<void>;
  initialQuantity?: number;
  minQuantity?: number;
  className?: string;
};

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function getProductId(product: UnknownRecord | ProductFallback): string {
  const p = product as UnknownRecord;
  const id = (p as ProductFallback).id ?? p['id'];
  return typeof id === 'string' || typeof id === 'number' ? String(id) : 'unknown';
}

function getProductName(product: UnknownRecord | ProductFallback): string {
  const p = product as UnknownRecord;
  return (
    getString((product as ProductFallback).name) ||
    getString(p['name']) ||
    getString(p['title']) ||
    'Unnamed product'
  );
}

function getProductDescription(product: UnknownRecord | ProductFallback): string | undefined {
  const p = product as UnknownRecord;
  return (
    getString((product as ProductFallback).description) ||
    getString(p['description']) ||
    getString(p['summary']) ||
    getString(p['details'])
  );
}

function getProductPrice(product: UnknownRecord | ProductFallback): number | undefined {
  const p = product as UnknownRecord;
  return (
    toNumber((product as ProductFallback).price) ??
    toNumber(p['price']) ??
    toNumber(p['amount']) ??
    toNumber((p['pricing'] as UnknownRecord | undefined)?.['price'])
  );
}

function getProductCurrency(product: UnknownRecord | ProductFallback): string | undefined {
  const p = product as UnknownRecord;
  return (
    getString((product as ProductFallback).currency) ||
    getString(p['currency']) ||
    getString((p['pricing'] as UnknownRecord | undefined)?.['currency'])
  );
}

function getPrimaryImage(product: UnknownRecord | ProductFallback): { src: string; alt: string } | undefined {
  const p = product as UnknownRecord;

  const imageUrl =
    getString((product as ProductFallback).imageUrl) ||
    getString(p['imageUrl']) ||
    getString(p['image']) ||
    getString(p['thumbnail']) ||
    getString((p['images'] as UnknownRecord | undefined)?.['0']);

  if (imageUrl) {
    return { src: imageUrl, alt: getProductName(product) };
  }

  const images = (product as ProductFallback).images ?? (p['images'] as unknown);

  if (Array.isArray(images) && images.length > 0) {
    const first = images[0] as unknown;
    if (typeof first === 'string') {
      return { src: first, alt: getProductName(product) };
    }
    if (first && typeof first === 'object') {
      const url = getString((first as UnknownRecord)['url']) || getString((first as UnknownRecord)['src']);
      const alt = getString((first as UnknownRecord)['alt']) || getProductName(product);
      if (url) return { src: url, alt };
    }
  }

  return undefined;
}

function formatMoney(value: number, currency?: string): string {
  const curr = currency || 'USD';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: curr }).format(value);
  } catch {
    return `${value.toFixed(2)} ${curr}`;
  }
}

export default function ProductDetailSection<TProduct extends UnknownRecord = UnknownRecord>({
  product,
  isLoading,
  error,
  onAddToCart,
  initialQuantity = 1,
  minQuantity = 1,
  className,
}: ProductDetailSectionProps<TProduct>) {
  const quantityId = useId();
  const safeMin = Math.max(1, Math.floor(minQuantity || 1));
  const [quantity, setQuantity] = useState<number>(() => Math.max(safeMin, Math.floor(initialQuantity || 1)));
  const [isAdding, setIsAdding] = useState(false);

  const normalizedProduct = product as unknown as (TProduct | ProductFallback | null | undefined);

  const viewModel = useMemo(() => {
    if (!normalizedProduct) return null;
    const p = normalizedProduct as unknown as UnknownRecord | ProductFallback;
    const name = getProductName(p);
    const description = getProductDescription(p);
    const price = getProductPrice(p);
    const currency = getProductCurrency(p);
    const image = getPrimaryImage(p);
    const id = getProductId(p);
    const sku =
      getString((p as ProductFallback).sku) ||
      getString((p as UnknownRecord)['sku']) ||
      getString((p as UnknownRecord)['code']);
    const stock =
      toNumber((p as ProductFallback).stock) ?? toNumber((p as UnknownRecord)['stock']) ?? toNumber((p as UnknownRecord)['inventory']);
    return { id, name, description, price, currency, image, sku, stock };
  }, [normalizedProduct]);

  const isOutOfStock = useMemo(() => {
    if (!viewModel) return false;
    if (typeof viewModel.stock === 'number') return viewModel.stock <= 0;
    return false;
  }, [viewModel]);

  const canAddToCart = Boolean(normalizedProduct) && !isOutOfStock && !isAdding && !isLoading;

  const rootClassName = [
    'w-full',
    'bg-white',
    'text-slate-900',
    'border',
    'border-slate-200',
    'rounded-xl',
    'p-4',
    'sm:p-6',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const onDecrement = () => setQuantity((q) => Math.max(safeMin, q - 1));
  const onIncrement = () => setQuantity((q) => q + 1);

  const onQuantityChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const next = Math.floor(Number(e.target.value));
    if (!Number.isFinite(next)) {
      setQuantity(safeMin);
      return;
    }
    setQuantity(Math.max(safeMin, next));
  };

  const handleAddToCart = async () => {
    if (!normalizedProduct) return;
    if (!onAddToCart) return;

    const q = Math.max(safeMin, Math.floor(quantity || safeMin));
    setIsAdding(true);
    try {
      await onAddToCart({ product: normalizedProduct as TProduct | ProductFallback, quantity: q });
    } finally {
      setIsAdding(false);
    }
  };

  if (isLoading) {
    return (
      <section className={rootClassName} aria-busy="true" aria-live="polite">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="aspect-square w-full rounded-lg bg-slate-100 animate-pulse" />
          <div className="space-y-4">
            <div className="h-7 w-3/4 rounded bg-slate-100 animate-pulse" />
            <div className="h-5 w-1/3 rounded bg-slate-100 animate-pulse" />
            <div className="h-20 w-full rounded bg-slate-100 animate-pulse" />
            <div className="h-10 w-1/2 rounded bg-slate-100 animate-pulse" />
            <div className="h-12 w-full rounded bg-slate-100 animate-pulse" />
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Failed to load product.';
    return (
      <section className={rootClassName} role="alert">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-800">
          <div className="font-semibold">Error</div>
          <div className="mt-1 text-sm">{message}</div>
        </div>
      </section>
    );
  }

  if (!normalizedProduct || !viewModel) {
    return (
      <section className={rootClassName} role="status" aria-live="polite">
        <div className="text-sm text-slate-600">No product available.</div>
      </section>
    );
  }

  return (
    <section className={rootClassName} aria-labelledby={`product-title-${viewModel.id}`}>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:items-start">
        <div className="w-full">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {viewModel.image ? (
              <img
                src={viewModel.image.src}
                alt={viewModel.image.alt}
                className="h-auto w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center text-sm text-slate-500">
                No image
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <header className="space-y-1">
            <h1 id={`product-title-${viewModel.id}`} className="text-xl font-semibold tracking-tight sm:text-2xl">
              {viewModel.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
              {viewModel.sku ? <span>SKU: {viewModel.sku}</span> : null}
              {typeof viewModel.stock === 'number' ? (
                <span className={viewModel.stock > 0 ? 'text-emerald-700' : 'text-rose-700'}>
                  {viewModel.stock > 0 ? `In stock: ${viewModel.stock}` : 'Out of stock'}
                </span>
              ) : null}
            </div>
          </header>

          <div className="flex items-baseline gap-2">
            {typeof viewModel.price === 'number' ? (
              <div className="text-2xl font-semibold">{formatMoney(viewModel.price, viewModel.currency)}</div>
            ) : (
              <div className="text-sm text-slate-600">Price unavailable</div>
            )}
          </div>

          {viewModel.description ? (
            <p className="text-sm leading-6 text-slate-700 whitespace-pre-line">{viewModel.description}</p>
          ) : null}

          <div className="mt-1 flex flex-col gap-3">
            <div className="flex items-end gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor={quantityId} className="text-sm font-medium text-slate-800">
                  Quantity
                </label>
                <div className="flex items-center rounded-lg border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={onDecrement}
                    className="rounded-l-lg px-3 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    disabled={quantity <= safeMin}
                    aria-label="Decrease quantity"
                  >
                    -
                  </button>
                  <input
                    id={quantityId}
                    type="number"
                    inputMode="numeric"
                    min={safeMin}
                    value={quantity}
                    onChange={onQuantityChange}
                    className="w-20 border-x border-slate-200 px-3 py-2 text-center text-sm outline-none focus:ring-2 focus:ring-slate-300"
                    aria-label="Product quantity"
                  />
                  <button
                    type="button"
                    onClick={onIncrement}
                    className="rounded-r-lg px-3 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!canAddToCart || !onAddToCart}
                className="flex-1 rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isOutOfStock ? 'Out of stock' : isAdding ? 'Adding…' : 'Add to cart'}
              </button>
            </div>

            {!onAddToCart ? (
              <div className="text-xs text-slate-500">Add to cart is not available.</div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}