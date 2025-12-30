import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-900 text-gray-300 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-white text-lg font-semibold mb-4">关于我们</h3>
            <ul className="space-y-2">
              <li>
                <a href="/about" className="hover:text-white transition-colors">
                  公司简介
                </a>
              </li>
              <li>
                <a href="/careers" className="hover:text-white transition-colors">
                  加入我们
                </a>
              </li>
              <li>
                <a href="/news" className="hover:text-white transition-colors">
                  新闻动态
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-white text-lg font-semibold mb-4">客户服务</h3>
            <ul className="space-y-2">
              <li>
                <a href="/contact" className="hover:text-white transition-colors">
                  联系我们
                </a>
              </li>
              <li>
                <a href="/privacy" className="hover:text-white transition-colors">
                  隐私政策
                </a>
              </li>
              <li>
                <a href="/terms" className="hover:text-white transition-colors">
                  服务条款
                </a>
              </li>
              <li>
                <a href="/faq" className="hover:text-white transition-colors">
                  常见问题
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-white text-lg font-semibold mb-4">关注我们</h3>
            <div className="flex space-x-4">
              <a
                href="https://weibo.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-gray-700 transition-colors"
                aria-label="微博"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9.93 13.5c-.26-.23-.44-.5-.54-.82-.1-.32-.08-.65.06-.98.14-.33.38-.6.7-.79.32-.19.68-.27 1.05-.23.37.04.7.2.98.46.28.26.46.58.54.96.08.38.04.76-.12 1.12-.16.36-.43.65-.78.85-.35.2-.74.28-1.13.24-.39-.04-.74-.22-1.03-.51-.29-.29-.48-.66-.56-1.08-.08-.42-.02-.84.18-1.23.2-.39.51-.7.9-.91.39-.21.82-.3 1.26-.26.44.04.85.21 1.19.49.34.28.58.64.7 1.05.12.41.11.84-.03 1.25-.14.41-.4.76-.76 1.02-.36.26-.78.41-1.23.43-.45.02-.89-.09-1.28-.32-.39-.23-.7-.56-.91-.96-.21-.4-.3-.84-.26-1.29.04-.45.21-.87.49-1.22.28-.35.64-.61 1.06-.76.42-.15.87-.18 1.31-.09.44.09.84.3 1.17.61.33.31.56.7.67 1.13.11.43.09.88-.06 1.3-.15.42-.42.78-.78 1.06-.36.28-.79.45-1.25.49-.46.04-.91-.04-1.32-.23-.41-.19-.76-.48-1.02-.85-.26-.37-.41-.8-.43-1.25-.02-.45.08-.89.29-1.28.21-.39.52-.71.9-.94.38-.23.81-.35 1.26-.35.45 0 .88.12 1.26.35.38.23.69.55.9.94.21.39.31.83.29 1.28z"/>
                </svg>
              </a>
              <a
                href="https://wechat.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-gray-700 transition-colors"
                aria-label="微信"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8.5 9.5c0 .55-.45 1-1 1s-1-.45-1-1 .45-1 1-1 1 .45 1 1zm6 0c0 .55-.45 1-1 1s-1-.45-1-1 .45-1 1-1 1 .45 1 1zm2.5 6.5c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-4 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm5.5-8c-3.31 0-6 2.24-6 5 0 .34.04.67.11.99-3.87-.13-7.11-2.73-7.11-5.99 0-3.31 3.13-6 7-6 3.52 0 6.44 2.23 6.89 5.11.31-.07.63-.11.96-.11.17 0 .34.01.5.03-.41-2.93-3.39-5.03-6.85-5.03-4.42 0-8 3.13-8 7 0 2.38 1.19 4.47 3.08 5.74.15 1.43.94 2.75 2.42 3.26-.15-.41-.23-.85-.23-1.3 0-1.93 1.57-3.5 3.5-3.5.17 0 .34.01.5.04-.04-.18-.06-.36-.06-.54 0-2.21 1.79-4 4-4s4 1.79 4 4-1.79 4-4 4z"/>
                </svg>
              </a>
              <a
                href="https://douyin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-gray-700 transition-colors"
                aria-label="抖音"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center">
          <p className="text-sm">
            © 2024 电商网站. 保留所有权利.
          </p>
        </div>
      </div>
    </footer>
  );
};