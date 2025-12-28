import React, { useState, useRef } from 'react';

interface UserInfo {
  avatar: string;
  username: string;
  nickname: string;
  email: string;
  phone: string;
  memberLevel: string;
  points: number;
}

interface FormErrors {
  nickname?: string;
  email?: string;
  phone?: string;
}

export const UserProfile: React.FC = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo>({
    avatar: '',
    username: 'user123',
    nickname: '张三',
    email: 'zhangsan@example.com',
    phone: '13800138000',
    memberLevel: '黄金会员',
    points: 2580,
  });
  const [editForm, setEditForm] = useState<UserInfo>(userInfo);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!editForm.nickname.trim()) {
      newErrors.nickname = '昵称不能为空';
    } else if (editForm.nickname.length > 20) {
      newErrors.nickname = '昵称不能超过20个字符';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!editForm.email.trim()) {
      newErrors.email = '邮箱不能为空';
    } else if (!emailRegex.test(editForm.email)) {
      newErrors.email = '请输入有效的邮箱地址';
    }

    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!editForm.phone.trim()) {
      newErrors.phone = '手机号不能为空';
    } else if (!phoneRegex.test(editForm.phone)) {
      newErrors.phone = '请输入有效的手机号';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAvatarClick = () => {
    if (isEditing) {
      fileInputRef.current?.click();
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('图片大小不能超过5MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setEditForm({ ...editForm, avatar: result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEdit = () => {
    setEditForm(userInfo);
    setIsEditing(true);
    setErrors({});
  };

  const handleCancel = () => {
    setEditForm(userInfo);
    setIsEditing(false);
    setErrors({});
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setUserInfo(editForm);
      setIsEditing(false);
    } catch (error) {
      alert('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: keyof UserInfo, value: string) => {
    setEditForm({ ...editForm, [field]: value });
    if (errors[field as keyof FormErrors]) {
      setErrors({ ...errors, [field]: undefined });
    }
  };

  const getMemberLevelColor = (level: string): string => {
    switch (level) {
      case '钻石会员':
        return 'bg-purple-100 text-purple-800';
      case '黄金会员':
        return 'bg-yellow-100 text-yellow-800';
      case '白银会员':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {/* 头部区域 */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-8">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* 头像 */}
              <div className="relative">
                <div
                  onClick={handleAvatarClick}
                  className={`w-24 h-24 rounded-full bg-white flex items-center justify-center overflow-hidden border-4 border-white shadow-lg ${
                    isEditing ? 'cursor-pointer hover:opacity-80' : ''
                  }`}
                >
                  {(isEditing ? editForm.avatar : userInfo.avatar) ? (
                    <img
                      src={isEditing ? editForm.avatar : userInfo.avatar}
                      alt="头像"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <svg
                      className="w-12 h-12 text-gray-400"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                  )}
                </div>
                {isEditing && (
                  <div className="absolute bottom-0 right-0 bg-blue-600 rounded-full p-1.5 border-2 border-white">
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>

              {/* 用户基本信息 */}
              <div className="text-center sm:text-left text-white">
                <h1 className="text-2xl font-bold">{userInfo.nickname}</h1>
                <p className="text-blue-100 mt-1">@{userInfo.username}</p>
                <div className="flex items-center gap-3 mt-3 justify-center sm:justify-start">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${getMemberLevelColor(
                      userInfo.memberLevel
                    )}`}
                  >
                    {userInfo.memberLevel}
                  </span>
                  <span className="flex items-center gap-1 text-yellow-300">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span className="font-medium">{userInfo.points} 积分</span>
                  </span>
                </div>
              </div>

              {/* 编辑按钮 */}
              {!isEditing && (
                <button
                  onClick={handleEdit}
                  className="sm:ml-auto bg-white text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-blue-50 transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  编辑资料
                </button>
              )}
            </div>
          </div>

          {/* 个人信息表单 */}
          <div className="px-6 py-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">个人信息</h2>
            <div className="space-y-4">
              {/* 用户名（只读） */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
                <input
                  type="text"
                  value={userInfo.username}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">用户名不可修改</p>
              </div>

              {/* 昵称 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">昵称</label>
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      value={editForm.nickname}
                      onChange={(e) => handleInputChange('nickname', e.target.value)}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.nickname ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="请输入昵称"
                    />
                    {errors.nickname && (
                      <p className="text-red-500 text-sm mt-1">{errors.nickname}</p>
                    )}
                  </>
                ) : (
                  <p className="px-4 py-2 text-gray-900">{userInfo.nickname}</p>
                )}
              </div>

              {/* 邮箱 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
                {isEditing ? (
                  <>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.email ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="请输入邮箱"
                    />
                    {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                  </>
                ) : (
                  <p className="px-4 py-2 text-gray-900">{userInfo.email}</p>
                )}
              </div>

              {/* 手机号 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">手机号</label>
                {isEditing ? (
                  <>
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.phone ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="请输入手机号"
                    />
                    {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
                  </>
                ) : (
                  <p className="px-4 py-2 text-gray-900">{userInfo.phone}</p>
                )}
              </div>
            </div>

            {/* 编辑模式下的按钮 */}
            {isEditing && (
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      保存中...
                    </>
                  ) : (
                    '保存修改'
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                >
                  取消
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};