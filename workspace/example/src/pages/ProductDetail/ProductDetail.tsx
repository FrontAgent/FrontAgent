import React from 'react';
import { useParams } from 'react-router-dom';
import { Skeleton } from '../../components/Skeleton/Skeleton';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { ProductDetailSection } from './components/ProductDetailSection/ProductDetailSection';

type RouteParams = {
  id?: string;
};

type UseProductByIdResult<TProduct> = {
  data?: TProduct;
  isLoading: boolean;
  error?: unknown;
  refetch?: () => void;
};

type Product = unknown;

const useProductById = (_id: string): UseProductByIdResult<Product> => {
  // TODO: Implement hook to fetch product by id
  return { isLoading: true };
};

const ProductDetail: React.FC = () => {
  const { id } = useParams<RouteParams>();

  if (!id) {
    return (
      <ErrorState
        title="Invalid product"
        description="Product id is missing from the route."
      />
    );
  }

  const { data, isLoading, error, refetch } = useProductById(id);

  if (isLoading) {
    return <Skeleton />;
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load product"
        description="Please try again."
        onRetry={refetch}
      />
    );
  }

  if (!data) {
    return (
      <ErrorState
        title="Product not found"
        description="The requested product does not exist."
        onRetry={refetch}
      />
    );
  }

  return <ProductDetailSection product={data as never} />;
};

export default ProductDetail;