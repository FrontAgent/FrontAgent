import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ProductCard from '../components/ProductCard';

const HomePage: React.FC = () => {
  const mockProducts = [
    {
      id: 1,
      name: 'Premium Wireless Headphones',
      price: 299.99,
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&h=500&fit=crop',
      rating: 4.5,
      reviews: 128
    },
    {
      id: 2,
      name: 'Smart Watch Pro',
      price: 399.99,
      image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&h=500&fit=crop',
      rating: 4.8,
      reviews: 256
    },
    {
      id: 3,
      name: 'Laptop Stand Aluminum',
      price: 79.99,
      image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500&h=500&fit=crop',
      rating: 4.3,
      reviews: 89
    },
    {
      id: 4,
      name: 'Mechanical Keyboard RGB',
      price: 159.99,
      image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&h=500&fit=crop',
      rating: 4.6,
      reviews: 342
    },
    {
      id: 5,
      name: 'Wireless Mouse',
      price: 49.99,
      image: 'https://images.unsplash.com/photo-1527814050087-3793815479db?w=500&h=500&fit=crop',
      rating: 4.4,
      reviews: 167
    },
    {
      id: 6,
      name: 'USB-C Hub 7-in-1',
      price: 89.99,
      image: 'https://images.unsplash.com/photo-1625948515291-69613efd103f?w=500&h=500&fit=crop',
      rating: 4.7,
      reviews: 203
    }
  ];

  const categories = [
    { name: 'Electronics', icon: '💻' },
    { name: 'Fashion', icon: '👔' },
    { name: 'Home & Garden', icon: '🏡' },
    { name: 'Sports', icon: '⚽' },
    { name: 'Books', icon: '📚' },
    { name: 'Toys', icon: '🎮' },
    { name: 'Beauty', icon: '💄' },
    { name: 'Automotive', icon: '🚗' }
  ];

  const banners = [
    {
      id: 1,
      title: 'Summer Sale',
      subtitle: 'Up to 50% OFF on selected items',
      bgColor: 'bg-gradient-to-r from-blue-500 to-purple-600'
    },
    {
      id: 2,
      title: 'New Arrivals',
      subtitle: 'Check out our latest products',
      bgColor: 'bg-gradient-to-r from-green-500 to-teal-600'
    },
    {
      id: 3,
      title: 'Free Shipping',
      subtitle: 'On orders over $100',
      bgColor: 'bg-gradient-to-r from-orange-500 to-red-600'
    }
  ];

  const [currentBanner, setCurrentBanner] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow">
        <div className="relative h-96 overflow-hidden">
          {banners.map((banner, index) => (
            <div
              key={banner.id}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                index === currentBanner ? 'opacity-100' : 'opacity-0'
              } ${banner.bgColor}`}
            >
              <div className="container mx-auto px-4 h-full flex flex-col justify-center items-center text-white">
                <h1 className="text-5xl md:text-6xl font-bold mb-4">{banner.title}</h1>
                <p className="text-xl md:text-2xl mb-8">{banner.subtitle}</p>
                <button className="bg-white text-gray-900 px-8 py-3 rounded-full font-semibold hover:bg-gray-100 transition-colors">
                  Shop Now
                </button>
              </div>
            </div>
          ))}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
            {banners.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentBanner(index)}
                className={`w-3 h-3 rounded-full transition-colors ${
                  index === currentBanner ? 'bg-white' : 'bg-white/50'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="container mx-auto px-4 py-12">
          <section className="mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">Shop by Category</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
              {categories.map((category) => (
                <div
                  key={category.name}
                  className="bg-white rounded-lg p-6 text-center hover:shadow-lg transition-shadow cursor-pointer"
                >
                  <div className="text-4xl mb-2">{category.icon}</div>
                  <h3 className="text-sm font-medium text-gray-900">{category.name}</h3>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900">Hot Deals</h2>
              <button className="text-blue-600 hover:text-blue-700 font-medium">
                View All →
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {mockProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  name={product.name}
                  price={product.price}
                  image={product.image}
                  rating={product.rating}
                  reviews={product.reviews}
                />
              ))}
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default HomePage;