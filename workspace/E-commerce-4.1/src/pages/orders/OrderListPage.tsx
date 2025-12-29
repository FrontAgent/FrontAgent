import React, { useEffect, useMemo, useState } from 'react';

type OrderStatus = 'all' | 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled';

type Order = {
  id: string;
  orderNo: string;
  createdAt: string; // ISO
  status: Exclude<OrderStatus, 'all'>;
  customerName: string;
  itemsCount: number;
  totalAmount: number; // in cents
  currency: string;
};

type FilterState = {
  status: OrderStatus;
  timeRange: 'all' | '7d' | '30d' | '90d' | 'custom';
};

const formatMoney = (amountCents: number, currency: string) => {
  const amount = amountCents / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d);
};

const getStatusMeta = (status: Order['status']) => {
  switch (status) {
    case 'pending':
      return { label: '待支付', className: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'paid':
      return { label: '已支付', className: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'shipped':
      return { label: '已发货', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    case 'completed':
      return { label: '已完成', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'cancelled':
      return { label: '已取消', className: 'bg-zinc-50 text-zinc-700 border-zinc-200' };
    default:
      return { label: status, className: 'bg-zinc-50 text-zinc-700 border-zinc-200' };
  }
};

const generateMockOrders = (): Order[] => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const statuses: Order['status'][] = ['pending', 'paid', 'shipped', 'completed', 'cancelled'];
  const names = ['张三', '李四', '王五', '赵六', '孙七', '周八', '吴九', '郑十'];

  const orders: Order[] = Array.from({ length: 37 }).map((_, idx) => {
    const status = statuses[idx % statuses.length];
    const createdAt = new Date(now - (idx * 1.7 + 1) * day).toISOString();
    const orderNo = `NO${new Date(now - idx * day).getFullYear()}${String(100000 + idx)}`;
    const itemsCount = (idx % 5) + 1;
    const totalAmount = (itemsCount * 1999 + (idx % 7) * 399) * 10;
    return {
      id: `order_${idx + 1}`,
      orderNo,
      createdAt,
      status,
      customerName: names[idx % names.length],
      itemsCount,
      totalAmount,
      currency: 'CNY'
    };
  });

  return orders;
};

const SkeletonRow: React.FC = () => {
  return (
    <div className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-zinc-100">
      <div className="col-span-4">
        <div className="h-4 w-40 bg-zinc-200 rounded animate-pulse" />
        <div className="mt-2 h-3 w-28 bg-zinc-200 rounded animate-pulse" />
      </div>
      <div className="col-span-2 flex items-center">
        <div className="h-6 w-20 bg-zinc-200 rounded-full animate-pulse" />
      </div>
      <div className="col-span-2 flex items-center">
        <div className="h-4 w-20 bg-zinc-200 rounded animate-pulse" />
      </div>
      <div className="col-span-2 flex items-center">
        <div className="h-4 w-16 bg-zinc-200 rounded animate-pulse" />
      </div>
      <div className="col-span-2 flex items-center justify-end">
        <div className="h-9 w-20 bg-zinc-200 rounded animate-pulse" />
      </div>
    </div>
  );
};

const EmptyState: React.FC<{ title?: string; description?: string; onReset?: () => void }> = ({
  title = '暂无订单',
  description = '当前筛选条件下没有找到订单。',
  onReset
}) => {
  return (
    <div className="py-16 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500">
        <span className="text-lg font-semibold">∅</span>
      </div>
      <div className="mt-4 text-zinc-900 font-medium">{title}</div>
      <div className="mt-2 text-sm text-zinc-500">{description}</div>
      {onReset ? (
        <button
          type="button"
          onClick={onReset}
          className="mt-6 inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
        >
          重置筛选
        </button>
      ) : null}
    </div>
  );
};

const PaginationPlaceholder: React.FC<{ page: number; pageSize: number; total: number }> = ({ page, pageSize, total }) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="text-sm text-zinc-600">
        第 <span className="font-medium text-zinc-900">{page}</span> / {totalPages} 页 · 共{' '}
        <span className="font-medium text-zinc-900">{total}</span> 条
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled
          className="px-3 py-2 text-sm rounded-md border border-zinc-200 bg-white text-zinc-400 cursor-not-allowed"
        >
          上一页
        </button>
        <button
          type="button"
          disabled
          className="px-3 py-2 text-sm rounded-md border border-zinc-200 bg-white text-zinc-400 cursor-not-allowed"
        >
          下一页
        </button>
      </div>
    </div>
  );
};

const OrderListPage: React.FC = () => {
  // TODO: 接入 API。当前使用 mock state。
  const [loading, setLoading] = useState<boolean>(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filters, setFilters] = useState<FilterState>({ status: 'all', timeRange: 'all' });

  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    const t = window.setTimeout(() => {
      if (!alive) return;
      setOrders(generateMockOrders());
      setLoading(false);
    }, 700);

    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filters.status, filters.timeRange]);

  const filteredOrders = useMemo(() => {
    const byStatus =
      filters.status === 'all' ? orders : orders.filter((o) => o.status === filters.status);

    const byTime = (() => {
      if (filters.timeRange === 'all') return byStatus;

      const now = Date.now();
      const days =
        filters.timeRange === '7d' ? 7 : filters.timeRange === '30d' ? 30 : filters.timeRange === '90d' ? 90 : null;

      if (days == null) return byStatus; // 'custom' placeholder
      const cutoff = now - days * 24 * 60 * 60 * 1000;
      return byStatus.filter((o) => new Date(o.createdAt).getTime() >= cutoff);
    })();

    return byTime;
  }, [orders, filters.status, filters.timeRange]);

  const pagedOrders = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, page, pageSize]);

  const resetFilters = () => setFilters({ status: 'all', timeRange: 'all' });

  return (
    <div className="w-full">
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-zinc-900">订单列表</h1>
            <p className="mt-1 text-sm text-zinc-500">查看与管理订单（筛选、列表、分页占位）。</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLoading(true)}
              className="px-3 py-2 text-sm rounded-md border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
              title="仅用于演示"
            >
              模拟加载
            </button>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                window.setTimeout(() => setLoading(false), 600);
              }}
              className="px-3 py-2 text-sm rounded-md bg-zinc-900 text-white hover:bg-zinc-800"
              title="仅用于演示"
            >
              刷新
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-zinc-200 bg-white">
          <div className="px-4 py-4 border-b border-zinc-200">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-zinc-700" htmlFor="status">
                  状态
                </label>
                <select
                  id="status"
                  value={filters.status}
                  onChange={(e) => setFilters((s) => ({ ...s, status: e.target.value as OrderStatus }))}
                  className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                >
                  <option value="all">全部</option>
                  <option value="pending">待支付</option>
                  <option value="paid">已支付</option>
                  <option value="shipped">已发货</option>
                  <option value="completed">已完成</option>
                  <option value="cancelled">已取消</option>
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-zinc-700" htmlFor="timeRange">
                  时间（占位）
                </label>
                <select
                  id="timeRange"
                  value={filters.timeRange}
                  onChange={(e) =>
                    setFilters((s) => ({ ...s, timeRange: e.target.value as FilterState['timeRange'] }))
                  }
                  className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                >
                  <option value="all">不限</option>
                  <option value="7d">近 7 天</option>
                  <option value="30d">近 30 天</option>
                  <option value="90d">近 90 天</option>
                  <option value="custom">自定义（占位）</option>
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-zinc-700" htmlFor="pageSize">
                  每页条数（占位）
                </label>
                <select
                  id="pageSize"
                  value={String(pageSize)}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                </select>
              </div>

              <div className="md:col-span-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="w-full md:w-auto px-4 py-2 text-sm rounded-md border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
                >
                  重置
                </button>
                <button
                  type="button"
                  onClick={() => setPage(1)}
                  className="w-full md:w-auto px-4 py-2 text-sm rounded-md bg-zinc-900 text-white hover:bg-zinc-800"
                >
                  应用（占位）
                </button>
              </div>
            </div>

            <div className="mt-3 text-xs text-zinc-500">
              TODO：接入 API，支持按状态/时间/关键词筛选与分页查询。
            </div>
          </div>

          <div className="hidden sm:grid grid-cols-12 gap-3 px-4 py-3 text-xs font-medium text-zinc-500 border-b border-zinc-200 bg-zinc-50">
            <div className="col-span-4">订单</div>
            <div className="col-span-2">状态</div>
            <div className="col-span-2">客户</div>
            <div className="col-span-2">金额</div>
            <div className="col-span-2 text-right">操作</div>
          </div>

          <div>
            {loading ? (
              <div>
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </div>
            ) : pagedOrders.length === 0 ? (
              <EmptyState onReset={resetFilters} />
            ) : (
              <div>
                {pagedOrders.map((o) => {
                  const meta = getStatusMeta(o.status);
                  return (
                    <div
                      key={o.id}
                      className="px-4 py-4 border-b border-zinc-100 hover:bg-zinc-50 transition-colors"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                        <div className="sm:col-span-4">
                          <div className="flex items-center gap-2">
                            <div className="font-medium text-zinc-900">{o.orderNo}</div>
                            <span className="text-xs text-zinc-500">#{o.id}</span>
                          </div>
                          <div className="mt-1 text-sm text-zinc-500">
                            下单时间：{formatDateTime(o.createdAt)} · 商品数：{o.itemsCount}
                          </div>
                        </div>

                        <div className="sm:col-span-2">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border ${meta.className}`}
                          >
                            {meta.label}
                          </span>
                        </div>

                        <div className="sm:col-span-2 text-sm text-zinc-700">{o.customerName}</div>

                        <div className="sm:col-span-2 text-sm font-medium text-zinc-900">
                          {formatMoney(o.totalAmount, o.currency)}
                        </div>

                        <div className="sm:col-span-2 flex items-center justify-start sm:justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              // TODO: 跳转详情页
                              window.alert(`TODO: 查看订单详情：${o.orderNo}`);
                            }}
                            className="px-3 py-2 text-sm rounded-md border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
                          >
                            查看
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              // TODO: 更多操作
                              window.alert(`TODO: 更多操作：${o.orderNo}`);
                            }}
                            className="px-3 py-2 text-sm rounded-md bg-zinc-900 text-white hover:bg-zinc-800"
                          >
                            操作
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-zinc-200 bg-white">
            <PaginationPlaceholder page={page} pageSize={pageSize} total={filteredOrders.length} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderListPage;