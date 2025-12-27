import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { validateEmail, validatePassword, validateUsername } from '../utils/validation';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { PasswordStrengthIndicator } from '../components/features/PasswordStrengthIndicator';

interface IRegisterForm {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface IFormErrors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

/**
 * 用户注册页面组件
 * 提供用户注册功能，包含表单验证和密码强度检查
 */
export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register, isLoading } = useAuthStore();
  
  const [formData, setFormData] = useState<IRegisterForm>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState<IFormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  /**
   * 处理输入字段变化
   */
  const handleInputChange = (field: keyof IRegisterForm, value: string): void => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (touched[field]) {
      validateField(field, value);
    }
  };

  /**
   * 处理字段失焦事件
   */
  const handleBlur = (field: keyof IRegisterForm): void => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateField(field, formData[field]);
  };

  /**
   * 验证单个字段
   */
  const validateField = (field: keyof IRegisterForm, value: string): void => {
    const newErrors = { ...errors };

    switch (field) {
      case 'username':
        newErrors.username = validateUsername(value);
        break;
      case 'email':
        newErrors.email = validateEmail(value);
        break;
      case 'password':
        newErrors.password = validatePassword(value);
        if (formData.confirmPassword) {
          newErrors.confirmPassword = value === formData.confirmPassword 
            ? undefined 
            : '密码不匹配';
        }
        break;
      case 'confirmPassword':
        newErrors.confirmPassword = value === formData.password 
          ? undefined 
          : '密码不匹配';
        break;
    }

    setErrors(newErrors);
  };

  /**
   * 验证整个表单
   */
  const validateForm = (): boolean => {
    const newErrors: IFormErrors = {};
    
    newErrors.username = validateUsername(formData.username);
    newErrors.email = validateEmail(formData.email);
    newErrors.password = validatePassword(formData.password);
    newErrors.confirmPassword = formData.password === formData.confirmPassword 
      ? undefined 
      : '密码不匹配';

    setErrors(newErrors);
    setTouched({
      username: true,
      email: true,
      password: true,
      confirmPassword: true,
    });

    return !Object.values(newErrors).some(error => error);
  };

  /**
   * 处理表单提交
   */
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
      });
      navigate('/login');
    } catch (error) {
      setErrors({
        confirmPassword: '注册失败，请稍后重试',
      });
    }
  };

  /**
   * 检查字段是否有错误
   */
  const hasError = (field: keyof IFormErrors): boolean => {
    return Boolean(touched[field] && errors[field]);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            创建您的账户
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            已有账户？
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              立即登录
            </button>
          </p>
        </div>
        
        <Card className="p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <Input
                id="username"
                name="username"
                type="text"
                label="用户名"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                onBlur={() => handleBlur('username')}
                error={hasError('username') ? errors.username : undefined}
                placeholder="请输入用户名"
                required
              />
            </div>

            <div>
              <Input
                id="email"
                name="email"
                type="email"
                label="邮箱地址"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                onBlur={() => handleBlur('email')}
                error={hasError('email') ? errors.email : undefined}
                placeholder="请输入邮箱地址"
                required
              />
            </div>

            <div>
              <Input
                id="password"
                name="password"
                type="password"
                label="密码"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                onBlur={() => handleBlur('password')}
                error={hasError('password') ? errors.password : undefined}
                placeholder="请输入密码"
                required
              />
              
              {formData.password && (
                <PasswordStrengthIndicator password={formData.password} />
              )}
            </div>

            <div>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                label="确认密码"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                onBlur={() => handleBlur('confirmPassword')}
                error={hasError('confirmPassword') ? errors.confirmPassword : undefined}
                placeholder="请再次输入密码"
                required
              />
            </div>

            <div>
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? '注册中...' : '注册'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};