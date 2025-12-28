import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

type ProtectedRouteProps = {
  isAuthed: boolean;
  redirectTo?: string;
  children: React.ReactElement;
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ isAuthed, redirectTo = '/', children }) => {
  if (!isAuthed) return <Navigate to={redirectTo} replace />;
  return children;
};

const HomePage: React.FC = () => <div>Home</div>;
const ProductsPage: React.FC = () => <div>Products</div>;
const ProductDetailsPage: React.FC = () => <div>Product Details</div>;
const CartPage: React.FC = () => <div>Cart</div>;
const CheckoutPage: React.FC = () => <div>Checkout</div>;
const NotFoundPage: React.FC = () => <div>404 Not Found</div>;

const useAuth = (): { isAuthed: boolean } => {
  // Placeholder auth check; replace with real auth state (context/store) as needed.
  const isAuthed = false;
  return { isAuthed };
};

export const AppRouter: React.FC = () => {
  const { isAuthed } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/products" element={<ProductsPage />} />
      <Route path="/products/:id" element={<ProductDetailsPage />} />
      <Route path="/cart" element={<CartPage />} />
      <Route
        path="/checkout"
        element={
          <ProtectedRoute isAuthed={isAuthed} redirectTo="/">
            <CheckoutPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};