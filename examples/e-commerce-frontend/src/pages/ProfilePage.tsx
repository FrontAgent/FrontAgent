import React, { useState } from 'react';
import { UserIcon, MapPinIcon, HeartIcon, CogIcon } from '@heroicons/react/24/outline';
import { IUser } from '../types/user';
import { IAddress } from '../types/address';
import { IFavorite } from '../types/favorite';

interface ProfilePageProps {
  user?: IUser;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'addresses' | 'favorites' | 'settings'>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [editedUser, setEditedUser] = useState<IUser>(user || {} as IUser);

  const handleSaveProfile = () => {
    // TODO: Implement save profile logic
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedUser(user || {} as IUser);
    setIsEditing(false);
  };

  const tabs = [
    { id: 'profile', label: '个人信息', icon: UserIcon },
    { id: 'addresses', label: '地址管理', icon: MapPinIcon },
    { id: 'favorites', label: '收藏夹', icon: HeartIcon },
    { id: 'settings', label: '设置', icon: CogIcon },
  ] as const;

  const renderProfileTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium text-gray-900">基本信息</h3>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100"
            >
              编辑
            </button>
          ) : (
            <div className="space-x-2">
              <button
                onClick={handleSaveProfile}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                保存
              </button>
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                取消
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">姓名</label>
            {isEditing ? (
              <input
                type="text"
                value={editedUser.name || ''}
                onChange={(e) => setEditedUser({ ...editedUser, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-gray-900">{user?.name || '未设置'}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">邮箱</label>
            {isEditing ? (
              <input
                type="email"
                value={editedUser.email || ''}
                onChange={(e) => setEditedUser({ ...editedUser, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-gray-900">{user?.email || '未设置'}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">手机号</label>
            {isEditing ? (
              <input
                type="tel"
                value={editedUser.phone || ''}
                onChange={(e) => setEditedUser({ ...editedUser, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-gray-900">{user?.phone || '未设置'}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">生日</label>
            {isEditing ? (
              <input
                type="date"
                value={editedUser.birthday || ''}
                onChange={(e) => setEditedUser({ ...editedUser, birthday: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-gray-900">{user?.birthday || '未设置'}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderAddressesTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium text-gray-900">我的地址</h3>
          <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
            添加新地址
          </button>
        </div>

        <div className="space-y-4">
          {user?.addresses?.map((address: IAddress) => (
            <div key={address.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h4 className="font-medium text-gray-900">{address.recipientName}</h4>
                    <span className="text-sm text-gray-500">{address.phone}</span>
                    {address.isDefault && (
                      <span className="px-2 py-1 text-xs font-medium text-blue-600 bg-blue-100 rounded">
                        默认
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600">
                    {address.province} {address.city} {address.district} {address.detail}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button className="text-sm text-blue-600 hover:text-blue-800">编辑</button>
                  <button className="text-sm text-red-600 hover:text-red-800">删除</button>
                </div>
              </div>
            </div>
          )) || (
            <div className="text-center py-8 text-gray-500">
              暂无地址，点击"添加新地址"开始添加
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderFavoritesTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium text-gray-900">我的收藏</h3>
          <div className="flex space-x-2">
            <select className="px-3 py-2 border border-gray-300 rounded-md text-sm">
              <option>全部商品</option>
              <option>服装</option>
              <option>电子产品</option>
              <option>家居用品</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {user?.favorites?.map((favorite: IFavorite) => (
            <div key={favorite.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
              <div className="aspect-w-1 aspect-h-1 bg-gray-200">
                <img
                  src={favorite.product.image}
                  alt={favorite.product.name}
                  className="w-full h-48 object-cover"
                />
              </div>
              <div className="p-4">
                <h4 className="font-medium text-gray-900 mb-2">{favorite.product.name}</h4>
                <p className="text-lg font-semibold text-blue-600 mb-3">
                  ¥{favorite.product.price}
                </p>
                <div className="flex space-x-2">
                  <button className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
                    加入购物车
                  </button>
                  <button className="px-3 py-2 text-sm text-red-600 border border-red-600 rounded-md hover:bg-red-50">
                    取消收藏
                  </button>
                </div>
              </div>
            </div>
          )) || (
            <div className="col-span-full text-center py-8 text-gray-500">
              暂无收藏商品
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderSettingsTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6">账户设置</h3>
        
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">消息通知</h4>
              <p className="text-sm text-gray-500">接收订单状态和促销信息</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">隐私设置</h4>
              <p className="text-sm text-gray-500">控制个人信息的可见性</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="border-t pt-6">
            <h4 className="font-medium text-gray-900 mb-4">修改密码</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">当前密码</label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">新密码</label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">确认新密码</label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
                更新密码
              </button>
            </div>
          </div>

          <div className="border-t pt-6">
            <h4 className="font-medium text-red-600 mb-4">危险操作</h4>
            <button className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">
              注销账户
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return renderProfileTab();
      case 'addresses':
        return renderAddressesTab();
      case 'favorites':
        return renderFavoritesTab();
      case 'settings':
        return renderSettingsTab();
      default:
        return renderProfileTab();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">个人中心</h1>
          <p className="mt-2 text-sm text-gray-600">管理您的个人信息和偏好设置</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="lg:w-64">
            <nav className="bg-white rounded-lg shadow p-4">
              <ul className="space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <li key={tab.id}>
                      <button
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                          activeTab === tab.id
                            ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className="mr-3 h-5 w-5" />
                        {tab.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;