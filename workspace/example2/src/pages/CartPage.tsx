import React, { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

type CartItem = {
  id: string;
  name: string;
  priceCents: number;
  quantity: number;
  imageUrl?: string;
};

const formatCurrency = (cents: number, currency: string = 'USD'): string => {
  const value = cents / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
};

const clampInt = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
};

const createMockItems = (): CartItem[] => [
  {
    id: 'sku_1001',
    name: 'Classic T-Shirt',
    priceCents: 1999,
    quantity: 1,
    imageUrl: 'https://via.placeholder.com/96?text=T',
  },
  {
    id: 'sku_2002',
    name: 'Everyday Sneakers',
    priceCents: 6499,
    quantity: 2,
    imageUrl: 'https://via.placeholder.com/96?text=S',
  },
  {
    id: 'sku_3003',
    name: 'Canvas Tote Bag',
    priceCents: 2499,
    quantity: 1,
    imageUrl: 'https://via.placeholder.com/96?text=B',
  },
];

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 980,
    margin: '0 auto',
    padding: '24px 16px',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    lineHeight: 1.2,
    margin: 0,
  },
  itemsCount: {
    color: '#666',
    fontSize: 14,
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '1fr 320px',
    gap: 16,
    alignItems: 'start',
  },
  panel: {
    border: '1px solid #e6e6e6',
    borderRadius: 12,
    background: '#fff',
    overflow: 'hidden',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  item: {
    display: 'grid',
    gridTemplateColumns: '96px 1fr',
    gap: 12,
    padding: 16,
    borderBottom: '1px solid #f0f0f0',
  },
  itemLast: {
    borderBottom: 'none',
  },
  thumb: {
    width: 96,
    height: 96,
    borderRadius: 10,
    objectFit: 'cover',
    background: '#f7f7f7',
    border: '1px solid #eee',
  },
  itemMain: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minWidth: 0,
  },
  itemTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  itemName: {
    fontSize: 16,
    margin: 0,
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  price: {
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  qtyControls: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
  },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: '1px solid #ddd',
    background: '#fafafa',
    cursor: 'pointer',
    fontSize: 16,
    lineHeight: '30px',
    padding: 0,
  },
  qtyButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  qtyInput: {
    width: 56,
    height: 32,
    borderRadius: 8,
    border: '1px solid #ddd',
    padding: '0 10px',
    fontSize: 14,
  },
  removeButton: {
    border: '1px solid #ddd',
    background: '#fff',
    borderRadius: 10,
    padding: '8px 10px',
    cursor: 'pointer',
    fontSize: 13,
    whiteSpace: 'nowrap',
  },
  summary: {
    padding: 16,
  },
  summaryTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
  },
  divider: {
    height: 1,
    background: '#f0f0f0',
    margin: '12px 0',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    margin: '8px 0',
    fontSize: 14,
  },
  summaryTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
    fontSize: 16,
    fontWeight: 800,
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginTop: 14,
  },
  primaryLink: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: 10,
    textDecoration: 'none',
    fontWeight: 700,
    background: '#111',
    color: '#fff',
  },
  secondaryLink: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: 10,
    textDecoration: 'none',
    fontWeight: 600,
    background: '#fff',
    color: '#111',
    border: '1px solid #ddd',
  },
  emptyState: {
    border: '1px dashed #ddd',
    borderRadius: 12,
    padding: 28,
    background: '#fff',
    textAlign: 'center',
  },
  emptyTitle: {
    margin: '0 0 6px 0',
    fontSize: 18,
    fontWeight: 800,
  },
  emptyText: {
    margin: '0 0 16px 0',
    color: '#666',
    fontSize: 14,
  },
  responsiveLayout: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 16,
  },
};

const useIsNarrow = (): boolean => {
  const [isNarrow, setIsNarrow] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(max-width: 860px)')?.matches ?? false;
  });

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(max-width: 860px)');
    const handler = () => setIsNarrow(mql.matches);
    handler();
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
    // eslint-disable-next-line deprecation/deprecation
    mql.addListener(handler);
    // eslint-disable-next-line deprecation/deprecation
    return () => mql.removeListener(handler);
  }, []);

  return isNarrow;
};

const CartPage: React.FC = () => {
  const [items, setItems] = useState<CartItem[]>(() => createMockItems());
  const isNarrow = useIsNarrow();

  const itemCount = useMemo(() => items.reduce((acc, it) => acc + it.quantity, 0), [items]);

  const subtotalCents = useMemo(
    () => items.reduce((acc, it) => acc + it.priceCents * it.quantity, 0),
    [items],
  );

  const shippingCents = useMemo(() => {
    if (items.length === 0) return 0;
    return subtotalCents >= 7500 ? 0 : 599;
  }, [items.length, subtotalCents]);

  const taxCents = useMemo(() => {
    if (items.length === 0) return 0;
    return Math.round(subtotalCents * 0.08);
  }, [items.length, subtotalCents]);

  const totalCents = useMemo(() => subtotalCents + shippingCents + taxCents, [subtotalCents, shippingCents, taxCents]);

  const setQuantity = useCallback((id: string, nextQty: number) => {
    setItems((prev) =>
      prev
        .map((it) => (it.id === id ? { ...it, quantity: clampInt(nextQty, 1, 99) } : it))
        .filter((it) => it.quantity > 0),
    );
  }, []);

  const increment = useCallback(
    (id: string) => {
      setItems((prev) =>
        prev.map((it) =>
          it.id === id ? { ...it, quantity: clampInt(it.quantity + 1, 1, 99) } : it,
        ),
      );
    },
    [setItems],
  );

  const decrement = useCallback(
    (id: string) => {
      setItems((prev) =>
        prev
          .map((it) =>
            it.id === id ? { ...it, quantity: clampInt(it.quantity - 1, 0, 99) } : it,
          )
          .filter((it) => it.quantity > 0),
      );
    },
    [setItems],
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const mainLayoutStyle = isNarrow ? styles.responsiveLayout : styles.layout;

  return (
    <div style={styles.page}>
      <div style={styles.headerRow}>
        <h1 style={styles.title}>Cart</h1>
        <div style={styles.itemsCount} aria-live="polite">
          {itemCount === 0 ? 'No items' : `${itemCount} item${itemCount === 1 ? '' : 's'}`}
        </div>
      </div>

      {items.length === 0 ? (
        <div style={styles.emptyState} role="status">
          <p style={styles.emptyTitle}>Your cart is empty</p>
          <p style={styles.emptyText}>Add items to your cart to see them here.</p>
          <Link to="/" style={styles.primaryLink}>
            Continue shopping
          </Link>
        </div>
      ) : (
        <div style={mainLayoutStyle}>
          <div style={styles.panel} aria-label="Cart items">
            <ul style={styles.list}>
              {items.map((it, idx) => {
                const isLast = idx === items.length - 1;
                const lineTotal = it.priceCents * it.quantity;

                return (
                  <li
                    key={it.id}
                    style={{ ...styles.item, ...(isLast ? styles.itemLast : null) }}
                    aria-label={`Cart item: ${it.name}`}
                  >
                    <img
                      src={it.imageUrl ?? 'https://via.placeholder.com/96?text=Item'}
                      alt={it.name}
                      style={styles.thumb}
                      loading="lazy"
                    />
                    <div style={styles.itemMain}>
                      <div style={styles.itemTop}>
                        <p style={styles.itemName} title={it.name}>
                          {it.name}
                        </p>
                        <div style={styles.price} aria-label="Line total">
                          {formatCurrency(lineTotal)}
                        </div>
                      </div>

                      <div style={styles.metaRow}>
                        <div style={styles.qtyControls} aria-label="Quantity controls">
                          <button
                            type="button"
                            style={{
                              ...styles.qtyButton,
                              ...(it.quantity <= 1 ? styles.qtyButtonDisabled : null),
                            }}
                            onClick={() => decrement(it.id)}
                            disabled={it.quantity <= 1}
                            aria-label={`Decrease quantity for ${it.name}`}
                          >
                            −
                          </button>

                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={99}
                            value={it.quantity}
                            onChange={(e) => {
                              const raw = Number(e.target.value);
                              if (!Number.isFinite(raw)) return;
                              setQuantity(it.id, raw);
                            }}
                            onBlur={(e) => {
                              const raw = Number(e.target.value);
                              setQuantity(it.id, raw);
                            }}
                            style={styles.qtyInput}
                            aria-label={`Quantity for ${it.name}`}
                          />

                          <button
                            type="button"
                            style={styles.qtyButton}
                            onClick={() => increment(it.id)}
                            aria-label={`Increase quantity for ${it.name}`}
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          style={styles.removeButton}
                          onClick={() => removeItem(it.id)}
                          aria-label={`Remove ${it.name} from cart`}
                        >
                          Remove
                        </button>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666', fontSize: 13 }}>
                        <span>Unit: {formatCurrency(it.priceCents)}</span>
                        <span>Qty: {it.quantity}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <aside style={styles.panel} aria-label="Order summary">
            <div style={styles.summary}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                <h2 style={styles.summaryTitle}>Summary</h2>
                <button
                  type="button"
                  onClick={clearCart}
                  style={{ ...styles.removeButton, padding: '6px 10px' }}
                  aria-label="Clear cart"
                >
                  Clear
                </button>
              </div>

              <div style={styles.divider} />

              <div style={styles.summaryRow}>
                <span>Subtotal</span>
                <span>{formatCurrency(subtotalCents)}</span>
              </div>

              <div style={styles.summaryRow}>
                <span>Shipping</span>
                <span>{shippingCents === 0 ? 'Free' : formatCurrency(shippingCents)}</span>
              </div>

              <div style={styles.summaryRow}>
                <span>Tax</span>
                <span>{formatCurrency(taxCents)}</span>
              </div>

              <div style={styles.divider} />

              <div style={styles.summaryTotal}>
                <span>Total</span>
                <span>{formatCurrency(totalCents)}</span>
              </div>

              <div style={styles.actions}>
                <Link to="/checkout" style={styles.primaryLink} aria-label="Go to checkout">
                  Go to checkout
                </Link>
                <Link to="/" style={styles.secondaryLink} aria-label="Continue shopping">
                  Continue shopping
                </Link>
              </div>

              <p style={{ margin: '12px 0 0 0', color: '#666', fontSize: 12, lineHeight: 1.4 }}>
                This page uses mock cart data and local state updates as a placeholder for a real store.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

export default CartPage;