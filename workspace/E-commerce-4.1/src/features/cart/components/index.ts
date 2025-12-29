import React from 'react';

export type Money = {
  amount: number;
  currency: string;
};

export type CartLineItem = {
  id: string;
  name: string;
  unitPrice: Money;
  quantity: number;
  imageUrl?: string;
  sku?: string;
  metadata?: Record<string, unknown>;
};

export type Address = {
  id: string;
  name?: string;
  phone?: string;
  line1: string;
  line2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  isDefault?: boolean;
  metadata?: Record<string, unknown>;
};

export type PriceBreakdown = {
  subtotal: Money;
  shipping?: Money;
  discount?: Money;
  tax?: Money;
  total: Money;
};

export type ShippingPricingStrategy = (args: {
  items: readonly CartLineItem[];
  address?: Address | null;
  currency: string;
}) => Money;

export type DiscountPricingStrategy = (args: {
  items: readonly CartLineItem[];
  couponCode?: string;
  currency: string;
}) => Money;

export type TaxPricingStrategy = (args: {
  items: readonly CartLineItem[];
  address?: Address | null;
  currency: string;
}) => Money;

export const formatMoney = (money: Money): string => {
  const safeCurrency = money.currency || 'USD';
  const safeAmount = Number.isFinite(money.amount) ? money.amount : 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: safeCurrency,
      currencyDisplay: 'symbol',
      maximumFractionDigits: 2,
    }).format(safeAmount);
  } catch {
    return `${safeCurrency} ${safeAmount.toFixed(2)}`;
  }
};

export const sumCartSubtotal = (items: readonly CartLineItem[]): Money => {
  const currency = items[0]?.unitPrice.currency ?? 'USD';
  const amount = items.reduce((acc, it) => acc + (it.unitPrice.amount || 0) * (it.quantity || 0), 0);
  return { amount, currency };
};

export const computePriceSummary = (args: {
  items: readonly CartLineItem[];
  currency?: string;
  address?: Address | null;
  couponCode?: string;
  shippingStrategy?: ShippingPricingStrategy;
  discountStrategy?: DiscountPricingStrategy;
  taxStrategy?: TaxPricingStrategy;
}): PriceBreakdown => {
  const currency = args.currency ?? args.items[0]?.unitPrice.currency ?? 'USD';
  const subtotal = sumCartSubtotal(args.items);
  const normalizedSubtotal: Money = { amount: subtotal.amount, currency };

  // TODO(SDD): Define shipping pricing strategy and default behavior.
  const shipping =
    args.shippingStrategy?.({ items: args.items, address: args.address, currency }) ?? ({
      amount: 0,
      currency,
    } as Money);

  // TODO(SDD): Define discount pricing strategy, coupon validation, stacking rules.
  const discount =
    args.discountStrategy?.({ items: args.items, couponCode: args.couponCode, currency }) ?? ({
      amount: 0,
      currency,
    } as Money);

  // TODO(SDD): Define tax pricing strategy, inclusive/exclusive tax policy.
  const tax =
    args.taxStrategy?.({ items: args.items, address: args.address, currency }) ?? ({
      amount: 0,
      currency,
    } as Money);

  const totalAmount = normalizedSubtotal.amount + (shipping.amount || 0) + (tax.amount || 0) - (discount.amount || 0);

  return {
    subtotal: normalizedSubtotal,
    shipping,
    discount,
    tax,
    total: { amount: totalAmount, currency },
  };
};

export type QuantityStepperProps = {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onChange: (next: number) => void;
  ariaLabel?: string;
  className?: string;
};

export const QuantityStepper: React.FC<QuantityStepperProps> = ({
  value,
  min = 1,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  disabled = false,
  onChange,
  ariaLabel = 'Quantity',
  className,
}) => {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const decDisabled = disabled || value <= min;
  const incDisabled = disabled || value >= max;

  return (
    <div className={className} role="group" aria-label={ariaLabel}>
      <button
        type="button"
        onClick={() => onChange(clamp(value - step))}
        disabled={decDisabled}
        aria-label="Decrease quantity"
      >
        -
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={Number.isFinite(max) ? max : undefined}
        step={step}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (!Number.isFinite(next)) return;
          onChange(clamp(next));
        }}
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + step))}
        disabled={incDisabled}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
};

export type CartItemRowProps = {
  item: CartLineItem;
  onQuantityChange?: (itemId: string, nextQuantity: number) => void;
  onRemove?: (itemId: string) => void;
  renderActions?: (item: CartLineItem) => React.ReactNode;
  className?: string;
};

export const CartItemRow: React.FC<CartItemRowProps> = ({ item, onQuantityChange, onRemove, renderActions, className }) => {
  return (
    <div className={className} data-cart-item-id={item.id}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} style={{ width: 56, height: 56, objectFit: 'cover' }} />
        ) : (
          <div style={{ width: 56, height: 56, background: '#eee' }} aria-label="No image" />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
          <div style={{ opacity: 0.8, fontSize: 12 }}>
            {item.sku ? <span>SKU: {item.sku}</span> : null}
          </div>
          <div style={{ marginTop: 6, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>{formatMoney(item.unitPrice)}</div>
            <QuantityStepper
              value={item.quantity}
              min={1}
              onChange={(next) => onQuantityChange?.(item.id, next)}
              ariaLabel={`Quantity for ${item.name}`}
            />
            <div style={{ marginLeft: 'auto' }}>
              <div style={{ fontWeight: 600 }}>
                {formatMoney({ amount: item.unitPrice.amount * item.quantity, currency: item.unitPrice.currency })}
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {renderActions ? renderActions(item) : null}
          {onRemove ? (
            <button type="button" onClick={() => onRemove(item.id)} aria-label={`Remove ${item.name}`}>
              Remove
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export type CartListProps = {
  items: readonly CartLineItem[];
  onQuantityChange?: (itemId: string, nextQuantity: number) => void;
  onRemove?: (itemId: string) => void;
  emptyState?: React.ReactNode;
  className?: string;
};

export const CartList: React.FC<CartListProps> = ({ items, onQuantityChange, onRemove, emptyState, className }) => {
  if (!items.length) {
    return <div className={className}>{emptyState ?? <div>Your cart is empty.</div>}</div>;
  }

  return (
    <div className={className} role="list" aria-label="Cart items">
      {items.map((item) => (
        <div role="listitem" key={item.id} style={{ padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
          <CartItemRow item={item} onQuantityChange={onQuantityChange} onRemove={onRemove} />
        </div>
      ))}
    </div>
  );
};

export type PriceSummaryProps = {
  breakdown?: PriceBreakdown;
  items?: readonly CartLineItem[];
  currency?: string;
  address?: Address | null;
  couponCode?: string;
  shippingStrategy?: ShippingPricingStrategy;
  discountStrategy?: DiscountPricingStrategy;
  taxStrategy?: TaxPricingStrategy;
  className?: string;
  labels?: Partial<{
    subtotal: string;
    shipping: string;
    discount: string;
    tax: string;
    total: string;
  }>;
};

export const PriceSummary: React.FC<PriceSummaryProps> = ({
  breakdown,
  items = [],
  currency,
  address,
  couponCode,
  shippingStrategy,
  discountStrategy,
  taxStrategy,
  className,
  labels,
}) => {
  const computed =
    breakdown ??
    computePriceSummary({
      items,
      currency,
      address,
      couponCode,
      shippingStrategy,
      discountStrategy,
      taxStrategy,
    });

  const l = {
    subtotal: 'Subtotal',
    shipping: 'Shipping',
    discount: 'Discount',
    tax: 'Tax',
    total: 'Total',
    ...labels,
  };

  const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0' };

  return (
    <div className={className} aria-label="Price summary">
      <div style={rowStyle}>
        <span>{l.subtotal}</span>
        <span>{formatMoney(computed.subtotal)}</span>
      </div>
      <div style={rowStyle}>
        <span>{l.shipping}</span>
        <span>{formatMoney(computed.shipping ?? { amount: 0, currency: computed.total.currency })}</span>
      </div>
      <div style={rowStyle}>
        <span>{l.discount}</span>
        <span>-{formatMoney(computed.discount ?? { amount: 0, currency: computed.total.currency })}</span>
      </div>
      <div style={rowStyle}>
        <span>{l.tax}</span>
        <span>{formatMoney(computed.tax ?? { amount: 0, currency: computed.total.currency })}</span>
      </div>
      <div style={{ ...rowStyle, fontWeight: 700, borderTop: '1px solid rgba(0,0,0,0.12)', marginTop: 8, paddingTop: 10 }}>
        <span>{l.total}</span>
        <span>{formatMoney(computed.total)}</span>
      </div>
    </div>
  );
};

export type AddressSelectorProps = {
  addresses: readonly Address[];
  value?: string | null;
  onChange: (addressId: string) => void;
  className?: string;
  renderAddress?: (address: Address, selected: boolean) => React.ReactNode;
  emptyState?: React.ReactNode;
  disabled?: boolean;
};

export const AddressSelector: React.FC<AddressSelectorProps> = ({
  addresses,
  value,
  onChange,
  className,
  renderAddress,
  emptyState,
  disabled = false,
}) => {
  if (!addresses.length) {
    return <div className={className}>{emptyState ?? <div>No saved addresses.</div>}</div>;
  }

  return (
    <div className={className} role="radiogroup" aria-label="Shipping address">
      {addresses.map((a) => {
        const selected = (value ?? null) === a.id;
        return (
          <label
            key={a.id}
            style={{
              display: 'block',
              padding: 12,
              border: selected ? '2px solid rgba(0,0,0,0.6)' : '1px solid rgba(0,0,0,0.12)',
              borderRadius: 8,
              marginBottom: 10,
              opacity: disabled ? 0.7 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            <input
              type="radio"
              name="address"
              value={a.id}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(a.id)}
              style={{ marginRight: 10 }}
            />
            {renderAddress ? (
              renderAddress(a, selected)
            ) : (
              <span>
                <span style={{ fontWeight: 600 }}>{a.name ?? 'Recipient'}</span>
                {a.isDefault ? <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.8 }}>(Default)</span> : null}
                <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>
                  {a.line1}
                  {a.line2 ? `, ${a.line2}` : ''}
                  {a.city ? `, ${a.city}` : ''}
                  {a.region ? `, ${a.region}` : ''}
                  {a.postalCode ? `, ${a.postalCode}` : ''}
                  {a.country ? `, ${a.country}` : ''}
                </div>
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
};

export type CheckoutSubmitBarProps = {
  total: Money;
  disabled?: boolean;
  loading?: boolean;
  onSubmit: () => void | Promise<void>;
  primaryLabel?: string;
  secondary?: React.ReactNode;
  className?: string;
};

export const CheckoutSubmitBar: React.FC<CheckoutSubmitBarProps> = ({
  total,
  disabled = false,
  loading = false,
  onSubmit,
  primaryLabel = 'Place order',
  secondary,
  className,
}) => {
  const busy = disabled || loading;

  return (
    <div className={className} aria-label="Checkout submit bar" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, opacity: 0.8 }}>Total</div>
        <div style={{ fontWeight: 800, fontSize: 18 }}>{formatMoney(total)}</div>
        {secondary ? <div style={{ marginTop: 6 }}>{secondary}</div> : null}
      </div>
      <button
        type="button"
        onClick={() => {
          if (busy) return;
          void onSubmit();
        }}
        disabled={busy}
        aria-busy={loading || undefined}
      >
        {loading ? 'Processing…' : primaryLabel}
      </button>
    </div>
  );
};

export {
  CartItemRow as default,
  CartList,
  QuantityStepper,
  PriceSummary,
  AddressSelector,
  CheckoutSubmitBar,
};