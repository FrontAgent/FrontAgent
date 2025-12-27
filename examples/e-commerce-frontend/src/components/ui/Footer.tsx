import React from 'react';

interface IFooterProps {
  className?: string;
}

interface ILinkItem {
  title: string;
  url: string;
}

interface IContactInfo {
  label: string;
  value: string;
  icon?: string;
}

const Footer: React.FC<IFooterProps> = ({ className = '' }) => {
  const friendlyLinks: ILinkItem[] = [
    { title: '关于我们', url: '/about' },
    { title: '联系我们', url: '/contact' },
    { title: '帮助中心', url: '/help' },
    { title: '隐私政策', url: '/privacy' },
    { title: '服务条款', url: '/terms' },
    { title: '配送信息', url: '/shipping' },
  ];

  const customerService: IContactInfo[] = [
    { label: '客服热线', value: '400-123-4567', icon: '📞' },
    { label: '在线客服', value: '7x24小时服务', icon: '💬' },
    { label: '邮箱支持', value: 'service@example.com', icon: '📧' },
  ];

  return (
    <footer className={`bg-gray-900 text-white ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">友情链接</h3>
            <ul className="space-y-2">
              {friendlyLinks.map((link, index) => (
                <li key={index}>
                  <a
                    href={link.url}
                    className="text-gray-300 hover:text-white transition-colors duration-200 text-sm"
                  >
                    {link.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">客服信息</h3>
            <div className="space-y-3">
              {customerService.map((contact, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <span className="text-sm">{contact.icon}</span>
                  <div>
                    <p className="text-gray-300 text-sm">{contact.label}</p>
                    <p className="text-white text-sm font-medium">{contact.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">关于我们</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              专业的电商平台，致力于为用户提供优质的购物体验。我们拥有完善的供应链体系，
              严格的质量控制，以及贴心的售后服务。
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-300 hover:text-white transition-colors">
                <span className="sr-only">微信</span>
                <div className="w-6 h-6 bg-gray-600 rounded"></div>
              </a>
              <a href="#" className="text-gray-300 hover:text-white transition-colors">
                <span className="sr-only">微博</span>
                <div className="w-6 h-6 bg-gray-600 rounded"></div>
              </a>
              <a href="#" className="text-gray-300 hover:text-white transition-colors">
                <span className="sr-only">QQ</span>
                <div className="w-6 h-6 bg-gray-600 rounded"></div>
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-gray-300 text-sm">
              <p>&copy; 2024 电商平台. 保留所有权利.</p>
            </div>
            <div className="flex space-x-6 text-sm text-gray-300">
              <a href="/privacy" className="hover:text-white transition-colors">
                隐私政策
              </a>
              <a href="/terms" className="hover:text-white transition-colors">
                服务条款
              </a>
              <a href="/sitemap" className="hover:text-white transition-colors">
                网站地图
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;