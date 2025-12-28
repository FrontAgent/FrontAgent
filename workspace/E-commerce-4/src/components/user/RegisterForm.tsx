import React, { useState, useCallback } from 'react';

interface RegisterFormProps {
  onSubmit?: (data: RegisterFormData) => Promise<void>;
  onLoginClick?: () => void;
}

interface RegisterFormData {
  username: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  captcha: string;
  agreeTerms: boolean;
}

interface FormErrors {
  username?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  captcha?: string;
  agreeTerms?: string;
}

type PasswordStrength = 'weak' | 'medium' | 'strong';

export const RegisterForm: React.FC<RegisterFormProps> = ({
  onSubmit,
  onLoginClick,
}) => {
  const [formData, setFormData] = useState<RegisterFormData>({
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    captcha: '',
    agreeTerms: false,
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [captchaKey, setCaptchaKey] = useState(Date.now());

  const getPasswordStrength = (password: string): PasswordStrength => {
    if (password.length < 6) return 'weak';
    
    let score = 0;
    if (password.length >= 8) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    if (score >= 4) return 'strong';
    if (score >= 2) return 'medium';
    return 'weak';
  };

  const passwordStrength = getPasswordStrength(formData.password);

  const getStrengthColor = (strength: PasswordStrength): string => {
    switch (strength) {
      case 'weak':
        return 'bg-red-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'strong':
        return 'bg-green-500';
    }
  };

  const getStrengthText = (strength: PasswordStrength): string => {
    switch (strength) {
      case 'weak':
        return '弱';
      case 'medium':
        return '中';
      case 'strong':
        return '强';
    }
  };

  const getStrengthWidth = (strength: PasswordStrength): string => {
    switch (strength) {
      case 'weak':
        return 'w-1/3';
      case 'medium':
        return 'w-2/3';
      case 'strong':
        return 'w-full';
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = '请输入用户名';
    } else if (formData.username.length < 3) {
      newErrors.username = '用户名至少3个字符';
    } else if (formData.username.length > 20) {
      newErrors.username = '用户名最多20个字符';
    } else if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(formData.username)) {
      newErrors.username = '用户名只能包含字母、数字、下划线和中文';
    }

    if (!formData.email.trim()) {
      newErrors.email = '请输入邮箱';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '请输入有效的邮箱地址';
    }

    if (formData.phone && !/^1[3-9]\d{9}$/.test(formData.phone)) {
      newErrors.phone = '请输入有效的手机号';
    }

    if (!formData.password) {
      newErrors.password = '请输入密码';
    } else if (formData.password.length < 6) {
      newErrors.password = '密码至少6个字符';
    } else if (formData.password.length > 32) {
      newErrors.password = '密码最多32个字符';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = '请确认密码';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = '两次输入的密码不一致';
    }

    if (!formData.captcha.trim()) {
      newErrors.captcha = '请输入验证码';
    } else if (formData.captcha.length !== 4) {
      newErrors.captcha = '验证码为4位';
    }

    if (!formData.agreeTerms) {
      newErrors.agreeTerms = '请阅读并同意用户协议和隐私政策';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      if (onSubmit) {
        await onSubmit(formData);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        console.log('Register data:', formData);
      }
    } catch (error) {
      console.error('Registration failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshCaptcha = useCallback(() => {
    setCaptchaKey(Date.now());
    setFormData((prev) => ({ ...prev, captcha: '' }));
  }, []);

  const generateCaptchaSvg = (key: number): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    
    const colors = ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f39c12'];
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40">`;
    svg += `<rect width="120" height="40" fill="#f0f0f0"/>`;
    
    for (let i = 0; i < 5; i++) {
      const x1 = Math.random() * 120;
      const y1 = Math.random() * 40;
      const x2 = Math.random() * 120;
      const y2 = Math.random() * 40;
      svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#ddd" stroke-width="1"/>`;
    }
    
    for (let i = 0; i < 4; i++) {
      const x = 15 + i * 25;
      const y = 28 + (Math.random() - 0.5) * 8;
      const rotate = (Math.random() - 0.5) * 30;
      const color = colors[Math.floor(Math.random() * colors.length)];
      svg += `<text x="${x}" y="${y}" font-size="24" font-weight="bold" fill="${color}" transform="rotate(${rotate} ${x} ${y})">${code[i]}</text>`;
    }
    
    svg += `</svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="bg-white shadow-lg rounded-lg px-8 pt-6 pb-8">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">注册账号</h2>

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="username">
            用户名 <span className="text-red-500">*</span>
          </label>
          <input
            id="username"
            name="username"
            type="text"
            value={formData.username}
            onChange={handleInputChange}
            placeholder="请输入用户名"
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
              errors.username
                ? 'border-red-500 focus:ring-red-200'
                : 'border-gray-300 focus:ring-blue-200 focus:border-blue-500'
            }`}
          />
          {errors.username && (
            <p className="mt-1 text-sm text-red-500">{errors.username}</p>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="email">
            邮箱 <span className="text-red-500">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="请输入邮箱地址"
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
              errors.email
                ? 'border-red-500 focus:ring-red-200'
                : 'border-gray-300 focus:ring-blue-200 focus:border-blue-500'
            }`}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-500">{errors.email}</p>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="phone">
            手机号 <span className="text-gray-400 text-xs">（选填）</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={handleInputChange}
            placeholder="请输入手机号"
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
              errors.phone
                ? 'border-red-500 focus:ring-red-200'
                : 'border-gray-300 focus:ring-blue-200 focus:border-blue-500'
            }`}
          />
          {errors.phone && (
            <p className="mt-1 text-sm text-red-500">{errors.phone}</p>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="password">
            密码 <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleInputChange}
              placeholder="请输入密码"
              className={`w-full px-4 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                errors.password
                  ? 'border-red-500 focus:ring-red-200'
                  : 'border-gray-300 focus:ring-blue-200 focus:border-blue-500'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showPassword ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
          {formData.password && (
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getStrengthColor(passwordStrength)} ${getStrengthWidth(passwordStrength)} transition-all duration-300`}
                  />
                </div>
                <span className={`text-xs font-medium ${
                  passwordStrength === 'weak' ? 'text-red-500' :
                  passwordStrength === 'medium' ? 'text-yellow-500' : 'text-green-500'
                }`}>
                  {getStrengthText(passwordStrength)}
                </span>
              </div>
            </div>
          )}
          {errors.password && (
            <p className="mt-1 text-sm text-red-500">{errors.password}</p>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="confirmPassword">
            确认密码 <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={handleInputChange}
              placeholder="请再次输入密码"
              className={`w-full px-4 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                errors.confirmPassword
                  ? 'border-red-500 focus:ring-red-200'
                  : 'border-gray-300 focus:ring-blue-200 focus:border-blue-500'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showConfirmPassword ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="mt-1 text-sm text-red-500">{errors.confirmPassword}</p>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="captcha">
            验证码 <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              id="captcha"
              name="captcha"
              type="text"
              value={formData.captcha}
              onChange={handleInputChange}
              placeholder="请输入验证码"
              maxLength={4}
              className={`flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                errors.captcha
                  ? 'border-red-500 focus:ring-red-200'
                  : 'border-gray-300 focus:ring-blue-200 focus:border-blue-500'
              }`}
            />
            <img
              src={generateCaptchaSvg(captchaKey)}
              alt="验证码"
              className="h-10 w-30 border border-gray-300 rounded cursor-pointer"
              onClick={refreshCaptcha}
            />
          </div>
          {errors.captcha && (
            <p className="mt-1 text-sm text-red-500">{errors.captcha}</p>
          )}
        </div>

        <div className="mb-6">
          <label className="flex items-start">
            <input
              type="checkbox"
              name="agreeTerms"
              checked={formData.agreeTerms}
              onChange={handleInputChange}
              className={`mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 ${
                errors.agreeTerms ? 'border-red-500' : ''
              }`}
            />
            <span className="ml-2 text-sm text-gray-700">
              我已阅读并同意
              <a href="#" className="text-blue-600 hover:underline">《用户协议》</a>
              和
              <a href="#" className="text-blue-600 hover:underline">《隐私政策》</a>
            </span>
          </label>
          {errors.agreeTerms && (
            <p className="mt-1 text-sm text-red-500">{errors.agreeTerms}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              注册中...
            </>
          ) : (
            '注册'
          )}
        </button>

        <div className="mt-6 text-center text-sm text-gray-600">
          已有账号？
          <button
            type="button"
            onClick={onLoginClick}
            className="ml-1 text-blue-600 hover:text-blue-700 hover:underline font-medium"
          >
            立即登录
          </button>
        </div>
      </form>
    </div>
  );
};