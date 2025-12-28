import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type AuthTab = 'login' | 'register';

type AuthErrorMap = Partial<Record<'email' | 'password' | 'confirmPassword' | 'form', string>>;

type LoginPayload = {
  email: string;
  password: string;
};

type RegisterPayload = {
  email: string;
  password: string;
};

type AuthResponse = {
  accessToken: string;
};

const authApi = {
  login: async (_payload: LoginPayload): Promise<AuthResponse> => {
    return { accessToken: 'mock_access_token' };
  },
  register: async (_payload: RegisterPayload): Promise<AuthResponse> => {
    return { accessToken: 'mock_access_token' };
  },
};

function setAccessToken(_token: string): void {
  // placeholder: store token to localStorage/cookies/state manager
}

function isValidEmail(email: string): boolean {
  const v = email.trim();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();

  const [tab, setTab] = useState<AuthTab>('login');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [errors, setErrors] = useState<AuthErrorMap>({});
  const [submitting, setSubmitting] = useState<boolean>(false);

  const isRegister = tab === 'register';

  const resetErrors = useCallback(() => setErrors({}), []);
  const setFieldError = useCallback((field: keyof AuthErrorMap, message?: string) => {
    setErrors((prev) => {
      const next: AuthErrorMap = { ...prev };
      if (!message) {
        delete next[field];
        return next;
      }
      next[field] = message;
      return next;
    });
  }, []);

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (!email.trim() || !password) return false;
    if (isRegister && !confirmPassword) return false;
    return true;
  }, [email, password, confirmPassword, isRegister, submitting]);

  const validate = useCallback((): boolean => {
    const next: AuthErrorMap = {};

    const e = email.trim();
    if (!e) next.email = '请输入邮箱';
    else if (!isValidEmail(e)) next.email = '邮箱格式不正确';

    if (!password) next.password = '请输入密码';
    else if (password.length < 6) next.password = '密码至少 6 位';

    if (isRegister) {
      if (!confirmPassword) next.confirmPassword = '请再次输入密码';
      else if (confirmPassword !== password) next.confirmPassword = '两次输入的密码不一致';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }, [email, password, confirmPassword, isRegister]);

  const handleSwitchTab = useCallback(
    (nextTab: AuthTab) => {
      if (tab === nextTab) return;
      setTab(nextTab);
      resetErrors();
      setPassword('');
      setConfirmPassword('');
    },
    [tab, resetErrors]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      setSubmitting(true);
      setFieldError('form', undefined);

      try {
        const payloadEmail = email.trim();
        const payloadPassword = password;

        const res = isRegister
          ? await authApi.register({ email: payloadEmail, password: payloadPassword })
          : await authApi.login({ email: payloadEmail, password: payloadPassword });

        setAccessToken(res.accessToken);
        navigate('/orders', { replace: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : '操作失败，请稍后重试';
        setFieldError('form', message);
      } finally {
        setSubmitting(false);
      }
    },
    [validate, email, password, isRegister, navigate, setFieldError]
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        padding: 24,
        boxSizing: 'border-box',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 20,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => handleSwitchTab('login')}
            aria-pressed={tab === 'login'}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 10,
              border: tab === 'login' ? '1px solid #111827' : '1px solid #e5e7eb',
              background: tab === 'login' ? '#111827' : '#ffffff',
              color: tab === 'login' ? '#ffffff' : '#111827',
              cursor: 'pointer',
            }}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => handleSwitchTab('register')}
            aria-pressed={tab === 'register'}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 10,
              border: tab === 'register' ? '1px solid #111827' : '1px solid #e5e7eb',
              background: tab === 'register' ? '#111827' : '#ffffff',
              color: tab === 'register' ? '#ffffff' : '#111827',
              cursor: 'pointer',
            }}
          >
            注册
          </button>
        </div>

        <h1 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 700, color: '#111827' }}>
          {isRegister ? '创建账号' : '欢迎回来'}
        </h1>

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, color: '#374151' }}>邮箱</span>
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(ev) => {
                  setEmail(ev.target.value);
                  if (errors.email) setFieldError('email', undefined);
                  if (errors.form) setFieldError('form', undefined);
                }}
                placeholder="you@example.com"
                aria-invalid={Boolean(errors.email)}
                style={{
                  height: 40,
                  borderRadius: 10,
                  border: `1px solid ${errors.email ? '#ef4444' : '#e5e7eb'}`,
                  padding: '0 12px',
                  outline: 'none',
                }}
              />
              {errors.email ? (
                <span style={{ fontSize: 12, color: '#ef4444' }}>{errors.email}</span>
              ) : null}
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, color: '#374151' }}>密码</span>
              <input
                type="password"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                value={password}
                onChange={(ev) => {
                  setPassword(ev.target.value);
                  if (errors.password) setFieldError('password', undefined);
                  if (errors.confirmPassword && isRegister) setFieldError('confirmPassword', undefined);
                  if (errors.form) setFieldError('form', undefined);
                }}
                placeholder="请输入密码"
                aria-invalid={Boolean(errors.password)}
                style={{
                  height: 40,
                  borderRadius: 10,
                  border: `1px solid ${errors.password ? '#ef4444' : '#e5e7eb'}`,
                  padding: '0 12px',
                  outline: 'none',
                }}
              />
              {errors.password ? (
                <span style={{ fontSize: 12, color: '#ef4444' }}>{errors.password}</span>
              ) : null}
            </label>

            {isRegister ? (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, color: '#374151' }}>确认密码</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(ev) => {
                    setConfirmPassword(ev.target.value);
                    if (errors.confirmPassword) setFieldError('confirmPassword', undefined);
                    if (errors.form) setFieldError('form', undefined);
                  }}
                  placeholder="请再次输入密码"
                  aria-invalid={Boolean(errors.confirmPassword)}
                  style={{
                    height: 40,
                    borderRadius: 10,
                    border: `1px solid ${errors.confirmPassword ? '#ef4444' : '#e5e7eb'}`,
                    padding: '0 12px',
                    outline: 'none',
                  }}
                />
                {errors.confirmPassword ? (
                  <span style={{ fontSize: 12, color: '#ef4444' }}>{errors.confirmPassword}</span>
                ) : null}
              </label>
            ) : null}

            {errors.form ? (
              <div
                role="alert"
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid #fecaca',
                  background: '#fef2f2',
                  color: '#991b1b',
                  fontSize: 13,
                }}
              >
                {errors.form}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                height: 42,
                borderRadius: 10,
                border: '1px solid #111827',
                background: canSubmit ? '#111827' : '#9ca3af',
                color: '#ffffff',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                fontWeight: 600,
              }}
            >
              {submitting ? '提交中...' : isRegister ? '注册' : '登录'}
            </button>

            <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
              {isRegister ? (
                <span>
                  已有账号？{' '}
                  <button
                    type="button"
                    onClick={() => handleSwitchTab('login')}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      color: '#111827',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    去登录
                  </button>
                </span>
              ) : (
                <span>
                  还没有账号？{' '}
                  <button
                    type="button"
                    onClick={() => handleSwitchTab('register')}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      color: '#111827',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    去注册
                  </button>
                </span>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AuthPage;