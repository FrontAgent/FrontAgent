import React, { Suspense } from 'react';
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  BrowserRouter,
} from 'react-router-dom';

type AuthState = {
  isAuthenticated: boolean;
};

const useAuth = (): AuthState => {
  // TODO: Replace with real auth state (e.g., context/store/cookies/token validation)
  return { isAuthenticated: false };
};

type RequireAuthProps = {
  children?: React.ReactNode;
  redirectTo?: string;
};

export const RequireAuth: React.FC<RequireAuthProps> = ({ children, redirectTo = '/login' }) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  return <>{children ?? <Outlet />}</>;
};

const PageShell: React.FC<{ title: string }> = ({ title }) => {
  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif' }}>
      <h1 style={{ margin: 0, fontSize: 18 }}>{title}</h1>
      <p style={{ marginTop: 12, opacity: 0.75 }}>
        占位页面：请在后续创建对应页面组件并替换本路由的懒加载实现。
      </p>
    </div>
  );
};

const createLazyPlaceholder = (title: string) =>
  React.lazy(async () => ({
    default: () => <PageShell title={title} />,
  }));

const LoadingFallback: React.FC = () => {
  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif' }}>
      Loading...
    </div>
  );
};

const NotFound: React.FC = () => {
  return <PageShell title="404 Not Found" />;
};

// Route component placeholders (lazy)
const HomePage = createLazyPlaceholder('Home');
const LoginPage = createLazyPlaceholder('Login');
const DashboardPage = createLazyPlaceholder('Dashboard');
const ProfilePage = createLazyPlaceholder('Profile');
const SettingsPage = createLazyPlaceholder('Settings');

export const AppRouter: React.FC = () => {
  // If this project does NOT use react-router-dom v6, replace this file with your routing library setup.
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />

          <Route element={<RequireAuth />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default AppRouter;