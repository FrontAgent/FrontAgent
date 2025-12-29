import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { ProductCard } from '../components/ProductCard';
import { Button } from '../components/Button';

interface Product {
  id: number;
  name: string;
  price: number;
  image: string;
  category: string;
}

interface Category {
  id: number;
  name: string;
  icon: string;
}

export const Home: React.FC = () => {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    const mockProducts: Product[] = [
      {
        id: 1,
        name: 'Premium Wireless Headphones',
        price: 299.99,
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
        category: 'Electronics'
      },
      {
        id: 2,
        name: 'Smart Watch Pro',
        price: 399.99,
        image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500',
        category: 'Electronics'
      },
      {
        id: 3,
        name: 'Designer Backpack',
        price: 129.99,
        image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500',
        category: 'Fashion'
      },
      {
        id: 4,
        name: 'Running Shoes',
        price: 159.99,
        image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500',
        category: 'Sports'
      }
    ];

    const mockCategories: Category[] = [
      { id: 1, name: 'Electronics', icon: '📱' },
      { id: 2, name: 'Fashion', icon: '👔' },
      { id: 3, name: 'Sports', icon: '⚽' },
      { id: 4, name: 'Home & Garden', icon: '🏡' },
      { id: 5, name: 'Books', icon: '📚' },
      { id: 6, name: 'Toys', icon: '🎮' }
    ];

    setFeaturedProducts(mockProducts);
    setCategories(mockCategories);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow">
        <section className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-20 px-4">
          <div className="max-w-7xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              Welcome to Our Store
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-blue-100">
              Discover amazing products at unbeatable prices
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="primary" size="large">
                Shop Now
              </Button>
              <Button variant="secondary" size="large">
                Learn More
              </Button>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              Featured Products
            </h2>
            <p className="text-gray-600 text-lg">
              Check out our handpicked selection of trending items
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredProducts.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                name={product.name}
                price={product.price}
                image={product.image}
              />
            ))}
          </div>
        </section>

        <section className="bg-white py-16 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
                Shop by Category
              </h2>
              <p className="text-gray-600 text-lg">
                Browse our wide range of product categories
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="bg-gray-50 rounded-lg p-6 text-center hover:bg-blue-50 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="text-4xl mb-3">{category.icon}</div>
                  <h3 className="font-semibold text-gray-800">{category.name}</h3>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-r from-orange-500 to-red-500 text-white py-16 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
              <div className="flex-1">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  Special Promotion
                </h2>
                <p className="text-xl mb-2">
                  Up to 50% OFF on selected items
                </p>
                <p className="text-orange-100 mb-6">
                  Limited time offer. Don't miss out on these amazing deals!
                </p>
                <Button variant="primary" size="large">
                  View Deals
                </Button>
              </div>
              
              <div className="flex-1 grid grid-cols-2 gap-4">
                <div className="bg-white bg-opacity-20 rounded-lg p-6 text-center backdrop-blur-sm">
                  <div className="text-4xl font-bold mb-2">50%</div>
                  <div className="text-sm">OFF Electronics</div>
                </div>
                <div className="bg-white bg-opacity-20 rounded-lg p-6 text-center backdrop-blur-sm">
                  <div className="text-4xl font-bold mb-2">30%</div>
                  <div className="text-sm">OFF Fashion</div>
                </div>
                <div className="bg-white bg-opacity-20 rounded-lg p-6 text-center backdrop-blur-sm">
                  <div className="text-4xl font-bold mb-2">40%</div>
                  <div className="text-sm">OFF Sports</div>
                </div>
                <div className="bg-white bg-opacity-20 rounded-lg p-6 text-center backdrop-blur-sm">
                  <div className="text-4xl font-bold mb-2">25%</div>
                  <div className="text-sm">OFF Home</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 py-16">
          <div className="bg-blue-50 rounded-2xl p-8 md:p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              Subscribe to Our Newsletter
            </h2>
            <p className="text-gray-600 text-lg mb-8">
              Get the latest updates on new products and exclusive offers
            </p>
            <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button variant="primary" size="medium">
                Subscribe
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};