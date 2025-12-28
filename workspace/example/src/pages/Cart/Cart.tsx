import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { CartPanel } from '../../components/CartPanel/CartPanel';

const Cart: React.FC = () => {
  const navigate = useNavigate();

  const handleCheckout = useCallback((): void => {
    navigate('/checkout');
  }, [navigate]);

  return <CartPanel onCheckout={handleCheckout} />;
};

export default Cart;