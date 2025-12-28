import React, { Suspense, lazy } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

const HomePage = lazy(() => import('../pages/HomePage'));
const ProductsPage = lazy(() => import('../pages/ProductsPage'));
const ProductDetailPage = lazy(() => import('../pages/ProductDetailPage'));
const CartPage = lazy(() => import('../pages/CartPage'));
const LoginPage = lazy(() => import('../pages/LoginPage'));
const RegisterPage = lazy(() => import('../pages/RegisterPage'));
const ProfilePage = lazy(() => import('../pages/ProfilePage'));
const CheckoutPage = lazy(() => import('../pages/CheckoutPage'));
const OrdersPage = lazy(() => import('../pages/OrdersPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

const LoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
  </div>
);

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <HomePage />
      </Suspense>
    ),
  },
  {
    path: '/products',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <ProductsPage />
      </Suspense>
    ),
  },
  {
    path: '/products/:id',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <ProductDetailPage />
      </Suspense>
    ),
  },
  {
    path: '/cart',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <CartPage />
      </Suspense>
    ),
  },
  {
    path: '/checkout',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <CheckoutPage />
      </Suspense>
    ),
  },
  {
    path: '/orders',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <OrdersPage />
      </Suspense>
    ),
  },
  {
    path: '/login',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: '/register',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <RegisterPage />
      </Suspense>
    ),
  },
  {
    path: '/profile',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <ProfilePage />
      </Suspense>
    ),
  },
  {
    path: '*',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <NotFoundPage />
      </Suspense>
    ),
  },
]);

export const AppRouter: React.FC = () => {
  return <RouterProvider router={router} />;
};

export default AppRouter;