import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <h1 className="text-4xl font-bold text-gray-800 mb-4 text-center">
          Welcome to React + Vite
        </h1>
        <p className="text-gray-600 text-center mb-6">
          Start building amazing applications with React, TypeScript, and Tailwind CSS
        </p>
        <div className="flex justify-center">
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-200">
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}