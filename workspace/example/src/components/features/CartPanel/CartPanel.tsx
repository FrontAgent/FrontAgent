import React, { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import EmptyState from '@/components/common/EmptyState';

type CartItem = {
  id: string;
  name: string;
  imageUrl?: string;
  price: number;
  quantity: number;
  variantName?: string;
  sku?: string;
};

type CartPanelProps = {
  items?: CartItem[];
  total?: number;
  currency?: string;
  onCheckout?: () => void;
  onIncrease?: (id: string) => void;
  onDecrease?: (id: string) => void;
  onRemove?: (id: string) => void;
  className?: string;
};

type CartStore = {
  items: CartItem[];
  total: number;
  increase: (id: string) => void;
  decrease: (id: string) => void;
  remove: (id: string) => void;
};

function useCartStoreOptional(): CartStore | null {
  try {
    const mod = require('@/stores/cart') as { useCartStore?: unknown };
    const useCartStore = mod?.useCartStore as
      | ((selector?: (s: CartStore) => unknown) => unknown)
      | undefined;

    if (typeof useCartStore !== 'function') return null;

    const store = useCartStore((s: CartStore) => s) as CartStore;
    if (
      store &&
      Array.isArray(store.items) &&
      typeof store.total === 'number' &&
      typeof store.increase === 'function' &&
      typeof store.decrease === 'function' &&
      typeof store.remove === 'function'
    ) {
      return store;
    }
    return null;
  } catch {
    return null;
  }
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

const CartPanel: React.FC<CartPanelProps> = ({
  items: itemsProp,
  total: totalProp,
  currency = 'USD',
  onCheckout,
  onIncrease,
  onDecrease,
  onRemove,
  className,
}) => {
  const navigate = useNavigate();
  const store = useCartStoreOptional();

  const items = store?.items ?? itemsProp ?? [];
  const total = store?.total ?? totalProp ?? items.reduce((sum, it) => sum + it.price * it.quantity, 0);

  const handleIncrease = useCallback(
    (id: string) => {
      if (store) return store.increase(id);
      onIncrease?.(id);
    },
    [store, onIncrease]
  );

  const handleDecrease = useCallback(
    (id: string) => {
      if (store) return store.decrease(id);
      onDecrease?.(id);
    },
    [store, onDecrease]
  );

  const handleRemove = useCallback(
    (id: string) => {
      if (store) return store.remove(id);
      onRemove?.(id);
    },
    [store, onRemove]
  );

  const canMutate = useMemo(() => {
    return Boolean(store || onIncrease || onDecrease || onRemove);
  }, [store, onIncrease, onDecrease, onRemove]);

  const handleCheckout = useCallback(() => {
    if (onCheckout) return onCheckout();
    navigate('/checkout');
  }, [onCheckout, navigate]);

  if (!items.length) {
    return (
      <div className={className}>
        <EmptyState title="Your cart is empty" description="Add items to get started." />
      </div>
    );
  }

  return (
    <div className={['flex h-full flex-col', className].filter(Boolean).join(' ')}>
      <div className="flex-1 overflow-auto">
        <ul className="divide-y divide-gray-200">
          {items.map((item) => {
            const lineTotal = item.price * item.quantity;
            return (
              <li key={item.id} className="flex gap-4 p-4">
                <div className="h-16 w-16 flex-none overflow-hidden rounded-md bg-gray-100">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">No image</div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{item.name}</p>
                      {item.variantName ? (
                        <p className="mt-0.5 truncate text-xs text-gray-500">{item.variantName}</p>
                      ) : null}
                      {item.sku ? <p className="mt-0.5 truncate text-xs text-gray-400">SKU: {item.sku}</p> : null}
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{formatMoney(lineTotal, currency)}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{formatMoney(item.price, currency)} each</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => handleDecrease(item.id)}
                        disabled={!canMutate || item.quantity <= 1}
                        aria-label="Decrease quantity"
                      >
                        -
                      </button>
                      <span className="min-w-8 text-center text-sm text-gray-900">{item.quantity}</span>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => handleIncrease(item.id)}
                        disabled={!canMutate}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      className="text-sm font-medium text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => handleRemove(item.id)}
                      disabled={!canMutate}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="sticky bottom-0 border-t border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">Total</p>
          <p className="text-lg font-semibold text-gray-900">{formatMoney(total, currency)}</p>
        </div>
        <button
          type="button"
          className="mt-3 inline-flex w-full items-center justify-center rounded-md bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
          onClick={handleCheckout}
        >
          Checkout
        </button>
      </div>
    </div>
  );
};

export default CartPanel;