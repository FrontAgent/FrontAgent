import React, { useState, useEffect } from 'react';
import { Button } from '../components/Button';
import { ProductCard } from '../components/ProductCard';
import { Product } from '../types/Product';

export const Home: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const response = await fetch('https://fakestoreapi.com/products?limit=8');
        if (!response.ok) {
          throw new Error('Failed to fetch products');
        }
        const data = await response.json();
        setProducts(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  return (
    <div>
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white py-20 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">欢迎来到我们的商城</h1>
        <p className="text-xl md:text-2xl">发现优质商品，享受购物乐趣</p>
      </div>

      <div className="container mx-auto px-4 py-12">
        <h2 className="text-3xl font-bold mb-8 text-center">热门推荐</h2>

        {loading && (
          <div className="text-center py-12">
            <p className="text-xl">Loading...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <p className="text-xl text-red-500">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            <div className="text-center">
              <Button onClick={() => window.location.href = '/products'}>
                查看更多
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};