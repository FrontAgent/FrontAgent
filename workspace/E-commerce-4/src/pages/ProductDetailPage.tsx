import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/cartStore';

// Mock product data
const mockProducts: Record<string, {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  description: string;
  images: string[];
  colors: string[];
  sizes: string[];
  details: string;
  reviews: Array<{
    id: string;
    user: string;
    avatar: string;
    rating: number;
    comment: string;
    date: string;
    images?: string[];
  }>;
  stock: number;
  category: string;
}> = {
  '1': {
    id: '1',
    name: '高品质无线蓝牙耳机',
    price: 299,
    originalPrice: 399,
    description: '采用先进的蓝牙5.0技术，支持主动降噪，续航时间长达30小时，佩戴舒适，音质出众。',
    images: [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600',
      'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=600',
      'https://images.unsplash.com/photo-1524678606370-a47ad25cb82a?w=600',
      'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600',
    ],
    colors: ['黑色', '白色', '蓝色', '粉色'],
    sizes: ['标准版', 'Pro版'],
    details: `
      <h3>产品特点</h3>
      <ul>
        <li>蓝牙5.0技术，连接更稳定</li>
        <li>主动降噪，沉浸式体验</li>
        <li>30小时超长续航</li>
        <li>人体工学设计，佩戴舒适</li>
        <li>高清通话，智能降噪麦克风</li>
      </ul>
      <h3>规格参数</h3>
      <ul>
        <li>蓝牙版本：5.0</li>
        <li>频响范围：20Hz-20kHz</li>
        <li>电池容量：500mAh</li>
        <li>充电时间：2小时</li>
        <li>重量：250g</li>
      </ul>
    `,
    reviews: [
      {
        id: '1',
        user: '张先生',
        avatar: 'https://i.pravatar.cc/100?img=1',
        rating: 5,
        comment: '音质非常好，降噪效果出色，佩戴也很舒适，值得购买！',
        date: '2024-01-15',
        images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200'],
      },
      {
        id: '2',
        user: '李女士',
        avatar: 'https://i.pravatar.cc/100?img=2',
        rating: 4,
        comment: '整体不错，续航时间很长，就是价格稍微有点贵。',
        date: '2024-01-10',
      },
      {
        id: '3',
        user: '王先生',
        avatar: 'https://i.pravatar.cc/100?img=3',
        rating: 5,
        comment: '第二次购买了，送给朋友的，他也很喜欢！',
        date: '2024-01-05',
      },
    ],
    stock: 100,
    category: '数码产品',
  },
};

// Default product for unknown IDs
const defaultProduct = {
  id: '0',
  name: '示例商品',
  price: 199,
  originalPrice: 299,
  description: '这是一个示例商品描述，展示商品详情页的功能。',
  images: [
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600',
    'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600',
  ],
  colors: ['默认'],
  sizes: ['标准'],
  details: '<p>商品详情内容</p>',
  reviews: [],
  stock: 50,
  category: '其他',
};

const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);

  const product = id && mockProducts[id] ? mockProducts[id] : defaultProduct;

  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState(product.colors[0]);
  const [selectedSize, setSelectedSize] = useState(product.sizes[0]);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'details' | 'specs' | 'reviews'>('details');

  const handleAddToCart = () => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.images[0],
      quantity,
      color: selectedColor,
      size: selectedSize,
    });
    alert('已添加到购物车！');
  };

  const handleBuyNow = () => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.images[0],
      quantity,
      color: selectedColor,
      size: selectedSize,
    });
    navigate('/cart');
  };

  const handleQuantityChange = (delta: number) => {
    const newQuantity = quantity + delta;
    if (newQuantity >= 1 && newQuantity <= product.stock) {
      setQuantity(newQuantity);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`w-4 h-4 ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm">
          <ol className="flex items-center gap-2 text-gray-500">
            <li>
              <button onClick={() => navigate('/')} className="hover:text-blue-600">
                首页
              </button>
            </li>
            <li>/</li>
            <li>
              <button onClick={() => navigate('/products')} className="hover:text-blue-600">
                商品列表
              </button>
            </li>
            <li>/</li>
            <li className="text-gray-900">{product.name}</li>
          </ol>
        </nav>

        {/* Product Main Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Image Gallery */}
            <div className="space-y-4">
              <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                <img
                  src={product.images[selectedImage]}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {product.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${
                      selectedImage === index ? 'border-blue-500' : 'border-transparent'
                    }`}
                  >
                    <img src={image} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Product Info */}
            <div className="space-y-6">
              <div>
                <span className="inline-block px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded mb-2">
                  {product.category}
                </span>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h1>
                <p className="text-gray-600">{product.description}</p>
              </div>

              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-red-500">¥{product.price}</span>
                {product.originalPrice && (
                  <span className="text-lg text-gray-400 line-through">
                    ¥{product.originalPrice}
                  </span>
                )}
                {product.originalPrice && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-600 text-sm rounded">
                    省¥{product.originalPrice - product.price}
                  </span>
                )}
              </div>

              {/* Color Selection */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">
                  颜色：<span className="text-gray-600">{selectedColor}</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`px-4 py-2 rounded-lg border transition-colors ${
                        selectedColor === color
                          ? 'border-blue-500 bg-blue-50 text-blue-600'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>

              {/* Size Selection */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">
                  规格：<span className="text-gray-600">{selectedSize}</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`px-4 py-2 rounded-lg border transition-colors ${
                        selectedSize === size
                          ? 'border-blue-500 bg-blue-50 text-blue-600'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity Selector */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">数量</h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center border border-gray-300 rounded-lg">
                    <button
                      onClick={() => handleQuantityChange(-1)}
                      disabled={quantity <= 1}
                      className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </button>
                    <span className="w-12 text-center font-medium">{quantity}</span>
                    <button
                      onClick={() => handleQuantityChange(1)}
                      disabled={quantity >= product.stock}
                      className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                  <span className="text-sm text-gray-500">库存 {product.stock} 件</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4">
                <button
                  onClick={handleAddToCart}
                  className="flex-1 py-3 px-6 border-2 border-blue-500 text-blue-500 rounded-lg font-medium hover:bg-blue-50 transition-colors"
                >
                  加入购物车
                </button>
                <button
                  onClick={handleBuyNow}
                  className="flex-1 py-3 px-6 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
                >
                  立即购买
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Section */}
        <div className="bg-white rounded-lg shadow-sm">
          {/* Tab Headers */}
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('details')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'details'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                商品详情
              </button>
              <button
                onClick={() => setActiveTab('specs')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'specs'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                规格参数
              </button>
              <button
                onClick={() => setActiveTab('reviews')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'reviews'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                用户评价
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'details' && (
              <div className="prose max-w-none">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">商品介绍</h3>
                <p className="text-gray-600 mb-4">
                  {product.name} 是一款高品质产品，采用优质材料精心制作，专为追求品质生活的您设计。
                </p>
                <h4 className="text-md font-semibold text-gray-900 mb-2">产品特点</h4>
                <ul className="list-disc list-inside text-gray-600 space-y-2 mb-4">
                  <li>采用高端材质，经久耐用</li>
                  <li>精湛工艺，细节之处彰显品质</li>
                  <li>人体工程学设计，使用舒适</li>
                  <li>多种颜色可选，满足个性需求</li>
                </ul>
                <h4 className="text-md font-semibold text-gray-900 mb-2">使用说明</h4>
                <p className="text-gray-600 mb-4">
                  请按照产品说明书正确使用本产品。首次使用前请仔细阅读使用须知。如有任何问题，请联系客服。
                </p>
                <h4 className="text-md font-semibold text-gray-900 mb-2">售后保障</h4>
                <p className="text-gray-600">
                  本产品享受7天无理由退换货服务，1年质量保证。如有质量问题，可免费维修或更换。
                </p>
              </div>
            )}
            {activeTab === 'specs' && (
              <div className="space-y-2">
                <div className="flex py-2 border-b">
                  <span className="w-32 text-gray-500">品牌</span>
                  <span className="text-gray-900">优品生活</span>
                </div>
                <div className="flex py-2 border-b">
                  <span className="w-32 text-gray-500">型号</span>
                  <span className="text-gray-900">{product.id}-2024</span>
                </div>
                <div className="flex py-2 border-b">
                  <span className="w-32 text-gray-500">产地</span>
                  <span className="text-gray-900">中国</span>
                </div>
                <div className="flex py-2 border-b">
                  <span className="w-32 text-gray-500">重量</span>
                  <span className="text-gray-900">约500g</span>
                </div>
                <div className="flex py-2 border-b">
                  <span className="w-32 text-gray-500">材质</span>
                  <span className="text-gray-900">优质环保材料</span>
                </div>
                <div className="flex py-2 border-b">
                  <span className="w-32 text-gray-500">保质期</span>
                  <span className="text-gray-900">24个月</span>
                </div>
                <div className="flex py-2 border-b">
                  <span className="w-32 text-gray-500">包装</span>
                  <span className="text-gray-900">精美礼盒装</span>
                </div>
              </div>
            )}
            {activeTab === 'reviews' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">用户评价 (128)</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400 text-xl">★★★★★</span>
                    <span className="text-gray-600">4.8分</span>
                  </div>
                </div>
                {/* 评价列表 */}
                {[
                  { user: '用户***8', rating: 5, date: '2024-01-15', content: '非常满意！质量很好，物流也快，下次还会购买。', images: ['https://picsum.photos/seed/review1/100/100'] },
                  { user: '用户***2', rating: 5, date: '2024-01-12', content: '产品和描述一致，包装精美，送人很有面子。客服态度也很好。' },
                  { user: '用户***6', rating: 4, date: '2024-01-10', content: '总体不错，性价比很高。就是物流稍微慢了一点。' },
                  { user: '用户***1', rating: 5, date: '2024-01-08', content: '第二次购买了，质量一如既往的好，推荐给朋友了。', images: ['https://picsum.photos/seed/review2/100/100', 'https://picsum.photos/seed/review3/100/100'] },
                ].map((review, index) => (
                  <div key={index} className="border-b pb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-gray-500 text-sm">{review.user.charAt(2)}</span>
                        </div>
                        <span className="text-gray-700">{review.user}</span>
                        <span className="text-yellow-400">{'★'.repeat(review.rating)}</span>
                      </div>
                      <span className="text-gray-400 text-sm">{review.date}</span>
                    </div>
                    <p className="text-gray-600 mb-2">{review.content}</p>
                    {review.images && (
                      <div className="flex gap-2">
                        {review.images.map((img, i) => (
                          <img key={i} src={img} alt={`评价图片${i + 1}`} className="w-16 h-16 object-cover rounded" />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <button className="w-full py-2 text-blue-600 hover:text-blue-700 text-sm">
                  查看更多评价
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;