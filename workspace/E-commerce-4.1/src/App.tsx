import React from 'react';

const App: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">
          欢迎使用本项目
        </h1>
        <p className="text-lg text-gray-600">
          这是一个使用 React 和 TailwindCSS 构建的应用
        </p>
      </div>
    </div>
  );
};

export default App;