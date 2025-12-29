import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import { useUserStore } from '../store/userStore';

interface FormData {
  name: string;
  phone: string;
  address: string;
  city: string;
  zipCode: string;
  paymentMethod: 'credit' | 'debit' | 'cash';
}

interface FormErrors {
  name?: string;
  phone?: string;
  address?: string;
  city?: string;
  zipCode?: string;
}

export const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const { items, total, clearCart } = useCart();
  const { user } = useUserStore();

  const [formData, setFormData] = useState<FormData>({
    name: user?.name || '',
    phone: '',
    address: '',
    city: '',
    zipCode: '',
    paymentMethod: 'credit',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = '请输入姓名';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = '请输入电话号码';
    } else if (!/^1[3-9]\d{9}$/.test(formData.phone)) {
      newErrors.phone = '请输入有效的手机号码';
    }

    if (!formData.address.trim()) {
      newErrors.address = '请输入详细地址';
    }

    if (!formData.city.trim()) {
      newErrors.city = '请输入城市';
    }

    if (!formData.zipCode.trim()) {
      newErrors.zipCode = '请输入邮政编码';
    } else if (!/^\d{6}$/.test(formData.zipCode)) {
      newErrors.zipCode = '请输入有效的邮政编码';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      const orderData = {
        items,
        total,
        shippingInfo: {
          name: formData.name,
          phone: formData.phone,
          address: formData.address,
          city: formData.city,
          zipCode: formData.zipCode,
        },
        paymentMethod: formData.paymentMethod,
        orderDate: new Date().toISOString(),
      };

      console.log('订单提交成功:', orderData);

      clearCart();
      navigate('/order-success');
    } catch (error) {
      console.error('订单提交失败:', error);
      alert('订单提交失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">购物车为空</h2>
        <p className="text-gray-600 mb-8">请先添加商品到购物车</p>
        <button
          onClick={() => navigate('/products')}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          去购物
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">结算</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">收货信息</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  收货人姓名 *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="请输入收货人姓名"
                />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  联系电话 *
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.phone ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="请输入手机号码"
                />
                {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
              </div>

              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                  城市 *
                </label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.city ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="请输入城市"
                />
                {errors.city && <p className="mt-1 text-sm text-red-600">{errors.city}</p>}
              </div>

              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                  详细地址 *
                </label>
                <textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  rows={3}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.address ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="请输入详细地址"
                />
                {errors.address && <p className="mt-1 text-sm text-red-600">{errors.address}</p>}
              </div>

              <div>
                <label htmlFor="zipCode" className="block text-sm font-medium text-gray-700 mb-1">
                  邮政编码 *
                </label>
                <input
                  type="text"
                  id="zipCode"
                  name="zipCode"
                  value={formData.zipCode}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.zipCode ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="请输入邮政编码"
                />
                {errors.zipCode && <p className="mt-1 text-sm text-red-600">{errors.zipCode}</p>}
              </div>
            </div>

            <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-6">支付方式</h2>

            <div className="space-y-3">
              <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="credit"
                  checked={formData.paymentMethod === 'credit'}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="ml-3 text-gray-700">信用卡</span>
              </label>

              <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="debit"
                  checked={formData.paymentMethod === 'debit'}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="ml-3 text-gray-700">借记卡</span>
              </label>

              <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="cash"
                  checked={formData.paymentMethod === 'cash'}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="ml-3 text-gray-700">货到付款</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-8 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '提交中...' : '提交订单'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">订单摘要</h2>

            <div className="space-y-4 mb-6">
              {items.map(item => (
                <div key={item.id} className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-gray-800 font-medium">{item.name}</p>
                    <p className="text-sm text-gray-600">数量: {item.quantity}</p>
                  </div>
                  <p className="text-gray-800 font-semibold">
                    ¥{(item.price * item.quantity).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">小计</span>
                <span className="text-gray-800">¥{total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">运费</span>
                <span className="text-gray-800">¥0.00</span>
              </div>
              <div className="flex justify-between items-center pt-4 border-t">
                <span className="text-lg font-semibold text-gray-800">总计</span>
                <span className="text-2xl font-bold text-blue-600">¥{total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};