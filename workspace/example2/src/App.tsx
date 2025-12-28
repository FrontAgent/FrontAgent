import React, { Suspense } from 'react';
import { RouterProvider } from 'react-router-dom';
import { AppRouter } from './router/AppRouter';

type ErrorBoundaryProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
};

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('Unhandled error caught by ErrorBoundary:', error, errorInfo);
    }
  }

  public render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div role="alert" style={{ padding: 16 }}>
            <h1 style={{ margin: 0, fontSize: 18 }}>Something went wrong.</h1>
            {process.env.NODE_ENV !== 'production' && this.state.error?.message ? (
              <pre style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>{this.state.error.message}</pre>
            ) : null}
          </div>
        )
      );
    }

    return this.props.children;
  }
}

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: 16, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <div style={{ fontWeight: 600 }}>App</div>
      </header>
      <main style={{ flex: 1, padding: 16 }}>{children}</main>
    </div>
  );
};

const LoadingFallback: React.FC = () => {
  return (
    <div aria-busy="true" aria-live="polite" style={{ padding: 16 }}>
      Loading...
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppShell>
        <Suspense fallback={<LoadingFallback />}>
          <RouterProvider router={AppRouter} fallbackElement={<LoadingFallback />} />
        </Suspense>
      </AppShell>
    </ErrorBoundary>
  );
};

export default App;