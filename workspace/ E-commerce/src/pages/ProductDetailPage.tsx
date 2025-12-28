import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { useCartStore } from '../stores/useCartStore';
import { productsApi } from '../api/productsApi';
import type { Product } from '../api/types';

const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addItem = useCartStore((s) => s.addItem);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchProduct = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await productsApi.detail(id);
        setProduct(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const handleAddToCart = () => {
    if (!product) return;
    setAdding(true);
    addItem({
      id: `cart-${product.id}`,
      productId: product.id,
      product: {
        id: product.id,
        name: product.name,
        imageUrl: product.imageUrl,
        price: product.price,
        status: product.status,
        stock: product.stock,
      },
      quantity,
    });
    setTimeout(() => {
      setAdding(false);
      navigate('/cart');
    }, 300);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner size="lg" label="加载商品详情..." />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-red-600">{error ?? '商品不存在'}</p>
        <Button onClick={() => navigate('/products')}>返回商品列表</Button>
      </div>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <Card className="overflow-hidden">
        <div className="grid md:grid-cols-2 gap-6 p-6">
          <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-gray-400">暂无图片</span>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <h1 className="text-2xl font-bold">{product.name}</h1>

            <div className="text-3xl font-bold text-blue-600">
              {product.price?.currency ?? '¥'} {product.price?.amount?.toFixed(2) ?? '--'}
            </div>

            {product.description && (
              <p className="text-gray-600 leading-relaxed">{product.description}</p>
            )}

            <div className="flex items-center gap-4 mt-4">
              <span className="text-gray-600">数量：</span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                >
                  -
                </Button>
                <span className="w-12 text-center font-medium">{quantity}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setQuantity((q) => q + 1)}
                  disabled={product.stock !== undefined && quantity >= product.stock}
                >
                  +
                </Button>
              </div>
              {product.stock !== undefined && (
                <span className="text-sm text-gray-500">库存: {product.stock}</span>
              )}
            </div>

            <div className="flex gap-4 mt-6">
              <Button
                className="flex-1"
                onClick={handleAddToCart}
                isLoading={adding}
                disabled={adding}
              >
                加入购物车
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigate('/products')}
              >
                继续购物
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </main>
  );
};

export default ProductDetailPage;
