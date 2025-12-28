import React, { useState } from 'react';
import { PaymentMethod } from './PaymentMethod';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

interface Address {
  id: string;
  name: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
  isDefault?: boolean;
}

interface ShippingMethod {
  id: string;
  name: string;
  price: number;
  estimatedDays: string;
}

interface CheckoutFormProps {
  cartItems?: CartItem[];
  savedAddresses?: Address[];
  onSubmit?: (orderData: OrderData) => void;
  isLoading?: boolean;
}

interface OrderData {
  items: CartItem[];
  address: Address;
  shippingMethod: string;
  paymentMethod: string;
  note: string;
  couponCode: string;
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
}

interface FormErrors {
  address?: string;
  shipping?: string;
  payment?: string;
  name?: string;
  phone?: string;
  province?: string;
  city?: string;
  district?: string;
  detail?: string;
}

const defaultCartItems: CartItem[] = [
  { id: '1', name: '商品示例 1', price: 299, quantity: 2 },
  { id: '2', name: '商品示例 2', price: 199, quantity: 1 },
];

const defaultAddresses: Address[] = [
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
];

const shippingMethods: ShippingMethod[] = [
  { id: 'standard', name: '标准配送', price: 10, estimatedDays: '3-5天' },
  { id: 'express', name: '快速配送', price: 20, estimatedDays: '1-2天' },
  { id: 'free', name: '免费配送', price: 0, estimatedDays: '5-7天' },
];

export const CheckoutForm: React.FC<CheckoutFormProps> = ({
  cartItems = defaultCartItems,
  savedAddresses = defaultAddresses,
  onSubmit,
  isLoading = false,
}) => {
  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    savedAddresses.find((a) => a.isDefault)?.id || ''
  );
  const [useNewAddress, setUseNewAddress] = useState(savedAddresses.length === 0);
  const [newAddress, setNewAddress] = useState<Omit<Address, 'id'>>({
    name: '',
    phone: '',
    province: '',
    city: '',
    district: '',
    detail: '',
  });
  const [selectedShipping, setSelectedShipping] = useState<string>('standard');
  const [selectedPayment, setSelectedPayment] = useState<string>('');
  const [note, setNote] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [errors, setErrors] = useState<FormErrors>({});

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingFee = shippingMethods.find((m) => m.id === selectedShipping)?.price || 0;
  const total = subtotal + shippingFee - discount;

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (useNewAddress) {
      if (!newAddress.name.trim()) newErrors.name = '请输入收货人姓名';
      if (!newAddress.phone.trim()) newErrors.phone = '请输入联系电话';
      else if (!/^1[3-9]\d{9}$/.test(newAddress.phone)) newErrors.phone = '请输入有效的手机号';
      if (!newAddress.province.trim()) newErrors.province = '请输入省份';
      if (!newAddress.city.trim()) newErrors.city = '请输入城市';
      if (!newAddress.district.trim()) newErrors.district = '请输入区县';
      if (!newAddress.detail.trim()) newErrors.detail = '请输入详细地址';
    } else if (!selectedAddressId) {
      newErrors.address = '请选择收货地址';
    }

    if (!selectedShipping) {
      newErrors.shipping = '请选择配送方式';
    }

    if (!selectedPayment) {
      newErrors.payment = '请选择支付方式';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleApplyCoupon = () => {
    if (couponCode.toUpperCase() === 'SAVE10') {
      setDiscount(subtotal * 0.1);
      setAppliedCoupon(couponCode);
    } else if (couponCode.toUpperCase() === 'SAVE50') {
      setDiscount(50);
      setAppliedCoupon(couponCode);
    } else {
      alert('无效的优惠码');
    }
  };

  const handleRemoveCoupon = () => {
    setDiscount(0);
    setAppliedCoupon(null);
    setCouponCode('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const address = useNewAddress
      ? { ...newAddress, id: 'new' }
      : savedAddresses.find((a) => a.id === selectedAddressId)!;

    const orderData: OrderData = {
      items: cartItems,
      address,
      shippingMethod: selectedShipping,
      paymentMethod: selectedPayment,
      note,
      couponCode: appliedCoupon || '',
      subtotal,
      shippingFee,
      discount,
      total,
    };

    onSubmit?.(orderData);
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">确认订单</h1>

      {/* 订单商品摘要 */}
      <section className="bg-white rounded-lg shadow p-4 md:p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">订单商品</h2>
        <div className="space-y-4">
          {cartItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0"
            >
              <div className="w-16 h-16 bg-gray-200 rounded-md flex items-center justify-center flex-shrink-0">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover rounded-md"
                  />
                ) : (
                  <span className="text-gray-400 text-xs">暂无图片</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-900 truncate">{item.name}</h3>
                <p className="text-sm text-gray-500">数量: {item.quantity}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  ¥{(item.price * item.quantity).toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">¥{item.price.toFixed(2)}/件</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 收货地址 */}
      <section className="bg-white rounded-lg shadow p-4 md:p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">收货地址</h2>

        {savedAddresses.length > 0 && (
          <div className="mb-4">
            <label className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                checked={useNewAddress}
                onChange={(e) => setUseNewAddress(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">使用新地址</span>
            </label>

            {!useNewAddress && (
              <div className="space-y-2">
                {savedAddresses.map((address) => (
                  <label
                    key={address.id}
                    className={`block p-4 border rounded-lg cursor-pointer transition-colors ${
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
                      onChange={(e) => setSelectedAddressId(e.target.value)}
                      className="sr-only"
                    />
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          {address.name}
                          <span className="ml-3 text-gray-600">{address.phone}</span>
                          {address.isDefault && (
                            <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                              默认
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {address.province}
                          {address.city}
                          {address.district}
                          {address.detail}
                        </p>
                      </div>
                    </div>
                  </label>
                ))}
                {errors.address && <p className="text-sm text-red-500 mt-1">{errors.address}</p>}
              </div>
            )}
          </div>
        )}

        {useNewAddress && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">收货人姓名</label>
              <input
                type="text"
                value={newAddress.name}
                onChange={(e) => setNewAddress({ ...newAddress, name: e.target.value })}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="请输入收货人姓名"
              />
              {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">联系电话</label>
              <input
                type="tel"
                value={newAddress.phone}
                onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.phone ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="请输入联系电话"
              />
              {errors.phone && <p className="text-sm text-red-500 mt-1">{errors.phone}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">省份</label>
              <input
                type="text"
                value={newAddress.province}
                onChange={(e) => setNewAddress({ ...newAddress, province: e.target.value })}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.province ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="请输入省份"
              />
              {errors.province && <p className="text-sm text-red-500 mt-1">{errors.province}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">城市</label>
              <input
                type="text"
                value={newAddress.city}
                onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.city ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="请输入城市"
              />
              {errors.city && <p className="text-sm text-red-500 mt-1">{errors.city}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">区县</label>
              <input
                type="text"
                value={newAddress.district}
                onChange={(e) => setNewAddress({ ...newAddress, district: e.target.value })}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.district ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="请输入区县"
              />
              {errors.district && <p className="text-sm text-red-500 mt-1">{errors.district}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">详细地址</label>
              <input
                type="text"
                value={newAddress.detail}
                onChange={(e) => setNewAddress({ ...newAddress, detail: e.target.value })}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.detail ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="请输入详细地址（街道、门牌号等）"
              />
              {errors.detail && <p className="text-sm text-red-500 mt-1">{errors.detail}</p>}
            </div>
          </div>
        )}
      </section>

      {/* 配送方式 */}
      <section className="bg-white rounded-lg shadow p-4 md:p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">配送方式</h2>
        <div className="space-y-2">
          {shippingMethods.map((method) => (
            <label
              key={method.id}
              className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedShipping === method.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="shipping"
                  value={method.id}
                  checked={selectedShipping === method.id}
                  onChange={(e) => setSelectedShipping(e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <div>
                  <p className="font-medium text-gray-900">{method.name}</p>
                  <p className="text-sm text-gray-500">预计 {method.estimatedDays} 送达</p>
                </div>
              </div>
              <p className="text-lg font-semibold text-gray-900">
                {method.price === 0 ? '免费' : `¥${method.price.toFixed(2)}`}
              </p>
            </label>
          ))}
          {errors.shipping && <p className="text-sm text-red-500 mt-1">{errors.shipping}</p>}
        </div>
      </section>

      {/* 支付方式 */}
      <section className="bg-white rounded-lg shadow p-4 md:p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">支付方式</h2>
        <PaymentMethod
          selectedMethod={selectedPayment}
          onChange={setSelectedPayment}
        />
        {errors.payment && <p className="text-sm text-red-500 mt-1">{errors.payment}</p>}
      </section>

      {/* 优惠券和备注 */}
      <section className="bg-white rounded-lg shadow p-4 md:p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">优惠券</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                disabled={!!appliedCoupon}
                placeholder="请输入优惠券代码"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
              {appliedCoupon ? (
                <button
                  type="button"
                  onClick={handleRemoveCoupon}
                  className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                >
                  移除
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  disabled={!couponCode.trim()}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  使用
                </button>
              )}
            </div>
            {appliedCoupon && (
              <p className="text-sm text-green-600 mt-1">已使用优惠券: {appliedCoupon}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">订单备注</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="选填：对订单的补充说明"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
      </section>

      {/* 价格汇总 */}
      <section className="bg-white rounded-lg shadow p-4 md:p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">价格明细</h2>
        <div className="space-y-3">
          <div className="flex justify-between text-gray-600">
            <span>商品小计</span>
            <span>¥{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>配送费用</span>
            <span>¥{shippingFee.toFixed(2)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>优惠金额</span>
              <span>-¥{discount.toFixed(2)}</span>
            </div>
          )}
          <div className="border-t pt-3 flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-900">应付总额</span>
            <span className="text-2xl font-bold text-red-500">¥{total.toFixed(2)}</span>
          </div>
        </div>
      </section>

      {/* 提交按钮 */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white text-lg font-semibold rounded-lg hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
      >
        {isLoading ? '提交中...' : '提交订单'}
      </button>
    </form>
  );
};