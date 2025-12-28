import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

const NotFoundPage = lazy(() => import('../pages/NotFound'));
const HomePage = lazy(() => import('../pages/Home'));

type AppRoute = {
  path: string;
  element: React.ReactNode;
};

const routes: AppRoute[] = [
  { path: '/', element: <HomePage /> },
  { path: '/404', element: <NotFoundPage /> }
];

const Fallback: React.FC = () => {
  return null;
};

const AppRouter: React.FC = () => {
  return (
    <Suspense fallback={<Fallback />}>
      <Routes>
        {routes.map((r) => (
          <Route key={r.path} path={r.path} element={r.element} />
        ))}
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRouter;