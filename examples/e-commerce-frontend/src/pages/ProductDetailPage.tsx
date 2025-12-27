import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCartStore } from '../stores/useCartStore';
import { useProductStore } from '../stores/useProductStore';
import { IProduct, IProductVariant } from '../types/product';
import { Button } from '../components/ui/Button';
import { ImageGallery } from '../components/features/ImageGallery';
import { ProductInfo } from '../components/features/ProductInfo';
import { ProductSpecs } from '../components/features/ProductSpecs';
import { ProductReviews } from '../components/features/ProductReviews';
import { RelatedProducts } from '../components/features/RelatedProducts';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorMessage } from '../components/ui/ErrorMessage';

/**
 * ProductDetailPage component
 * Displays detailed product information with image gallery, specs, and purchase options
 */
export const ProductDetailPage: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const [selectedVariant, setSelectedVariant] = useState<IProductVariant | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const { product, fetchProduct, loading } = useProductStore();
  const { addToCart } = useCartStore();

  /**
   * Load product data on component mount
   */
  useEffect(() => {
    const loadProduct = async () => {
      if (!productId) {
        setError('Product ID is required');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        await fetchProduct(productId);
      } catch (err) {
        setError('Failed to load product');
        console.error('Error loading product:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadProduct();
  }, [productId, fetchProduct]);

  /**
   * Initialize selected variant when product loads
   */
  useEffect(() => {
    if (product && product.variants && product.variants.length > 0) {
      setSelectedVariant(product.variants[0]);
    }
  }, [product]);

  /**
   * Handle variant selection
   */
  const handleVariantChange = (variant: IProductVariant) => {
    setSelectedVariant(variant);
  };

  /**
   * Handle quantity change
   */
  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity >= 1 && newQuantity <= (selectedVariant?.stock || 0)) {
      setQuantity(newQuantity);
    }
  };

  /**
   * Handle add to cart
   */
  const handleAddToCart = () => {
    if (!product || !selectedVariant) {
      return;
    }

    addToCart({
      productId: product.id,
      variantId: selectedVariant.id,
      quantity,
      price: selectedVariant.price,
    });

    // Show success feedback (could be enhanced with toast notification)
    alert('Product added to cart!');
  };

  /**
   * Handle buy now
   */
  const handleBuyNow = () => {
    handleAddToCart();
    navigate('/cart');
  };

  /**
   * Handle back to products
   */
  const handleBackToProducts = () => {
    navigate('/products');
  };

  if (isLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container mx-auto px-4 py-8">
        <ErrorMessage 
          message={error || 'Product not found'} 
          onRetry={() => window.location.reload()}
        />
        <div className="mt-4">
          <Button onClick={handleBackToProducts}>
            Back to Products
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-8">
        <ol className="flex items-center space-x-2 text-sm text-gray-600">
          <li>
            <button 
              onClick={() => navigate('/')}
              className="hover:text-blue-600"
            >
              Home
            </button>
          </li>
          <li>/</li>
          <li>
            <button 
              onClick={handleBackToProducts}
              className="hover:text-blue-600"
            >
              Products
            </button>
          </li>
          <li>/</li>
          <li className="text-gray-900 font-medium">
            {product.name}
          </li>
        </ol>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
        {/* Product Images */}
        <div className="space-y-4">
          <ImageGallery 
            images={product.images}
            productName={product.name}
          />
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          <ProductInfo 
            product={product}
            selectedVariant={selectedVariant}
            quantity={quantity}
            onQuantityChange={handleQuantityChange}
          />

          {/* Product Specifications */}
          <ProductSpecs 
            product={product}
            selectedVariant={selectedVariant}
            onVariantChange={handleVariantChange}
          />

          {/* Action Buttons */}
          <div className="space-y-4 pt-6 border-t">
            <div className="flex space-x-4">
              <Button
                variant="primary"
                size="large"
                onClick={handleAddToCart}
                disabled={!selectedVariant || selectedVariant.stock === 0}
                className="flex-1"
              >
                Add to Cart
              </Button>
              <Button
                variant="secondary"
                size="large"
                onClick={handleBuyNow}
                disabled={!selectedVariant || selectedVariant.stock === 0}
                className="flex-1"
              >
                Buy Now
              </Button>
            </div>

            {/* Stock Status */}
            {selectedVariant && (
              <div className="text-sm">
                {selectedVariant.stock > 0 ? (
                  <span className="text-green-600">
                    In Stock ({selectedVariant.stock} available)
                  </span>
                ) : (
                  <span className="text-red-600">
                    Out of Stock
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Product Description */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6">Product Description</h2>
        <div className="prose max-w-none">
          <p className="text-gray-700 leading-relaxed">
            {product.description}
          </p>
        </div>
      </section>

      {/* Product Reviews */}
      <section className="mb-16">
        <ProductReviews productId={product.id} />
      </section>

      {/* Related Products */}
      <section>
        <RelatedProducts 
          currentProductId={product.id}
          category={product.category}
        />
      </section>
    </div>
  );
};

export default ProductDetailPage;