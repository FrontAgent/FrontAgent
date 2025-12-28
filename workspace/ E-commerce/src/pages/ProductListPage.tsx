import React, { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { useProductsStore } from '../stores/useProductsStore';

const ProductListPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';

  const { products, loading, error, fetchProducts } = useProductsStore();

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const filteredProducts = query
    ? products.filter((p) =>
        `${p.name} ${p.description ?? ''}`.toLowerCase().includes(query.toLowerCase())
      )
    : products;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner size="lg" label="加载商品列表..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-red-600">{error}</p>
        <Button onClick={() => fetchProducts({ force: true })}>重试</Button>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">商品列表</h1>
        {query && (
          <p className="text-gray-600">
            搜索 "{query}" 找到 {filteredProducts.length} 件商品
          </p>
        )}
      </div>

      {filteredProducts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">暂无商品</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="overflow-hidden">
              <div className="aspect-square bg-gray-100 flex items-center justify-center">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-gray-400 text-sm">暂无图片</span>
                )}
              </div>
              <div className="p-4 flex flex-col gap-2">
                <h3 className="font-medium line-clamp-2 min-h-[2.5rem]">{product.name}</h3>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-blue-600">
                    {product.price?.currency ?? '¥'} {product.price?.amount?.toFixed(2) ?? '--'}
                  </span>
                  <Link to={`/products/${product.id}`}>
                    <Button size="sm">查看详情</Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
};

export default ProductListPage;
