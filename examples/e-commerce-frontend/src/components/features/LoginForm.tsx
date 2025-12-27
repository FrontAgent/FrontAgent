import React, { useState } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { Alert } from '../ui/Alert';

/**
 * 登录表单组件属性接口
 */
interface ILoginFormProps {
  /** 登录成功后的回调函数 */
  onSuccess?: () => void;
  /** 切换到注册页面的回调函数 */
  onSwitchToRegister?: () => void;
}

/**
 * 登录表单数据类型
 */
interface ILoginFormData {
  email: string;
  password: string;
}

/**
 * 表单验证错误类型
 */
interface IFormErrors {
  email?: string;
  password?: string;
  general?: string;
}

/**
 * 用户登录表单组件
 * 
 * 该组件提供完整的用户登录功能，包括：
 * - 邮箱和密码输入
 * - 表单验证
 * - 错误处理
 * - 加载状态管理
 * - 响应式设计
 */
const LoginForm: React.FC<ILoginFormProps> = ({
  onSuccess,
  onSwitchToRegister,
}) => {
  // 状态管理
  const [formData, setFormData] = useState<ILoginFormData>({
    email: '',
    password: '',
  });
  
  const [errors, setErrors] = useState<IFormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  // 使用认证状态管理store
  const { login } = useAuthStore();

  /**
   * 验证邮箱格式
   */
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  /**
   * 验证密码格式
   */
  const validatePassword = (password: string): boolean => {
    return password.length >= 6;
  };

  /**
   * 验证表单数据
   */
  const validateForm = (): boolean => {
    const newErrors: IFormErrors = {};

    // 验证邮箱
    if (!formData.email.trim()) {
      newErrors.email = '请输入邮箱地址';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = '请输入有效的邮箱地址';
    }

    // 验证密码
    if (!formData.password.trim()) {
      newErrors.password = '请输入密码';
    } else if (!validatePassword(formData.password)) {
      newErrors.password = '密码长度至少为6位';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * 处理输入框变化
   */
  const handleInputChange = (
    field: keyof ILoginFormData,
    value: string
  ): void => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // 清除对应字段的错误信息
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined,
      }));
    }
  };

  /**
   * 处理表单提交
   */
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    
    // 清除之前的错误
    setErrors({});
    
    // 验证表单
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // 调用登录接口
      await login({
        email: formData.email.trim(),
        password: formData.password,
      });

      // 登录成功，执行成功回调
      onSuccess?.();
    } catch (error) {
      // 处理登录错误
      const errorMessage = error instanceof Error 
        ? error.message 
        : '登录失败，请稍后重试';
      
      setErrors({
        general: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto p-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          用户登录
        </h2>
        <p className="text-gray-600">
          请输入您的邮箱和密码来登录账户
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 通用错误提示 */}
        {errors.general && (
          <Alert
            type="error"
            message={errors.general}
            className="mb-4"
          />
        )}

        {/* 邮箱输入框 */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            邮箱地址
          </label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            placeholder="请输入邮箱地址"
            error={errors.email}
            disabled={isLoading}
            autoComplete="email"
            required
          />
        </div>

        {/* 密码输入框 */}
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            密码
          </label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => handleInputChange('password', e.target.value)}
            placeholder="请输入密码"
            error={errors.password}
            disabled={isLoading}
            autoComplete="current-password"
            required
          />
        </div>

        {/* 登录按钮 */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={isLoading}
          loading={isLoading}
          className="w-full mt-6"
        >
          {isLoading ? '登录中...' : '登录'}
        </Button>

        {/* 切换到注册 */}
        {onSwitchToRegister && (
          <div className="text-center mt-4">
            <p className="text-sm text-gray-600">
              还没有账户？{' '}
              <button
                type="button"
                onClick={onSwitchToRegister}
                disabled={isLoading}
                className="text-blue-600 hover:text-blue-500 font-medium disabled:opacity-50"
              >
                立即注册
              </button>
            </p>
          </div>
        )}
      </form>
    </Card>
  );
};

export default LoginForm;