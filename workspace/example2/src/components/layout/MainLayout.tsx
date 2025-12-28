import React from 'react';
import { Link, NavLink } from 'react-router-dom';

export interface HeaderProps {
  cartCount?: number;
}

const linkBaseStyle: React.CSSProperties = {
  color: 'inherit',
  textDecoration: 'none',
};

const navLinkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
  ...linkBaseStyle,
  fontWeight: isActive ? 700 : 500,
  opacity: isActive ? 1 : 0.9,
});

export const Header: React.FC<HeaderProps> = ({ cartCount }) => {
  const resolvedCartCount = cartCount ?? 0;

  return (
    <header
      role="banner"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <Link to="/" aria-label="Go to home" style={{ ...linkBaseStyle, fontWeight: 800 }}>
          Shop
        </Link>

        <nav aria-label="Primary navigation" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <NavLink to="/" end style={navLinkStyle}>
            Home
          </NavLink>
          <NavLink to="/products" style={navLinkStyle}>
            Products
          </NavLink>
        </nav>

        <Link
          to="/cart"
          aria-label={`Cart, ${resolvedCartCount} items`}
          style={{
            ...linkBaseStyle,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            borderRadius: 10,
            border: '1px solid #e5e7eb',
            background: '#fff',
            fontWeight: 600,
          }}
        >
          <span>Cart</span>
          <span
            aria-hidden="true"
            style={{
              minWidth: 22,
              height: 22,
              padding: '0 6px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 999,
              background: '#111827',
              color: '#ffffff',
              fontSize: 12,
              lineHeight: '22px',
            }}
          >
            {resolvedCartCount}
          </span>
        </Link>
      </div>
    </header>
  );
};

export default Header;
import React from 'react';
import { Link } from 'react-router-dom';

export interface FooterProps {
  year?: number;
}

export const Footer: React.FC<FooterProps> = ({ year }) => {
  const resolvedYear = year ?? new Date().getFullYear();

  return (
    <footer role="contentinfo" style={{ borderTop: '1px solid #e5e7eb', background: '#ffffff' }}>
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '20px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          color: '#374151',
        }}
      >
        <small>© {resolvedYear} Shop. All rights reserved.</small>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link to="/" style={{ color: 'inherit', textDecoration: 'none' }}>
            Home
          </Link>
          <Link to="/products" style={{ color: 'inherit', textDecoration: 'none' }}>
            Products
          </Link>
          <Link to="/cart" style={{ color: 'inherit', textDecoration: 'none' }}>
            Cart
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';

export interface MainLayoutProps {
  children?: React.ReactNode;
  cartCount?: number;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children, cartCount }) => {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#f9fafb' }}>
      <Header cartCount={cartCount} />
      <main
        role="main"
        style={{
          flex: 1,
          width: '100%',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 16px' }}>
          {children ?? <Outlet />}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default MainLayout;