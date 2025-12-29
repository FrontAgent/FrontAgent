import React, { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

type LoginFormState = {
  account: string;
  password: string;
};

type FormErrors = Partial<Record<keyof LoginFormState, string>>;

function validate(values: LoginFormState): FormErrors {
  const errors: FormErrors = {};
  if (!values.account.trim()) errors.account = '请输入账号';
  if (!values.password) errors.password = '请输入密码';
  return errors;
}

function mockLoginApi(input: LoginFormState): Promise<{ token: string }> {
  return new Promise((resolve, reject) => {
    window.setTimeout(() => {
      if (input.account.trim().toLowerCase() === 'admin' && input.password === 'admin') {
        resolve({ token: 'mock_token_admin' });
        return;
      }
      if (input.password.length >= 6) {
        resolve({ token: 'mock_token_user' });
        return;
      }
      reject(new Error('账号或密码错误'));
    }, 600);
  });
}

const LoginPage: React.FC = () => {
  const navigate = useNavigate();

  const [values, setValues] = useState<LoginFormState>({ account: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const canSubmit = useMemo(() => {
    return !isSubmitting && values.account.trim().length > 0 && values.password.length > 0;
  }, [isSubmitting, values.account, values.password]);

  const onChangeAccount = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setValues((prev) => ({ ...prev, account: next }));
    setFieldErrors((prev) => ({ ...prev, account: undefined }));
    setSubmitError('');
  }, []);

  const onChangePassword = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setValues((prev) => ({ ...prev, password: next }));
    setFieldErrors((prev) => ({ ...prev, password: undefined }));
    setSubmitError('');
  }, []);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const errors = validate(values);
      setFieldErrors(errors);
      setSubmitError('');

      if (Object.keys(errors).length > 0) return;

      setIsSubmitting(true);
      try {
        const result = await mockLoginApi(values);

        // TODO: 接入真实 auth API（例如 /auth/login），并处理错误码/消息映射
        // TODO: token 持久化（localStorage/cookie）以及设置全局登录态（context/store）
        void result;

        navigate('/', { replace: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : '登录失败，请稍后重试';
        setSubmitError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [navigate, values]
  );

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <h1 style={{ margin: 0, marginBottom: 16, fontSize: 24, fontWeight: 700 }}>登录</h1>

        <form onSubmit={onSubmit} noValidate>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <label htmlFor="account" style={{ fontSize: 14, fontWeight: 600 }}>
                账号
              </label>
              <input
                id="account"
                name="account"
                type="text"
                autoComplete="username"
                value={values.account}
                onChange={onChangeAccount}
                disabled={isSubmitting}
                placeholder="请输入账号"
                aria-invalid={Boolean(fieldErrors.account)}
                aria-describedby={fieldErrors.account ? 'account-error' : undefined}
                style={{
                  height: 40,
                  padding: '0 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(0,0,0,0.2)',
                  outline: 'none'
                }}
              />
              <div
                id="account-error"
                role={fieldErrors.account ? 'alert' : undefined}
                aria-live="polite"
                style={{
                  minHeight: 18,
                  color: '#b00020',
                  fontSize: 12
                }}
              >
                {fieldErrors.account ?? ''}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              <label htmlFor="password" style={{ fontSize: 14, fontWeight: 600 }}>
                密码
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={values.password}
                onChange={onChangePassword}
                disabled={isSubmitting}
                placeholder="请输入密码"
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                style={{
                  height: 40,
                  padding: '0 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(0,0,0,0.2)',
                  outline: 'none'
                }}
              />
              <div
                id="password-error"
                role={fieldErrors.password ? 'alert' : undefined}
                aria-live="polite"
                style={{
                  minHeight: 18,
                  color: '#b00020',
                  fontSize: 12
                }}
              >
                {fieldErrors.password ?? ''}
              </div>
            </div>

            <div
              role={submitError ? 'alert' : undefined}
              aria-live="polite"
              style={{
                minHeight: 20,
                color: '#b00020',
                fontSize: 13
              }}
            >
              {submitError || ''}
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                height: 42,
                borderRadius: 8,
                border: '1px solid rgba(0,0,0,0.15)',
                background: canSubmit ? '#111827' : 'rgba(17,24,39,0.5)',
                color: '#fff',
                fontWeight: 700,
                cursor: canSubmit ? 'pointer' : 'not-allowed'
              }}
            >
              {isSubmitting ? '登录中...' : '登录'}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'rgba(0,0,0,0.7)' }}>没有账号？</span>
              <Link to="/auth/register" style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                去注册
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;