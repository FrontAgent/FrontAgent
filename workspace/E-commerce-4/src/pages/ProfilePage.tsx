import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout, updateProfile } = useUserStore();
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editForm, setEditForm] = useState({
    nickname: user?.nickname || '',
    phone: user?.phone || '',
    email: user?.email || '',
  });
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  React.useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  React.useEffect(() => {
    if (user) {
      setEditForm({
        nickname: user.nickname || '',
        phone: user.phone || '',
        email: user.email || '',
      });
    }
  }, [user]);

  if (!isAuthenticated || !user) {
    return null;
  }

  const orderQuickLinks = [
    { label: '待付款', icon: '💳', status: 'pending', count: 2 },
    { label: '待发货', icon: '📦', status: 'paid', count: 1 },
    { label: '待收货', icon: '🚚', status: 'shipped', count: 3 },
    { label: '待评价', icon: '⭐', status: 'delivered', count: 0 },
  ];

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile(editForm);
    setIsEditing(false);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert('两次输入的密码不一致');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      alert('密码长度至少6位');
      return;
    }
    // 模拟密码修改成功
    alert('密码修改成功');
    setShowPasswordModal(false);
    setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
  };

  const handleLogout = () => {
    if (confirm('确定要退出登录吗？')) {
      logout();
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* 用户信息卡片 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center space-x-6">
            {/* 头像 */}
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.nickname}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  user.nickname?.charAt(0).toUpperCase() || user.username.charAt(0).toUpperCase()
                )}
              </div>
              <button className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center text-gray-600 hover:text-blue-600 transition-colors">
                📷
              </button>
            </div>

            {/* 用户信息 */}
            <div className="flex-1">
              {!isEditing ? (
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    {user.nickname || user.username}
                  </h2>
                  <p className="text-gray-500 mt-1">用户名: {user.username}</p>
                  {user.phone && <p className="text-gray-500">手机: {user.phone}</p>}
                  {user.email && <p className="text-gray-500">邮箱: {user.email}</p>}
                  <button
                    onClick={() => setIsEditing(true)}
                    className="mt-3 px-4 py-2 text-sm text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    编辑资料
                  </button>
                </div>
              ) : (
                <form onSubmit={handleEditSubmit} className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">昵称</label>
                    <input
                      type="text"
                      value={editForm.nickname}
                      onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">手机号</label>
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">邮箱</label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex space-x-3">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* 订单快捷入口 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">我的订单</h3>
            <button
              onClick={() => navigate('/orders')}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              查看全部 →
            </button>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {orderQuickLinks.map((item) => (
              <button
                key={item.status}
                onClick={() => navigate(`/orders?status=${item.status}`)}
                className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 transition-colors relative"
              >
                <span className="text-3xl mb-2">{item.icon}</span>
                <span className="text-sm text-gray-600">{item.label}</span>
                {item.count > 0 && (
                  <span className="absolute top-2 right-1/4 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 功能菜单 */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
          <button
            onClick={() => navigate('/addresses')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors border-b border-gray-100"
          >
            <div className="flex items-center space-x-3">
              <span className="text-xl">📍</span>
              <span className="text-gray-800">收货地址管理</span>
            </div>
            <span className="text-gray-400">→</span>
          </button>

          <button
            onClick={() => setShowPasswordModal(true)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors border-b border-gray-100"
          >
            <div className="flex items-center space-x-3">
              <span className="text-xl">🔒</span>
              <span className="text-gray-800">修改密码</span>
            </div>
            <span className="text-gray-400">→</span>
          </button>

          <button
            onClick={() => navigate('/favorites')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors border-b border-gray-100"
          >
            <div className="flex items-center space-x-3">
              <span className="text-xl">❤️</span>
              <span className="text-gray-800">我的收藏</span>
            </div>
            <span className="text-gray-400">→</span>
          </button>

          <button
            onClick={() => navigate('/help')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <span className="text-xl">❓</span>
              <span className="text-gray-800">帮助中心</span>
            </div>
            <span className="text-gray-400">→</span>
          </button>
        </div>

        {/* 退出登录按钮 */}
        <button
          onClick={handleLogout}
          className="w-full py-4 bg-white text-red-500 font-medium rounded-lg shadow-sm hover:bg-red-50 transition-colors"
        >
          退出登录
        </button>
      </div>

      {/* 修改密码弹窗 */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">修改密码</h3>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">当前密码</label>
                <input
                  type="password"
                  value={passwordForm.oldPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, oldPassword: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">新密码</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">确认新密码</label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex space-x-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  确认修改
                </button>
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;