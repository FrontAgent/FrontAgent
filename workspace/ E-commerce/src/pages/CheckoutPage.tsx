import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useCartStore } from '../stores/useCartStore';
import { useAuthStore } from '../stores/useAuthStore';

type FormData = {
  name: string;
  phone: string;
  address: string;
};

const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { items, getTotal, clear } = useCartStore();
  const user = useAuthStore((s) => s.user);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    phone: '',
    address: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = getTotal();

  const handleChange = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.phone || !formData.address) {
      setError('请填写完整的收货信息');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 模拟提交订单
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 清空购物车
      clear();

      // 跳转到订单列表
      navigate('/orders');
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交订单失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-gray-500">购物车为空，无法结算</p>
        <Button onClick={() => navigate('/products')}>去购物</Button>
      </div>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">结算</h1>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">收货信息</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  收货人姓名
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={handleChange('name')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入收货人姓名"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  联系电话
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange('phone')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入联系电话"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  详细地址
                </label>
                <textarea
                  value={formData.address}
                  onChange={handleChange('address')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入详细收货地址"
                />
              </div>

              {error && (
                <p className="text-red-600 text-sm">{error}</p>
              )}

              <Button
                type="submit"
                isLoading={submitting}
                disabled={submitting}
                className="mt-2"
              >
                {submitting ? '提交中...' : '提交订单'}
              </Button>
            </form>
          </Card>
        </div>

        <div>
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">订单摘要</h2>
            <div className="flex flex-col gap-3">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-600 truncate max-w-[60%]">
                    {item.product?.name ?? item.productId} x{item.quantity}
                  </span>
                  <span className="font-medium">
                    ¥{((item.product?.price?.amount ?? 0) * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="border-t pt-3 mt-2 flex justify-between font-bold">
                <span>总计</span>
                <span className="text-blue-600">¥{total.toFixed(2)}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
};

export default CheckoutPage;
