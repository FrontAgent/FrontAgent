import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ordersApi } from '../api/ordersApi';

type Params = {
  orderId?: string;
};

type AsyncState<T> =
  | { status: 'idle' | 'loading'; data?: undefined; error?: undefined }
  | { status: 'success'; data: T; error?: undefined }
  | { status: 'error'; data?: undefined; error: unknown };

export const OrderDetailPage: React.FC = () => {
  const { orderId } = useParams<Params>();
  const navigate = useNavigate();

  const [state, setState] = useState<AsyncState<unknown>>({ status: 'idle' });

  const normalizedOrderId = useMemo(() => (orderId ?? '').trim(), [orderId]);

  const fetchDetail = useCallback(async (id: string) => {
    setState({ status: 'loading' });
    try {
      const data = await ordersApi.detail(id);
      setState({ status: 'success', data });
    } catch (error) {
      setState({ status: 'error', error });
    }
  }, []);

  useEffect(() => {
    if (!normalizedOrderId) return;
    void fetchDetail(normalizedOrderId);
  }, [fetchDetail, normalizedOrderId]);

  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  if (!normalizedOrderId) {
    return (
      <div className="page order-detail-page">
        <header className="page-header">
          <h1>订单详情</h1>
          <div className="page-actions">
            <button type="button" onClick={handleBack}>
              返回
            </button>
            <Link to="/orders">返回订单列表</Link>
          </div>
        </header>
        <main className="page-content">
          <div role="status">empty: 缺少 orderId</div>
        </main>
      </div>
    );
  }

  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <div className="page order-detail-page">
        <header className="page-header">
          <h1>订单详情</h1>
          <div className="page-actions">
            <button type="button" onClick={handleBack}>
              返回
            </button>
            <Link to="/orders">返回订单列表</Link>
          </div>
        </header>
        <main className="page-content">
          <div role="status" aria-busy="true">
            loading...
          </div>
        </main>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="page order-detail-page">
        <header className="page-header">
          <h1>订单详情</h1>
          <div className="page-actions">
            <button type="button" onClick={handleBack}>
              返回
            </button>
            <Link to="/orders">返回订单列表</Link>
          </div>
        </header>
        <main className="page-content">
          <div role="alert">error: 获取订单详情失败</div>
          <div style={{ marginTop: 12 }}>
            <button type="button" onClick={() => void fetchDetail(normalizedOrderId)}>
              重试
            </button>
          </div>
        </main>
      </div>
    );
  }

  const detail = state.data;

  if (detail == null) {
    return (
      <div className="page order-detail-page">
        <header className="page-header">
          <h1>订单详情</h1>
          <div className="page-actions">
            <button type="button" onClick={handleBack}>
              返回
            </button>
            <Link to="/orders">返回订单列表</Link>
          </div>
        </header>
        <main className="page-content">
          <div role="status">empty: 无订单数据</div>
        </main>
      </div>
    );
  }

  return (
    <div className="page order-detail-page">
      <header className="page-header">
        <h1>订单详情</h1>
        <div className="page-actions">
          <button type="button" onClick={handleBack}>
            返回
          </button>
          <Link to="/orders">返回订单列表</Link>
        </div>
      </header>

      <main className="page-content">
        <section className="order-summary" aria-label="订单摘要">
          <h2>摘要</h2>
          <div>
            <div>
              <span>订单号：</span>
              <span>{normalizedOrderId}</span>
            </div>
            <div>
              <span>数据：</span>
              <pre style={{ margin: '8px 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {JSON.stringify(detail, null, 2)}
              </pre>
            </div>
          </div>
        </section>

        <section className="shipping-info" aria-label="收货信息">
          <h2>收货信息</h2>
          <div>占位：收货人/地址/电话</div>
        </section>

        <section className="order-items" aria-label="商品项列表">
          <h2>商品</h2>
          <div>占位：商品项列表</div>
        </section>
      </main>
    </div>
  );
};

export default OrderDetailPage;