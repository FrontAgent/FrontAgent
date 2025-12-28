import React, { useState } from 'react';

interface ProductImage {
  id: string;
  url: string;
  alt: string;
}

interface ProductSpec {
  name: string;
  options: string[];
}

interface ProductAttribute {
  label: string;
  value: string;
}

interface Product {
  id: string;
  title: string;
  description: string;
  images: ProductImage[];
  originalPrice: number;
  discountPrice?: number;
  stock: number;
  specs: ProductSpec[];
  attributes: ProductAttribute[];
  detailedDescription: string;
}

interface ProductDetailProps {
  product?: Product;
  onAddToCart?: (product: Product, quantity: number, selectedSpecs: Record<string, string>) => void;
  onBuyNow?: (product: Product, quantity: number, selectedSpecs: Record<string, string>) => void;
}

const defaultProduct: Product = {
  id: '1',
  title: '高品质无线蓝牙耳机 Pro Max',
  description: '采用先进降噪技术，提供沉浸式音频体验。长达40小时续航，舒适佩戴设计。',
  images: [
    { id: '1', url: 'https://picsum.photos/600/600?random=1', alt: '产品图1' },
    { id: '2', url: 'https://picsum.photos/600/600?random=2', alt: '产品图2' },
    { id: '3', url: 'https://picsum.photos/600/600?random=3', alt: '产品图3' },
    { id: '4', url: 'https://picsum.photos/600/600?random=4', alt: '产品图4' },
  ],
  originalPrice: 1299,
  discountPrice: 899,
  stock: 156,
  specs: [
    { name: '颜色', options: ['星空黑', '云雾白', '玫瑰金', '深海蓝'] },
    { name: '版本', options: ['标准版', 'Pro版', 'Pro Max版'] },
  ],
  attributes: [
    { label: '品牌', value: 'TechAudio' },
    { label: '型号', value: 'TA-BT-PM2024' },
    { label: '连接方式', value: '蓝牙5.3' },
    { label: '续航时间', value: '40小时' },
    { label: '充电时间', value: '2小时' },
    { label: '重量', value: '250g' },
    { label: '保修期', value: '1年' },
  ],
  detailedDescription: `
    【产品特点】
    1. 主动降噪技术：采用双馈式主动降噪，有效降低环境噪音达35dB
    2. Hi-Res音质：支持LDAC高清音频编解码，还原每一个音乐细节
    3. 超长续航：单次充电可使用40小时，快充10分钟可用3小时
    4. 舒适佩戴：记忆海绵耳罩，长时间佩戴不压耳
    5. 智能感应：摘下自动暂停，戴上继续播放
    
    【包装清单】
    耳机主体 x1、充电线 x1、收纳袋 x1、说明书 x1、3.5mm音频线 x1
  `,
};

export const ProductDetail: React.FC<ProductDetailProps> = ({
  product = defaultProduct,
  onAddToCart,
  onBuyNow,
}) => {
  const [selectedImage, setSelectedImage] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedSpecs, setSelectedSpecs] = useState<Record<string, string>>({});

  const discountPercent = product.discountPrice
    ? Math.round((1 - product.discountPrice / product.originalPrice) * 100)
    : 0;

  const currentPrice = product.discountPrice || product.originalPrice;

  const handleSpecSelect = (specName: string, option: string) => {
    setSelectedSpecs((prev) => ({
      ...prev,
      [specName]: option,
    }));
  };

  const handleQuantityChange = (delta: number) => {
    const newQuantity = quantity + delta;
    if (newQuantity >= 1 && newQuantity <= product.stock) {
      setQuantity(newQuantity);
    }
  };

  const handleAddToCart = () => {
    onAddToCart?.(product, quantity, selectedSpecs);
  };

  const handleBuyNow = () => {
    onBuyNow?.(product, quantity, selectedSpecs);
  };

  const getStockStatus = () => {
    if (product.stock === 0) {
      return { text: '已售罄', color: 'text-red-500' };
    } else if (product.stock < 10) {
      return { text: `仅剩 ${product.stock} 件`, color: 'text-orange-500' };
    } else if (product.stock < 50) {
      return { text: '库存紧张', color: 'text-yellow-600' };
    }
    return { text: '现货充足', color: 'text-green-500' };
  };

  const stockStatus = getStockStatus();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* 左侧图片区域 */}
        <div className="space-y-4">
          {/* 主图 */}
          <div
            className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-zoom-in"
            onClick={() => setIsZoomed(true)}
          >
            <img
              src={product.images[selectedImage]?.url}
              alt={product.images[selectedImage]?.alt}
              className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
            />
            {product.discountPrice && (
              <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                -{discountPercent}%
              </div>
            )}
          </div>

          {/* 缩略图列表 */}
          <div className="flex gap-3 overflow-x-auto pb-2">
            {product.images.map((image, index) => (
              <button
                key={image.id}
                onClick={() => setSelectedImage(index)}
                className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                  selectedImage === index
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <img
                  src={image.url}
                  alt={image.alt}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>

        {/* 右侧信息区域 */}
        <div className="space-y-6">
          {/* 标题 */}
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
              {product.title}
            </h1>
            <p className="text-gray-600">{product.description}</p>
          </div>

          {/* 价格信息 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-red-500">
                ¥{currentPrice.toFixed(2)}
              </span>
              {product.discountPrice && (
                <>
                  <span className="text-lg text-gray-400 line-through">
                    ¥{product.originalPrice.toFixed(2)}
                  </span>
                  <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-sm font-medium">
                    省 ¥{(product.originalPrice - product.discountPrice).toFixed(2)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* 库存状态 */}
          <div className="flex items-center gap-2">
            <span className="text-gray-600">库存状态：</span>
            <span className={`font-medium ${stockStatus.color}`}>
              {stockStatus.text}
            </span>
          </div>

          {/* 规格选择 */}
          <div className="space-y-4">
            {product.specs.map((spec) => (
              <div key={spec.name}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {spec.name}：
                  <span className="text-blue-600 ml-1">
                    {selectedSpecs[spec.name] || '请选择'}
                  </span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {spec.options.map((option) => (
                    <button
                      key={option}
                      onClick={() => handleSpecSelect(spec.name, option)}
                      className={`px-4 py-2 rounded-lg border transition-all ${
                        selectedSpecs[spec.name] === option
                          ? 'border-blue-500 bg-blue-50 text-blue-600'
                          : 'border-gray-300 hover:border-gray-400 text-gray-700'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* 数量选择器 */}
          <div className="flex items-center gap-4">
            <span className="text-gray-700 font-medium">数量：</span>
            <div className="flex items-center border border-gray-300 rounded-lg">
              <button
                onClick={() => handleQuantityChange(-1)}
                disabled={quantity <= 1}
                className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
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
                className="w-16 h-10 text-center border-x border-gray-300 focus:outline-none"
              />
              <button
                onClick={() => handleQuantityChange(1)}
                disabled={quantity >= product.stock}
                className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
            <span className="text-sm text-gray-500">
              (库存 {product.stock} 件)
            </span>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-4 pt-4">
            <button
              onClick={handleAddToCart}
              disabled={product.stock === 0}
              className="flex-1 py-3 px-6 border-2 border-blue-500 text-blue-500 rounded-lg font-semibold hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                加入购物车
              </span>
            </button>
            <button
              onClick={handleBuyNow}
              disabled={product.stock === 0}
              className="flex-1 py-3 px-6 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              立即购买
            </button>
          </div>
        </div>
      </div>

      {/* 商品详情和规格参数 */}
      <div className="mt-12 border-t pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 规格参数 */}
          <div className="lg:col-span-1">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b">
              规格参数
            </h2>
            <div className="space-y-3">
              {product.attributes.map((attr, index) => (
                <div
                  key={index}
                  className="flex py-2 border-b border-gray-100 last:border-0"
                >
                  <span className="w-24 flex-shrink-0 text-gray-500">
                    {attr.label}
                  </span>
                  <span className="text-gray-900">{attr.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 详细描述 */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b">
              商品详情
            </h2>
            <div className="prose prose-gray max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg">
                {product.detailedDescription}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* 图片放大模态框 */}
      {isZoomed && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setIsZoomed(false)}
        >
          <button
            onClick={() => setIsZoomed(false)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={product.images[selectedImage]?.url}
            alt={product.images[selectedImage]?.alt}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </div>
  );
};