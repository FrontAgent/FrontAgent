import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type OrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded' | 'unknown';

export type OrderListItem = {
  id: string;
  orderId?: string;
  createdAt: string;
  status: OrderStatus;
  total: number;
  currency?: string;
};

type OrdersApi = {
  list: () => Promise<OrderListItem[]>;
};

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const formatDateTime = (isoOrDate: string) => {
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return isoOrDate;
  return d.toLocaleString();
};

const formatMoney = (amount: number, currency = 'USD') => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
};

// Mock api fallback (replace with real import when available)
const ordersApi: OrdersApi = {
  list: async () => {
    await delay(450);
    return [
      {
        id: '10001',
        orderId: '10001',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
        status: 'paid',
        total: 129.99,
        currency: 'USD',
      },
      {
        id: '10002',
        orderId: '10002',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
        status: 'processing',
        total: 58.5,
        currency: 'USD',
      },
    ];
  },
};

type LoadState<T> =
  | { status: 'idle' | 'loading'; data?: undefined; error?: undefined }
  | { status: 'success'; data: T; error?: undefined }
  | { status: 'error'; data?: undefined; error: string };

const containerStyle: React.CSSProperties = {
  maxWidth: 980,
  margin: '0 auto',
  padding: '24px 16px',
};

const titleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  margin: '0 0 16px',
};

const listStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const itemStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '14px 14px',
  border: '1px solid rgba(0,0,0,0.12)',
  borderRadius: 10,
  background: '#fff',
  cursor: 'pointer',
};

const leftColStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  minWidth: 0,
};

const rightColStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  alignItems: 'flex-end',
  flexShrink: 0,
};

const mutedStyle: React.CSSProperties = {
  color: 'rgba(0,0,0,0.6)',
  fontSize: 13,
};

const primaryStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
};

const badgeStyle = (status: OrderStatus): React.CSSProperties => {
  const base: React.CSSProperties = {
    fontSize: 12,
    padding: '3px 8px',
    borderRadius: 999,
    border: '1px solid rgba(0,0,0,0.12)',
    background: 'rgba(0,0,0,0.04)',
    color: 'rgba(0,0,0,0.75)',
    textTransform: 'capitalize',
  };
  switch (status) {
    case 'paid':
    case 'delivered':
      return { ...base, background: 'rgba(46, 125, 50, 0.12)', color: '#2e7d32', borderColor: 'rgba(46, 125, 50, 0.25)' };
    case 'processing':
    case 'shipped':
      return { ...base, background: 'rgba(2, 136, 209, 0.12)', color: '#0288d1', borderColor: 'rgba(2, 136, 209, 0.25)' };
    case 'cancelled':
    case 'refunded':
      return { ...base, background: 'rgba(211, 47, 47, 0.12)', color: '#d32f2f', borderColor: 'rgba(211, 47, 47, 0.25)' };
    case 'pending':
    default:
      return base;
  }
};

const EmptyState: React.FC<{ title?: string; description?: string }> = ({ title = 'No orders', description = 'Your order list is empty.' }) => {
  return (
    <div style={{ padding: '18px 14px', border: '1px dashed rgba(0,0,0,0.2)', borderRadius: 10, background: 'rgba(0,0,0,0.02)' }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={mutedStyle}>{description}</div>
    </div>
  );
};

const ErrorState: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => {
  return (
    <div style={{ padding: '18px 14px', border: '1px solid rgba(211, 47, 47, 0.25)', borderRadius: 10, background: 'rgba(211, 47, 47, 0.06)' }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: '#b71c1c' }}>Failed to load</div>
      <div style={{ ...mutedStyle, color: 'rgba(183, 28, 28, 0.9)' }}>{message}</div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: 12,
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid rgba(0,0,0,0.2)',
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      ) : null}
    </div>
  );
};

const LoadingState: React.FC = () => {
  return (
    <div style={{ padding: '18px 14px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10, background: '#fff' }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Loading orders…</div>
      <div style={mutedStyle}>Please wait a moment.</div>
    </div>
  );
};

const OrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState<OrderListItem[]>>({ status: 'idle' });

  const load = async () => {
    setState({ status: 'loading' });
    try {
      const data = await ordersApi.list();
      setState({ status: 'success', data });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      setState({ status: 'error', error: message });
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const orders = useMemo(() => (state.status === 'success' ? state.data : []), [state]);

  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>Orders</h1>

      {state.status === 'loading' || state.status === 'idle' ? <LoadingState /> : null}

      {state.status === 'error' ? <ErrorState message={state.error} onRetry={load} /> : null}

      {state.status === 'success' && orders.length === 0 ? <EmptyState /> : null}

      {state.status === 'success' && orders.length > 0 ? (
        <div style={listStyle} aria-label="orders-list">
          {orders.map((o) => {
            const id = o.id ?? o.orderId ?? '';
            return (
              <div
                key={id}
                role="button"
                tabIndex={0}
                style={itemStyle}
                onClick={() => navigate(`/orders/${encodeURIComponent(id)}`)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') navigate(`/orders/${encodeURIComponent(id)}`);
                }}
                aria-label={`order-${id}`}
              >
                <div style={leftColStyle}>
                  <div style={primaryStyle}>Order #{o.orderId ?? o.id}</div>
                  <div style={mutedStyle}>{formatDateTime(o.createdAt)}</div>
                </div>

                <div style={rightColStyle}>
                  <span style={badgeStyle(o.status)}>{o.status}</span>
                  <div style={primaryStyle}>{formatMoney(o.total, o.currency ?? 'USD')}</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

export default OrdersPage;