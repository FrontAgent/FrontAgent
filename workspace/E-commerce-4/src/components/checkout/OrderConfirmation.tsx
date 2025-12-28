import React from 'react';
import { Link } from 'react-router-dom';

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

interface ShippingAddress {
  name: string;
  phone: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
}

interface OrderConfirmationProps {
  orderId: string;
  orderItems: OrderItem[];
  shippingAddress: ShippingAddress;
  paymentMethod: string;
  subtotal: number;
  shippingFee: number;
  discount?: number;
  total: number;
  estimatedDelivery?: string;
}

export const OrderConfirmation: React.FC<OrderConfirmationProps> = ({
  orderId,
  orderItems,
  shippingAddress,
  paymentMethod,
  subtotal,
  shippingFee,
  discount = 0,
  total,
  estimatedDelivery = '3-5个工作日',
}) => {
  const formatPrice = (price: number) => {
    return `¥${price.toFixed(2)}`;
  };

  const getPaymentMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      alipay: '支付宝',
      wechat: '微信支付',
      card: '银行卡',
      cod: '货到付款',
    };
    return methods[method] || method;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* 成功提示 */}
        <div className="bg-white rounded-lg shadow-sm p-8 text-center mb-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-10 h-10 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            订单提交成功！
          </h1>
          <p className="text-gray-600 mb-4">
            感谢您的购买，我们将尽快为您发货
          </p>
          <div className="inline-flex items-center bg-gray-100 rounded-lg px-4 py-2">
            <span className="text-gray-600 mr-2">订单编号：</span>
            <span className="font-mono font-semibold text-gray-900">{orderId}</span>
          </div>
        </div>

        {/* 预计送达时间 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <svg
              className="w-5 h-5 text-blue-500 mr-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-blue-700">
              预计送达时间：<strong>{estimatedDelivery}</strong>
            </span>
          </div>
        </div>

        {/* 订单详情 */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">订单详情</h2>
          </div>

          {/* 商品列表 */}
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-500 mb-3">商品信息</h3>
            <div className="space-y-3">
              {orderItems.map((item) => (
                <div key={item.id} className="flex items-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <svg
                          className="w-8 h-8"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="text-sm font-medium text-gray-900">{item.name}</p>
                    <p className="text-sm text-gray-500">x{item.quantity}</p>
                  </div>
                  <div className="text-sm font-medium text-gray-900">
                    {formatPrice(item.price * item.quantity)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 收货地址 */}
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-500 mb-2">收货地址</h3>
            <div className="text-sm text-gray-900">
              <p className="font-medium">
                {shippingAddress.name} {shippingAddress.phone}
              </p>
              <p className="text-gray-600 mt-1">
                {shippingAddress.province} {shippingAddress.city}{' '}
                {shippingAddress.address} {shippingAddress.postalCode}
              </p>
            </div>
          </div>

          {/* 支付方式 */}
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-500 mb-2">支付方式</h3>
            <p className="text-sm text-gray-900">
              {getPaymentMethodLabel(paymentMethod)}
            </p>
          </div>

          {/* 订单金额 */}
          <div className="px-6 py-4 bg-gray-50">
            <h3 className="text-sm font-medium text-gray-500 mb-3">订单金额</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">商品小计</span>
                <span className="text-gray-900">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">运费</span>
                <span className="text-gray-900">
                  {shippingFee === 0 ? '免运费' : formatPrice(shippingFee)}
                </span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">优惠</span>
                  <span className="text-red-500">-{formatPrice(discount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="font-medium text-gray-900">实付金额</span>
                <span className="text-xl font-bold text-red-500">
                  {formatPrice(total)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/"
            className="flex-1 px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium text-center hover:bg-gray-50 transition-colors"
          >
            返回首页
          </Link>
          <Link
            to="/products"
            className="flex-1 px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium text-center hover:bg-gray-50 transition-colors"
          >
            继续购物
          </Link>
          <Link
            to={`/orders/${orderId}`}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium text-center hover:bg-blue-700 transition-colors"
          >
            查看订单详情
          </Link>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmation;