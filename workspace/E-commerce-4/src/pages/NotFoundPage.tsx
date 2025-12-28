import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center px-4">
        <h1 className="text-9xl font-bold text-gray-800">404</h1>
        <div className="mt-4">
          <h2 className="text-3xl font-semibold text-gray-700 mb-2">
            页面未找到
          </h2>
          <p className="text-gray-500 mb-8">
            抱歉，您访问的页面不存在或已被移除。
          </p>
        </div>
        <Link
          to="/"
          className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-md hover:shadow-lg"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;