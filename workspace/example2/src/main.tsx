import React, { PropsWithChildren } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// If you have a global stylesheet, import it here.
// import './styles/global.css';

import App from './App';

const AppProviders: React.FC<PropsWithChildren> = ({ children }) => {
  // Add global providers here (e.g., ThemeProvider, QueryClientProvider, Redux Provider).
  return <>{children}</>;
};

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element with id="root" not found.');
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <AppProviders>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppProviders>
  </React.StrictMode>
);