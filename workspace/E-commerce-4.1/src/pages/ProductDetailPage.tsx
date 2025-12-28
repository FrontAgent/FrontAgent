import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { Button } from '../components/Button';
import { useCartStore } from '../store/cartStore';

interface ProductImage {
  id: number;
  url: string;
  alt: string;
}

interface ProductSpec {
  id: string;
  name: string;
  options: string[];
}

interface Review {
  id: number;
  userName: string;
  rating: number;
  comment: string;
  date: string;
}

interface RelatedProduct {
  id: number;
  name: string;
  price: number;
  image: string;
}

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addToCart = useCartStore((state) => state.addToCart);

  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedSpecs, setSelectedSpecs] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'description' | 'specs' | 'reviews'>('description');

  const productImages: ProductImage[] = [
    { id: 1, url: 'https://via.placeholder.com/600x600?text=Main+Image', alt: 'Product main image' },
    { id: 2, url: 'https://via.placeholder.com/600x600?text=Image+2', alt: 'Product image 2' },
    { id: 3, url: 'https://via.placeholder.com/600x600?text=Image+3', alt: 'Product image 3' },
    { id: 4, url: 'https://via.placeholder.com/600x600?text=Image+4', alt: 'Product image 4' },
  ];

  const productSpecs: ProductSpec[] = [
    { id: 'color', name: '颜色', options: ['黑色', '白色', '蓝色'] },
    { id: 'size', name: '尺寸', options: ['S', 'M', 'L', 'XL'] },
  ];

  const reviews: Review[] = [
    { id: 1, userName: '张三', rating: 5, comment: '非常好的产品，质量很棒！', date: '2024-01-15' },
    { id: 2, userName: '李四', rating: 4, comment: '物有所值，推荐购买', date: '2024-01-10' },
    { id: 3, userName: '王五', rating: 5, comment: '超出预期，非常满意', date: '2024-01-05' },
  ];

  const relatedProducts: RelatedProduct[] = [
    { id: 2, name: '相关商品 1', price: 199, image: 'https://via.placeholder.com/200x200?text=Related+1' },
    { id: 3, name: '相关商品 2', price: 299, image: 'https://via.placeholder.com/200x200?text=Related+2' },
    { id: 4, name: '相关商品 3', price: 399, image: 'https://via.placeholder.com/200x200?text=Related+3' },
    { id: 5, name: '相关商品 4', price: 499, image: 'https://via.placeholder.com/200x200?text=Related+4' },
  ];

  const product = {
    id: Number(id) || 1,
    name: '高品质商品名称',
    price: 599,
    originalPrice: 799,
    rating: 4.8,
    reviewCount: 1234,
    stock: 99,
    description: '这是一款高品质的商品，采用优质材料制作，工艺精湛，性能卓越。适合各种场景使用，是您的理想选择。',
    specifications: {
      '品牌': 'Premium Brand',
      '型号': 'PB-2024',
      '材质': '优质材料',
      '产地': '中国',
      '保修期': '1年',
    },
  };

  const handleQuantityChange = (delta: number) => {
    const newQuantity = quantity + delta;
    if (newQuantity >= 1 && newQuantity <= product.stock) {
      setQuantity(newQuantity);
    }
  };

  const handleSpecChange = (specId: string, option: string) => {
    setSelectedSpecs({ ...selectedSpecs, [specId]: option });
  };

  const handleAddToCart = () => {
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      quantity: quantity,
      image: productImages[0].url,
    });
  };

  const handleBuyNow = () => {
    handleAddToCart();
    navigate('/cart');
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`w-5 h-5 ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                <img
                  src={productImages[selectedImage].url}
                  alt={productImages[selectedImage].alt}
                  className="w-full h-full object-cover"
                />
              </div>
              
              <div className="grid grid-cols-4 gap-2">
                {productImages.map((image, index) => (
                  <button
                    key={image.id}
                    onClick={() => setSelectedImage(index)}
                    className={`aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 transition-colors ${
                      selectedImage === index ? 'border-blue-500' : 'border-transparent hover:border-gray-300'
                    }`}
                  >
                    <img src={image.url} alt={image.alt} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>
                <div className="flex items-center gap-4">
                  {renderStars(product.rating)}
                  <span className="text-gray-600">{product.rating}</span>
                  <span className="text-gray-400">|</span>
                  <span className="text-gray-600">{product.reviewCount} 评价</span>
                </div>
              </div>

              <div className="border-t border-b border-gray-200 py-4">
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-red-600">¥{product.price}</span>
                  <span className="text-lg text-gray-400 line-through">¥{product.originalPrice}</span>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 text-gray-600">
                  <span>库存：</span>
                  <span className={product.stock > 0 ? 'text-green-600' : 'text-red-600'}>
                    {product.stock > 0 ? `${product.stock} 件` : '缺货'}
                  </span>
                </div>
              </div>

              {productSpecs.map((spec) => (
                <div key={spec.id}>
                  <div className="text-gray-700 font-medium mb-2">{spec.name}</div>
                  <div className="flex flex-wrap gap-2">
                    {spec.options.map((option) => (
                      <button
                        key={option}
                        onClick={() => handleSpecChange(spec.id, option)}
                        className={`px-4 py-2 border rounded-lg transition-colors ${
                          selectedSpecs[spec.id] === option
                            ? 'border-blue-500 bg-blue-50 text-blue-600'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div>
                <div className="text-gray-700 font-medium mb-2">数量</div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleQuantityChange(-1)}
                    disabled={quantity <= 1}
                    className="w-10 h-10 border border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      if (val >= 1 && val <= product.stock) {
                        setQuantity(val);
                      }
                    }}
                    className="w-20 h-10 border border-gray-300 rounded-lg text-center"
                  />
                  <button
                    onClick={() => handleQuantityChange(1)}
                    disabled={quantity >= product.stock}
                    className="w-10 h-10 border border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  onClick={handleAddToCart}
                  variant="outline"
                  className="flex-1"
                  disabled={product.stock === 0}
                >
                  加入购物车
                </Button>
                <Button
                  onClick={handleBuyNow}
                  variant="primary"
                  className="flex-1"
                  disabled={product.stock === 0}
                >
                  立即购买
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="border-b border-gray-200">
            <div className="flex gap-8">
              <button
                onClick={() => setActiveTab('description')}
                className={`pb-4 px-2 font-medium transition-colors ${
                  activeTab === 'description'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                商品详情
              </button>
              <button
                onClick={() => setActiveTab('specs')}
                className={`pb-4 px-2 font-medium transition-colors ${
                  activeTab === 'specs'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                规格参数
              </button>
              <button
                onClick={() => setActiveTab('reviews')}
                className={`pb-4 px-2 font-medium transition-colors ${
                  activeTab === 'reviews'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                用户评价
              </button>
            </div>
          </div>

          <div className="py-6">
            {activeTab === 'description' && (
              <div className="prose max-w-none">
                <p className="text-gray-700 leading-relaxed">{product.description}</p>
              </div>
            )}

            {activeTab === 'specs' && (
              <div className="space-y-3">
                {Object.entries(product.specifications).map(([key, value]) => (
                  <div key={key} className="flex border-b border-gray-100 pb-3">
                    <div className="w-1/3 text-gray-600">{key}</div>
                    <div className="w-2/3 text-gray-900">{value}</div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-6">
                {reviews.map((review) => (
                  <div key={review.id} className="border-b border-gray-100 pb-6 last:border-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-medium">
                          {review.userName.charAt(0)}
                        </div>
                        <span className="font-medium text-gray-900">{review.userName}</span>
                      </div>
                      <span className="text-sm text-gray-500">{review.date}</span>
                    </div>
                    <div className="mb-2">{renderStars(review.rating)}</div>
                    <p className="text-gray-700">{review.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">