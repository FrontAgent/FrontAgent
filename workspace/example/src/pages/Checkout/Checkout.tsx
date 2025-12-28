import React, { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import CheckoutForm from '../../components/Checkout/CheckoutForm';

type CartItem = {
  id: string;
  name?: string;
  price?: number;
  quantity: number;
};

type CartStoreState = {
  items: CartItem[];
  total: number;
  clear?: () => void;
};

type CreateOrderInput = {
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  total: number;
  shipping?: unknown;
  billing?: unknown;
  payment?: unknown;
  notes?: string;
};

type CreateOrderResult = {
  id: string;
};

type CreateOrderHook = () => {
  mutateAsync: (input: CreateOrderInput) => Promise<CreateOrderResult>;
  isPending?: boolean;
  isLoading?: boolean;
  error?: unknown;
};

const useCartStore = (): CartStoreState => {
  // TODO: Replace with actual cart store selector/hook (e.g., Zustand/Redux)
  return { items: [], total: 0, clear: undefined };
};

const useCreateOrder: CreateOrderHook = () => {
  // TODO: Replace with actual hook implementation that calls API
  return {
    mutateAsync: async () => {
      return { id: 'order_placeholder' };
    },
    isPending: false,
    isLoading: false,
    error: undefined,
  };
};

type CheckoutFormValues = {
  shipping?: unknown;
  billing?: unknown;
  payment?: unknown;
  notes?: string;
};

const Checkout: React.FC = () => {
  const navigate = useNavigate();

  const { items, total, clear } = useCartStore();
  const { mutateAsync, isPending, isLoading } = useCreateOrder();

  const isSubmitting = Boolean(isPending ?? isLoading);

  const orderItems = useMemo(() => {
    return (items ?? []).map((item) => ({
      productId: item.id,
      quantity: item.quantity,
    }));
  }, [items]);

  const handleSubmit = useCallback(
    async (values: CheckoutFormValues) => {
      const payload: CreateOrderInput = {
        items: orderItems,
        total: total ?? 0,
        shipping: values.shipping,
        billing: values.billing,
        payment: values.payment,
        notes: values.notes,
      };

      await mutateAsync(payload);

      // TODO: Ensure cart store has a clear action; otherwise implement accordingly.
      if (typeof clear === 'function') clear();

      // TODO: Replace '/orders' with the actual Orders route if different.
      navigate('/orders');
    },
    [clear, mutateAsync, navigate, orderItems, total]
  );

  return <CheckoutForm items={items} total={total} onSubmit={handleSubmit} isSubmitting={isSubmitting} />;
};

export default Checkout;