import React from 'react';
import { Header } from '../components/Header';
import { ProductList } from '../components/ProductList';
import { useProducts } from '../hooks/useProducts';

/**
 * HomePage component - Main landing page displaying product catalog
 * 
 * Features:
 * - Fetches and displays product list using custom hook
 * - Handles loading and error states
 * - Renders header and product list components
 * - Responsive layout with Tailwind CSS
 * 
 * @returns {JSX.Element} The home page component
 */
const HomePage: React.FC = () => {
  const { products, loading, error } = useProducts();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {loading && (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Loading products...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
              <div className="flex items-center mb-2">
                <svg className="w-6 h-6 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-red-800">Error Loading Products</h3>
              </div>
              <p className="text-red-600">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && products && (
          <ProductList products={products} />
        )}
      </main>
    </div>
  );
};

export default HomePage;