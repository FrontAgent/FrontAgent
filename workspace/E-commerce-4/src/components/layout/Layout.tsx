import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';

export interface LayoutProps {
  children: React.ReactNode;
  showHeader?: boolean;
  showFooter?: boolean;
  showSidebar?: boolean;
  className?: string;
}

const sidebarLinks = [
  { path: '/', label: '首页', icon: '🏠' },
  { path: '/products', label: '全部商品', icon: '📦' },
  { path: '/cart', label: '购物车', icon: '🛒' },
  { path: '/orders', label: '我的订单', icon: '📋' },
  { path: '/profile', label: '个人中心', icon: '👤' },
];

const Layout: React.FC<LayoutProps> = ({
  children,
  showHeader = true,
  showFooter = true,
  showSidebar = false,
  className = '',
}) => {
  const location = useLocation();

  return (
    <div className={`min-h-screen flex flex-col ${className}`}>
      {showHeader && <Header />}

      <div className="flex flex-1">
        {showSidebar && (
          <aside className="hidden md:block w-64 bg-white border-r border-gray-200 p-4">
            <nav className="space-y-2">
              {sidebarLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    location.pathname === link.path
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-xl">{link.icon}</span>
                  <span className="font-medium">{link.label}</span>
                </Link>
              ))}
            </nav>
          </aside>
        )}

        <main className={`flex-1 ${showSidebar ? 'ml-0 md:ml-64' : ''}`}>
          {children}
        </main>
      </div>

      {showFooter && <Footer />}
    </div>
  );
};

export default Layout;