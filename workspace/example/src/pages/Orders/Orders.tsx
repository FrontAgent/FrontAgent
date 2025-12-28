import React, { useMemo } from 'react';

type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';

export interface Order {
  id: string;
  number: string;
  createdAt: string;
  status: OrderStatus;
  totalAmount: number;
  currency: string;
}

type UseOrdersResult = {
  data: Order[] | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
};

const formatCurrency = (amount: number, currency: string): string => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
};

const formatDateTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const getStatusLabel = (status: OrderStatus): string => {
  switch (status) {
    case 'pending':
      return '待支付';
    case 'paid':
      return '已支付';
    case 'shipped':
      return '已发货';
    case 'delivered':
      return '已完成';
    case 'cancelled':
      return '已取消';
    default:
      return status;
  }
};

const getStatusColor = (status: OrderStatus): string => {
  switch (status) {
    case 'pending':
      return '#b45309';
    case 'paid':
      return '#1d4ed8';
    case 'shipped':
      return '#0f766e';
    case 'delivered':
      return '#15803d';
    case 'cancelled':
      return '#b91c1c';
    default:
      return '#374151';
  }
};

// Placeholder hook: replace with real implementation (e.g., react-query / SWR) in project.
const useOrders = (): UseOrdersResult => {
  return {
    data: [],
    isLoading: false,
    error: null,
    refetch: () => undefined,
  };
};

const containerStyle: React.CSSProperties = {
  maxWidth: 960,
  margin: '0 auto',
  padding: '24px 16px',
};

const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 16,
};

const titleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  margin: 0,
};

const buttonStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid rgba(0,0,0,0.12)',
  background: 'transparent',
  cursor: 'pointer',
};

const cardStyle: React.CSSProperties = {
  border: '1px solid rgba(0,0,0,0.10)',
  borderRadius: 12,
  overflow: 'hidden',
  background: 'rgba(255,255,255,0.9)',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  fontSize: 12,
  letterSpacing: 0.3,
  textTransform: 'uppercase',
  color: 'rgba(0,0,0,0.55)',
  padding: '12px 14px',
  borderBottom: '1px solid rgba(0,0,0,0.08)',
  background: 'rgba(0,0,0,0.02)',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderBottom: '1px solid rgba(0,0,0,0.06)',
  verticalAlign: 'middle',
};

const statusPillStyle = (status: OrderStatus): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  color: getStatusColor(status),
  background: `${getStatusColor(status)}14`,
  border: `1px solid ${getStatusColor(status)}33`,
});

const emptyStateStyle: React.CSSProperties = {
  padding: 24,
  textAlign: 'center',
  color: 'rgba(0,0,0,0.60)',
};

const errorBoxStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 12,
  border: '1px solid rgba(185, 28, 28, 0.35)',
  background: 'rgba(185, 28, 28, 0.06)',
  color: 'rgba(0,0,0,0.82)',
};

const Orders: React.FC = () => {
  const { data, isLoading, error, refetch } = useOrders();

  const rows = useMemo(() => data ?? [], [data]);

  return (
    <div style={containerStyle}>
      <div style={headerRowStyle}>
        <h1 style={titleStyle}>订单</h1>
        <button type="button" style={buttonStyle} onClick={refetch} aria-label="刷新订单列表">
          刷新
        </button>
      </div>

      {isLoading ? (
        <div style={cardStyle}>
          <div style={emptyStateStyle}>加载中...</div>
        </div>
      ) : error ? (
        <div style={errorBoxStyle} role="alert" aria-live="polite">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>加载失败</div>
          <div style={{ marginBottom: 12, color: 'rgba(0,0,0,0.65)' }}>
            {error.message || '请稍后重试。'}
          </div>
          <button type="button" style={buttonStyle} onClick={refetch}>
            重试
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div style={cardStyle}>
          <div style={emptyStateStyle}>暂无订单</div>
        </div>
      ) : (
        <div style={cardStyle}>
          <table style={tableStyle} aria-label="订单列表">
            <thead>
              <tr>
                <th scope="col" style={thStyle}>
                  订单号
                </th>
                <th scope="col" style={thStyle}>
                  下单时间
                </th>
                <th scope="col" style={thStyle}>
                  状态
                </th>
                <th scope="col" style={{ ...thStyle, textAlign: 'right' }}>
                  金额
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((order) => (
                <tr key={order.id}>
                  <td style={tdStyle}>{order.number}</td>
                  <td style={tdStyle}>{formatDateTime(order.createdAt)}</td>
                  <td style={tdStyle}>
                    <span style={statusPillStyle(order.status)}>{getStatusLabel(order.status)}</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(order.totalAmount, order.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Orders;