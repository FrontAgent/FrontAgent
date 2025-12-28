import React from 'react';
import { ProductList } from '../../components/ProductList/ProductList';

const Home: React.FC = () => {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Products</h1>
          <p className="mt-1 text-sm text-slate-600">Browse and add items to your cart.</p>
        </div>
      </div>

      <div className="mt-6">
        <ProductList />
      </div>
    </div>
  );
};

export default Home;