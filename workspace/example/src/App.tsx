import React, { useCallback, useMemo, useState } from 'react';

type RouteKey = 'home' | 'cart';

interface NavItem {
  key: RouteKey;
  label: string;
}

/**
 * Returns a human-friendly page title for a given route.
 */
function getPageTitle(route: RouteKey): string {
  switch (route) {
    case 'cart':
      return 'Cart';
    case 'home':
    default:
      return 'Home';
  }
}

/**
 * Minimal router-like state for simple page switching without external routing.
 */
function useSimpleRouter(initial: RouteKey) {
  const [route, setRoute] = useState<RouteKey>(initial);

  const navigate = useCallback((next: RouteKey) => {
    setRoute(next);
  }, []);

  return { route, navigate };
}

const HomePage: React.FC = () => {
  return (
    <section aria-labelledby="page-home-title" className="space-y-4">
      <h2 id="page-home-title" className="text-xl font-semibold text-slate-900">
        Home
      </h2>
      <p className="text-sm leading-6 text-slate-700">
        This is a minimal application shell with a header, main content area, and footer.
        Use the navigation to switch pages.
      </p>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-medium text-slate-900">Getting started</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>Explore the layout structure (Header / Main / Footer).</li>
          <li>Switch between Home and Cart via accessible navigation.</li>
          <li>Replace the page content with your real routes later.</li>
        </ul>
      </div>
    </section>
  );
};

const CartPage: React.FC = () => {
  const [count, setCount] = useState<number>(0);

  const increment = useCallback(() => setCount((c) => c + 1), []);
  const decrement = useCallback(() => setCount((c) => Math.max(0, c - 1)), []);

  return (
    <section aria-labelledby="page-cart-title" className="space-y-4">
      <h2 id="page-cart-title" className="text-xl font-semibold text-slate-900">
        Cart
      </h2>
      <p className="text-sm leading-6 text-slate-700">
        This is a placeholder cart page. It demonstrates local state without importing protected
        modules.
      </p>

      <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900">Items</p>
          <p className="text-sm text-slate-700" aria-live="polite">
            {count} item{count === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={decrement}
            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
            aria-label="Decrease item count"
          >
            -
          </button>
          <button
            type="button"
            onClick={increment}
            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
            aria-label="Increase item count"
          >
            +
          </button>
        </div>
      </div>
    </section>
  );
};

/**
 * Application shell with global layout (Header / Main / Footer) and minimal routing placeholder.
 */
const App: React.FC = () => {
  const { route, navigate } = useSimpleRouter('home');

  const navItems: readonly NavItem[] = useMemo(
    () => [
      { key: 'home', label: 'Home' },
      { key: 'cart', label: 'Cart' },
    ],
    [],
  );

  const pageTitle = useMemo(() => getPageTitle(route), [route]);

  const content = useMemo(() => {
    switch (route) {
      case 'cart':
        return <CartPage />;
      case 'home':
      default:
        return <HomePage />;
    }
  }, [route]);

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-slate-900 focus:shadow"
      >
        Skip to content
      </a>

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold leading-6 text-slate-900">
              App Shell
            </h1>
            <p className="text-sm text-slate-600" aria-live="polite">
              {pageTitle}
            </p>
          </div>

          <nav aria-label="Primary" className="flex items-center gap-2">
            {navItems.map((item) => {
              const isActive = item.key === route;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => navigate(item.key)}
                  className={[
                    'inline-flex items-center rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2',
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-slate-100',
                  ].join(' ')}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6" role="main">
        {content}

        <div className="mt-10 rounded-lg border border-dashed border-slate-300 bg-white p-4">
          <h3 className="text-sm font-medium text-slate-900">Routing placeholder</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Replace this area with your routing solution later (e.g., an <code>Outlet</code> from a
            router library). For now, this file uses React state to switch pages.
          </p>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} App Shell</p>
          <p>
            <span className="sr-only">Status:</span>
            <span aria-live="polite">Ready</span>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;