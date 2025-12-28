import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Product } from '../types/Product';
import { ProductCard } from '../components/ProductCard';

export const ProductList: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const searchQuery = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';

  const categories = [
    'electronics',
    'jewelery',
    "men's clothing",
    "women's clothing"
  ];

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('https://fakestoreapi.com/products');
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

  const filteredProducts = products.filter(product => {
    const matchesSearch = searchQuery
      ? product.title.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    const matchesCategory = category
      ? product.category === category
      : true;
    return matchesSearch && matchesCategory;
  });

  const handleCategoryClick = (selectedCategory: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (selectedCategory === category) {
      newParams.delete('category');
    } else {
      newParams.set('category', selectedCategory);
    }
    setSearchParams(newParams);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-xl text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-64 flex-shrink-0">
          <h2 className="text-xl font-bold mb-4">Categories</h2>
          <div className="space-y-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => handleCategoryClick(cat)}
                className={`w-full text-left px-4 py-2 rounded transition-colors ${
                  category === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
            {category && (
              <button
                onClick={() => handleCategoryClick('')}
                className="w-full text-left px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 text-sm"
              >
                Clear Filter
              </button>
            )}
          </div>
        </aside>

        <main className="flex-1">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">
              Products {searchQuery && `- Search: "${searchQuery}"`}
            </h1>
            <p className="text-gray-600 mt-2">
              {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'} found
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-xl text-gray-500">No products found</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};