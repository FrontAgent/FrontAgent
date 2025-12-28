import React, { useState, useCallback } from 'react';

interface LoginFormProps {
  onLogin?: (data: LoginData) => Promise<void>;
  onForgotPassword?: () => void;
  onRegister?: () => void;
  onSocialLogin?: (provider: SocialProvider) => void;
}

interface LoginData {
  account: string;
  password: string;
  rememberMe: boolean;
}

type SocialProvider = 'wechat' | 'qq' | 'weibo';

interface FormErrors {
  account?: string;
  password?: string;
  general?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onLogin,
  onForgotPassword,
  onRegister,
  onSocialLogin,
}) => {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!account.trim()) {
      newErrors.account = '请输入用户名/邮箱/手机号';
    } else if (account.includes('@')) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(account)) {
        newErrors.account = '请输入有效的邮箱地址';
      }
    } else if (/^\d+$/.test(account)) {
      const phoneRegex = /^1[3-9]\d{9}$/;
      if (!phoneRegex.test(account)) {
        newErrors.account = '请输入有效的手机号';
      }
    }

    if (!password) {
      newErrors.password = '请输入密码';
    } else if (password.length < 6) {
      newErrors.password = '密码长度至少6位';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [account, password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      if (onLogin) {
        await onLogin({ account, password, rememberMe });
      }
    } catch (error) {
      setErrors({
        general: error instanceof Error ? error.message : '登录失败，请重试',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = (provider: SocialProvider) => {
    if (onSocialLogin) {
      onSocialLogin(provider);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800">欢迎回来</h2>
          <p className="text-gray-500 mt-2">请登录您的账号</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {errors.general && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
              {errors.general}
            </div>
          )}

          <div>
            <label
              htmlFor="account"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              用户名/邮箱/手机号
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </span>
              <input
                id="account"
                type="text"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                  errors.account
                    ? 'border-red-300 focus:ring-red-200 focus:border-red-400'
                    : 'border-gray-300 focus:ring-blue-200 focus:border-blue-400'
                }`}
                placeholder="请输入用户名/邮箱/手机号"
              />
            </div>
            {errors.account && (
              <p className="mt-1 text-sm text-red-500">{errors.account}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              密码
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                  errors.password
                    ? 'border-red-300 focus:ring-red-200 focus:border-red-400'
                    : 'border-gray-300 focus:ring-blue-200 focus:border-blue-400'
                }`}
                placeholder="请输入密码"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-sm text-red-500">{errors.password}</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-600">记住我</span>
            </label>
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
            >
              忘记密码？
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                登录中...
              </>
            ) : (
              '登录'
            )}
          </button>
        </form>

        <div className="mt-8">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">其他登录方式</span>
            </div>
          </div>

          <div className="mt-6 flex justify-center space-x-6">
            <button
              type="button"
              onClick={() => handleSocialLogin('wechat')}
              className="w-12 h-12 flex items-center justify-center rounded-full bg-green-500 hover:bg-green-600 transition-colors"
              title="微信登录"
            >
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 01.598.082l1.584.926a.272.272 0 00.14.045c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 01-.023-.156.49.49 0 01.201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-7.062-6.122zm-2.036 2.96c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.982.969-.982zm4.08 0c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.982.969-.982z" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => handleSocialLogin('qq')}
              className="w-12 h-12 flex items-center justify-center rounded-full bg-blue-500 hover:bg-blue-600 transition-colors"
              title="QQ登录"
            >
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21.395 15.035a39.548 39.548 0 00-.803-2.264l-1.079-2.695c.001-.032.014-.562.014-.836 0-3.632-2.12-6.768-5.276-7.635A2.5 2.5 0 0012 0a2.5 2.5 0 00-2.251 1.605c-3.156.867-5.276 4.003-5.276 7.635 0 .274.013.804.014.836l-1.08 2.695a39.548 39.548 0 00-.802 2.264c-.214.771-.332 1.29-.332 1.584 0 .472.24.887.686 1.115a2.5 2.5 0 002.447-.451l.003.001a2.5 2.5 0 001.096.258c.273 0 .537-.043.781-.125.317 1.746 1.346 3.215 2.714 3.215.328 0 .635-.088.919-.235.284.147.591.235.919.235 1.368 0 2.397-1.469 2.714-3.215.244.082.508.125.781.125a2.5 2.5 0 001.096-.258l.003-.001a2.5 2.5 0 002.447.451c.446-.228.686-.643.686-1.115 0-.294-.118-.813-.332-1.584z" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => handleSocialLogin('weibo')}
              className="w-12 h-12 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-600 transition-colors"
              title="微博登录"
            >
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10.098 20.323c-3.977.391-7.414-1.406-7.672-4.02-.259-2.609 2.759-5.047 6.74-5.441 3.979-.394 7.413 1.404 7.671 4.018.259 2.6-2.759 5.049-6.737 5.443h-.002zm8.151-8.469c-.335-.096-.562-.162-.387-.585.381-.915.421-1.707.013-2.273-.767-1.064-2.864-1.006-5.266-.025 0 0-.757.308-.564-.249.371-1.107.314-2.032-.211-2.563-1.188-1.203-4.332.045-7.027 2.788C2.579 10.945 1.5 13.139 1.5 15.034c0 3.591 4.611 5.771 9.125 5.771 5.922 0 9.857-3.436 9.857-6.164 0-1.645-1.378-2.575-2.233-2.787v.002zm2.727-5.719a6.37 6.37 0 00-6.084-1.659c-.244.065-.399.312-.342.557.057.245.304.398.551.335a5.142 5.142 0 014.912 1.336 5.152 5.152 0 011.319 4.918.446.446 0 00.338.539.446.446 0 00.541-.338 6.363 6.363 0 00-1.235-6.086v.398zm-1.974.967a3.42 3.42 0 00-3.254-.927.31.31 0 10.152.599 2.799 2.799 0 012.659.758c.666.684.977 1.617.843 2.545a.311.311 0 00.246.361.31.31 0 00.363-.246 3.433 3.433 0 00-.91-3.09h.901z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-gray-600">
          还没有账号？
          <button
            type="button"
            onClick={onRegister}
            className="ml-1 text-blue-600 hover:text-blue-700 hover:underline font-medium"
          >
            立即注册
          </button>
        </div>
      </div>
    </div>
  );
};