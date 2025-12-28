import React from 'react';
import type { User } from '../types';

export type HeaderNavItem = {
  label: string;
  href: string;
};

export type HeaderProps = {
  /**
   * Current signed-in user (if any).
   * When not provided, the user area will render a placeholder.
   */
  user?: User | null;
  /**
   * Cart item count to display near the cart navigation entry.
   */
  cartCount?: number;
  /**
   * Site title text.
   */
  title?: string;
  /**
   * Optional logo element to render before the title (e.g., an SVG).
   */
  logo?: React.ReactNode;
  /**
   * Base navigation items. If not provided, defaults to Home/Categories/Cart.
   */
  navItems?: HeaderNavItem[];
  /**
   * Optional additional className for the header element.
   */
  className?: string;
};

const clampNonNegativeInt = (value: unknown): number => {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
};

const defaultNavItems: HeaderNavItem[] = [
  { label: '首页', href: '/' },
  { label: '分类', href: '/categories' },
  { label: '购物车', href: '/cart' },
];

const Header: React.FC<HeaderProps> = ({
  user = null,
  cartCount = 0,
  title = 'Site',
  logo,
  navItems = defaultNavItems,
  className,
}) => {
  const safeCartCount = clampNonNegativeInt(cartCount);

  return (
    <header className={['w-full border-b border-slate-200 bg-white', className].filter(Boolean).join(' ')}>
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:h-16 sm:px-6 lg:px-8">
        <a href="/" className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded bg-slate-900 text-white">
            {logo ?? <span className="text-sm font-semibold">{title.slice(0, 1).toUpperCase()}</span>}
          </span>
          <span className="hidden min-w-0 truncate text-base font-semibold text-slate-900 sm:inline">
            {title}
          </span>
        </a>

        <nav className="ml-2 hidden flex-1 items-center gap-1 sm:flex" aria-label="Primary navigation">
          {navItems.map((item) => {
            const isCart = item.href === '/cart';
            return (
              <a
                key={`${item.href}-${item.label}`}
                href={item.href}
                className="inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                <span>{item.label}</span>
                {isCart ? (
                  <span
                    className="inline-flex min-w-6 items-center justify-center rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white"
                    aria-label={`Cart items: ${safeCartCount}`}
                    title={`Cart items: ${safeCartCount}`}
                  >
                    {safeCartCount}
                  </span>
                ) : null}
              </a>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <a
            href="/cart"
            className="inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 sm:hidden"
            aria-label="Cart"
          >
            <span>购物车</span>
            <span
              className="inline-flex min-w-6 items-center justify-center rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white"
              aria-label={`Cart items: ${safeCartCount}`}
              title={`Cart items: ${safeCartCount}`}
            >
              {safeCartCount}
            </span>
          </a>

          <div className="flex items-center">
            {user ? (
              <a
                href="/account"
                className="inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
                aria-label="Account"
                title="Account"
              >
                <span className="hidden sm:inline">你好，</span>
                <span className="max-w-[10rem] truncate text-slate-900">
                  {(user as unknown as { name?: string; username?: string; email?: string }).name ??
                    (user as unknown as { name?: string; username?: string; email?: string }).username ??
                    (user as unknown as { name?: string; username?: string; email?: string }).email ??
                    'User'}
                </span>
              </a>
            ) : (
              <div
                className="inline-flex items-center gap-2 rounded px-3 py-2 text-sm text-slate-500"
                aria-label="User area"
                title="User area"
              >
                <span className="h-8 w-8 rounded-full bg-slate-100" aria-hidden="true" />
                <span className="hidden sm:inline">用户区域</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;