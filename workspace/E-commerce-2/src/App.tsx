import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

/**
 * 主应用组件
 * 
 * 使用 react-router-dom 配置应用的路由结构
 * 包含基础的路由配置和占位页面
 * 
 * @returns {JSX.Element} 应用的根组件
 */
const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
};

/**
 * 首页占位组件
 */
const HomePage: React.FC = () => {
  return (
    <div>
      <h1>Home Page</h1>
      <p>Welcome to the home page</p>
    </div>
  );
};

/**
 * 关于页面占位组件
 */
const AboutPage: React.FC = () => {
  return (
    <div>
      <h1>About Page</h1>
      <p>This is the about page</p>
    </div>
  );
};

/**
 * 联系页面占位组件
 */
const ContactPage: React.FC = () => {
  return (
    <div>
      <h1>Contact Page</h1>
      <p>This is the contact page</p>
    </div>
  );
};

/**
 * 404页面占位组件
 */
const NotFoundPage: React.FC = () => {
  return (
    <div>
      <h1>404 - Page Not Found</h1>
      <p>The page you are looking for does not exist</p>
    </div>
  );
};

export default App;