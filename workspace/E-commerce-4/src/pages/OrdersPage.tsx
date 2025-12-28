import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useOrderStore } from '../store/orderStore';
import { Order, OrderStatus } from '../types';

const ORDER_TABS = [
  { key: 'all', label: '全部', status: undefined },
  { key: 'pending', label: '待付款', status: 'pending' as OrderStatus },
  { key: 'paid', label: '待发货', status: 'paid' as OrderStatus },
  { key: 'shipped', label: '待收货', status: 'shipped' as OrderStatus },
  { key: 'delivered', label: '已完成', status: 'delivered' as OrderStatus },
  { key: 'cancelled', label: '已取消', status: 'cancelled' as OrderStatus },
];

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: '待付款',
  paid: '待发货',
  shipped: '待收货',
  delivered: '已完成',
  cancelled: '已取消',
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'text-orange-600 bg-orange-50',
  paid: 'text-blue-600 bg-blue-50',
  shipped: 'text-purple-600 bg-purple-50',
  delivered: 'text-green-600 bg-green-50',
  cancelled: 'text-gray-600 bg-gray-50',
};

const PAGE_SIZE = 10;

export const OrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const { orders, fetchOrders, updateOrderStatus, isLoading } = useOrderStore();
  
  const [activeTab, setActiveTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/orders' } });
      return;
    }
    fetchOrders();
  }, [isAuthenticated, navigate, fetchOrders]);

  const filteredOrders = orders.filter((order) => {
    if (activeTab === 'all') return true;
    const tab = ORDER_TABS.find((t) => t.key === activeTab);
    return tab?.status === order.status;
  });

  const totalPages = Math.ceil(filteredOrders.length / PAGE_SIZE);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleTabChange = (tabKey: string) => {
    setActiveTab(tabKey);
    setCurrentPage(1);
  };

  const handlePayment = (orderId: string) => {
    navigate(`/checkout?orderId=${orderId}`);
  };

  const handleConfirmReceive = async (orderId: string) => {
    if (window.confirm('确认已收到商品？')) {
      await updateOrderStatus(orderId, 'delivered');
    }
  };

  const handleViewDetail = (orderId: string) => {
    navigate(`/orders/${orderId}`);
  };

  const handleBuyAgain = (order: Order) => {
    order.items.forEach((item) => {
      navigate(`/products/${item.productId}`);
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderOrderActions = (order: Order) => {
    const actions: React.ReactNode[] = [];

    if (order.status === 'pending') {
      actions.push(
        <button
          key="pay"
          onClick={() => handlePayment(order.id)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          立即付款
        </button>
      );
    }

    if (order.status === 'shipped') {
      actions.push(
        <button
          key="confirm"
          onClick={() => handleConfirmReceive(order.id)}
          className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
        >
          确认收货
        </button>
      );
    }

    if (order.status === 'delivered') {
      actions.push(
        <button
          key="buyAgain"
          onClick={() => handleBuyAgain(order)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          再次购买
        </button>
      );
    }

    actions.push(
      <button
        key="detail"
        onClick={() => handleViewDetail(order.id)}
        className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
      >
        查看详情
      </button>
    );

    return actions;
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">我的订单</h1>

        {/* 订单状态Tab */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="flex border-b overflow-x-auto">
            {ORDER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 订单列表 */}
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : paginatedOrders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="text-gray-400 mb-4">
              <svg
                className="w-20 h-20 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <p className="text-gray-500 text-lg mb-4">暂无订单</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              去逛逛
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {paginatedOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-lg shadow-sm overflow-hidden"
              >
                {/* 订单头部 */}
                <div className="px-6 py-4 bg-gray-50 border-b flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-6 text-sm">
                    <span className="text-gray-500">
                      订单号：<span className="text-gray-900">{order.id}</span>
                    </span>
                    <span className="text-gray-500">
                      下单时间：{formatDate(order.createdAt)}
                    </span>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      STATUS_COLORS[order.status]
                    }`}
                  >
                    {STATUS_LABELS[order.status]}
                  </span>
                </div>

                {/* 商品列表 */}
                <div className="px-6 py-4">
                  {order.items.map((item, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-4 ${
                        index > 0 ? 'mt-4 pt-4 border-t' : ''
                      }`}
                    >
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-gray-900 font-medium truncate">
                          {item.name}
                        </h3>
                        <p className="text-gray-500 text-sm mt-1">
                          数量：{item.quantity}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-900 font-medium">
                          ¥{item.price.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 订单底部 */}
                <div className="px-6 py-4 bg-gray-50 border-t flex flex-wrap items-center justify-between gap-4">
                  <div className="text-sm">
                    <span className="text-gray-500">共 {order.items.length} 件商品</span>
                    <span className="mx-2 text-gray-300">|</span>
                    <span className="text-gray-500">
                      实付款：
                      <span className="text-lg font-bold text-red-600">
                        ¥{order.totalAmount.toFixed(2)}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {renderOrderActions(order)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="mt-8 flex justify-center items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              上一页
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-10 h-10 rounded-lg text-sm transition-colors ${
                    currentPage === page
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 border rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              下一页
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrdersPage;