import React, { Suspense } from 'react';
import { AppRouter } from './routes/index';

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
    if (import.meta.env.DEV) {
      console.error('Unhandled error caught by ErrorBoundary:', error, errorInfo);
    }
  }

  public render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div role="alert" className="p-4">
            <h1 className="text-lg font-semibold">Something went wrong.</h1>
            {import.meta.env.DEV && this.state.error?.message ? (
              <pre className="mt-3 whitespace-pre-wrap text-sm text-red-600">{this.state.error.message}</pre>
            ) : null}
          </div>
        )
      );
    }

    return this.props.children;
  }
}

const LoadingFallback: React.FC = () => {
  return (
    <div aria-busy="true" aria-live="polite" className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        <AppRouter />
      </Suspense>
    </ErrorBoundary>
  );
};

export default App;
