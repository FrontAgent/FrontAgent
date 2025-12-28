import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { useCartStore } from '../store/cartStore';

interface Address {
  id: string;
  name: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
  isDefault: boolean;
}

interface Coupon {
  id: string;
  code: string;
  discount: number;
  minAmount: number;
  type: 'fixed' | 'percentage';
  description: string;
}

const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useUserStore();
  const { items, getTotalPrice, clearCart } = useCartStore();

  const [addresses, setAddresses] = useState<Address[]>([
    {
      id: '1',
      name: '张三',
      phone: '13800138000',
      province: '广东省',
      city: '深圳市',
      district: '南山区',
      detail: '科技园路100号',
      isDefault: true,
    },
    {
      id: '2',
      name: '李四',
      phone: '13900139000',
      province: '北京市',
      city: '北京市',
      district: '朝阳区',
      detail: '建国路88号',
      isDefault: false,
    },
  ]);

  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'alipay' | 'wechat' | 'card'>('alipay');
  const [deliveryMethod, setDeliveryMethod] = useState<'standard' | 'express'>('standard');
  const [selectedCouponId, setSelectedCouponId] = useState<string>('');
  const [usePoints, setUsePoints] = useState(false);
  const [remark, setRemark] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newAddress, setNewAddress] = useState<Omit<Address, 'id' | 'isDefault'>>({
    name: '',
    phone: '',
    province: '',
    city: '',
    district: '',
    detail: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const coupons: Coupon[] = [
    { id: 'c1', code: 'NEW50', discount: 50, minAmount: 200, type: 'fixed', description: '满200减50' },
    { id: 'c2', code: 'VIP10', discount: 10, minAmount: 100, type: 'percentage', description: '满100享9折' },
  ];

  const userPoints = 500;
  const pointsValue = Math.min(userPoints, 50);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/checkout' } });
      return;
    }

    if (items.length === 0) {
      navigate('/cart');
      return;
    }

    const defaultAddress = addresses.find((addr) => addr.isDefault);
    if (defaultAddress) {
      setSelectedAddressId(defaultAddress.id);
    }
  }, [isAuthenticated, items.length, navigate, addresses]);

  const subtotal = getTotalPrice();
  const deliveryFee = deliveryMethod === 'express' ? 15 : subtotal >= 99 ? 0 : 10;

  const selectedCoupon = coupons.find((c) => c.id === selectedCouponId);
  let couponDiscount = 0;
  if (selectedCoupon && subtotal >= selectedCoupon.minAmount) {
    if (selectedCoupon.type === 'fixed') {
      couponDiscount = selectedCoupon.discount;
    } else {
      couponDiscount = subtotal * (selectedCoupon.discount / 100);
    }
  }

  const pointsDiscount = usePoints ? pointsValue : 0;
  const totalPrice = Math.max(0, subtotal + deliveryFee - couponDiscount - pointsDiscount);

  const validateAddressForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!newAddress.name.trim()) {
      errors.name = '请输入收货人姓名';
    }

    if (!newAddress.phone.trim()) {
      errors.phone = '请输入手机号码';
    } else if (!/^1[3-9]\d{9}$/.test(newAddress.phone)) {
      errors.phone = '请输入正确的手机号码';
    }

    if (!newAddress.province.trim()) {
      errors.province = '请输入省份';
    }

    if (!newAddress.city.trim()) {
      errors.city = '请输入城市';
    }

    if (!newAddress.district.trim()) {
      errors.district = '请输入区/县';
    }

    if (!newAddress.detail.trim()) {
      errors.detail = '请输入详细地址';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddAddress = () => {
    if (!validateAddressForm()) return;

    const newAddr: Address = {
      ...newAddress,
      id: Date.now().toString(),
      isDefault: addresses.length === 0,
    };

    setAddresses([...addresses, newAddr]);
    setSelectedAddressId(newAddr.id);
    setShowAddressForm(false);
    setNewAddress({
      name: '',
      phone: '',
      province: '',
      city: '',
      district: '',
      detail: '',
    });
    setFormErrors({});
  };

  const handleSubmitOrder = async () => {
    if (!selectedAddressId) {
      alert('请选择收货地址');
      return;
    }

    setIsSubmitting(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const orderId = `ORD${Date.now()}`;
      clearCart();
      navigate(`/order-success/${orderId}`);
    } catch (error) {
      alert('订单提交失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated || items.length === 0) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">确认订单</h1>

        <div className="space-y-6">
          {/* 收货地址 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">收货地址</h2>
              <button
                onClick={() => setShowAddressForm(!showAddressForm)}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                {showAddressForm ? '取消' : '+ 新增地址'}
              </button>
            </div>

            {showAddressForm && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      收货人 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newAddress.name}
                      onChange={(e) => setNewAddress({ ...newAddress, name: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.name ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="请输入收货人姓名"
                    />
                    {formErrors.name && (
                      <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      手机号码 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={newAddress.phone}
                      onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.phone ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="请输入手机号码"
                    />
                    {formErrors.phone && (
                      <p className="text-red-500 text-xs mt-1">{formErrors.phone}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      省份 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newAddress.province}
                      onChange={(e) => setNewAddress({ ...newAddress, province: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.province ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="请输入省份"
                    />
                    {formErrors.province && (
                      <p className="text-red-500 text-xs mt-1">{formErrors.province}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      城市 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newAddress.city}
                      onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.city ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="请输入城市"
                    />
                    {formErrors.city && (
                      <p className="text-red-500 text-xs mt-1">{formErrors.city}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      区/县 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newAddress.district}
                      onChange={(e) => setNewAddress({ ...newAddress, district: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.district ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="请输入区/县"
                    />
                    {formErrors.district && (
                      <p className="text-red-500 text-xs mt-1">{formErrors.district}</p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      详细地址 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newAddress.detail}
                      onChange={(e) => setNewAddress({ ...newAddress, detail: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.detail ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="请输入详细地址"
                    />
                    {formErrors.detail && (
                      <p className="text-red-500 text-xs mt-1">{formErrors.detail}</p>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleAddAddress}
                  className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  保存地址
                </button>
              </div>
            )}

            <div className="space-y-3">
              {addresses.map((address) => (
                <label
                  key={address.id}
                  className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedAddressId === address.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="address"
                    value={address.id}
                    checked={selectedAddressId === address.id}
                    onChange={() => setSelectedAddressId(address.id)}
                    className="mt-1 mr-3"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{address.name}</span>
                      <span className="text-gray-600">{address.phone}</span>
                      {address.isDefault && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded">
                          默认
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm mt-1">
                      {address.province}
                      {address.city}
                      {address.district}
                      {address.detail}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* 订单商品 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">订单商品</h2>
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-4">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-20 h-20 object-cover rounded"
                  />
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{item.name}</h3>
                    <p className="text-sm text-gray-500">数量: {item.quantity}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">¥{item.price.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 配送方式 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">配送方式</h2>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                <input
                  type="radio"
                  name="delivery"
                  value="standard"
                  checked={deliveryMethod === 'standard'}
                  onChange={() => setDeliveryMethod('standard')}
                  className="w-4 h-4 text-blue-600"
                />
                <div className="flex-1">
                  <p className="font-medium">标准配送</p>
                  <p className="text-sm text-gray-500">预计3-5天送达</p>
                </div>
                <p className="font-medium">{subtotal >= 99 ? '免费' : '¥10'}</p>
              </label>
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                <input
                  type="radio"
                  name="delivery"
                  value="express"
                  checked={deliveryMethod === 'express'}
                  onChange={() => setDeliveryMethod('express')}
                  className="w-4 h-4 text-blue-600"
                />
                <div className="flex-1">
                  <p className="font-medium">快速配送</p>
                  <p className="text-sm text-gray-500">预计1-2天送达</p>
                </div>
                <p className="font-medium">¥15</p>
              </label>
            </div>
          </div>

          {/* 支付方式 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">支付方式</h2>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                <input
                  type="radio"
                  name="payment"
                  value="alipay"
                  checked={paymentMethod === 'alipay'}
                  onChange={() => setPaymentMethod('alipay')}
                  className="w-4 h-4 text-blue-600"
                />
                <p className="font-medium">支付宝</p>
              </label>
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                <input
                  type="radio"
                  name="payment"
                  value="wechat"
                  checked={paymentMethod === 'wechat'}
                  onChange={() => setPaymentMethod('wechat')}
                  className="w-4 h-4 text-blue-600"
                />
                <p className="font-medium">微信支付</p>
              </label>
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                <input
                  type="radio"
                  name="payment"
                  value="card"
                  checked={paymentMethod === 'card'}
                  onChange={() => setPaymentMethod('card')}
                  className="w-4 h-4 text-blue-600"
                />
                <p className="font-medium">银行卡</p>
              </label>
            </div>
          </div>

          {/* 优惠券 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">优惠券</h2>
            <div className="space-y-2">
              {coupons.map((coupon) => (
                <label
                  key={coupon.id}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    subtotal >= coupon.minAmount
                      ? 'hover:border-blue-500'
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  <input
                    type="radio"
                    name="coupon"
                    value={coupon.id}
                    checked={selectedCouponId === coupon.id}
                    onChange={() => setSelectedCouponId(coupon.id)}
                    disabled={subtotal < coupon.minAmount}
                    className="w-4 h-4 text-blue-600"
                  />
                  <div className="flex-1">
                    <p className="font-medium">{coupon.description}</p>
                    <p className="text-sm text-gray-500">
                      {subtotal < coupon.minAmount && `还差¥${(coupon.minAmount - subtotal).toFixed(2)}`}
                    </p>
                  </div>
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 mt-3">
              <input
                type="checkbox"
                checked={usePoints}
                onChange={(e) => setUsePoints(e.target.checked)}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm">使用积分（{userPoints}积分可抵扣¥{pointsValue}）</span>
            </label>
          </div>

          {/* 备注 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">订单备注</h2>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="选填，对订单的补充说明"
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 价格明细 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">价格明细</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-gray-600">
                <span>商品小计</span>
                <span>¥{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>运费</span>
                <span>¥{deliveryFee.toFixed(2)}</span>
              </div>
              {couponDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>优惠券</span>
                  <span>-¥{couponDiscount.toFixed(2)}</span>
                </div>
              )}
              {pointsDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>积分抵扣</span>
                  <span>-¥{pointsDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between items-center">
                <span className="text-lg font-semibold">总计</span>
                <span className="text-2xl font-bold text-red-500">¥{totalPrice.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* 提交按钮 */}
          <button
            onClick={handleSubmitOrder}
            disabled={isSubmitting || !selectedAddressId}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white text-lg font-semibold rounded-lg hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
          >
            {isSubmitting ? '提交中...' : '提交订单'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;