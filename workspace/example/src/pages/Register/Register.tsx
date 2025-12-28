import React, { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

type RegisterFormValues = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type RegisterFormErrors = Partial<Record<keyof RegisterFormValues, string>>;

type AuthRegisterInput = {
  name: string;
  email: string;
  password: string;
};

type AuthRegisterResult = {
  ok: boolean;
  error?: string;
};

type AuthApi = {
  register: (input: AuthRegisterInput) => Promise<AuthRegisterResult>;
};

const useAuth = (): AuthApi => {
  const register = async (_input: AuthRegisterInput): Promise<AuthRegisterResult> => {
    await new Promise((r) => setTimeout(r, 400));
    return { ok: true };
  };
  return { register };
};

const EMAIL_REGEX =
  /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@(([^<>()[\]\]\\.,;:\s@"]+\.)+[^<>()[\]\]\\.,;:\s@"]{2,})$/i;

const MIN_PASSWORD_LENGTH = 8;

const initialValues: RegisterFormValues = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
};

const Register: React.FC = () => {
  const navigate = useNavigate();
  const auth = useAuth();

  const [values, setValues] = useState<RegisterFormValues>(initialValues);
  const [errors, setErrors] = useState<RegisterFormErrors>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const validate = useCallback((v: RegisterFormValues): RegisterFormErrors => {
    const next: RegisterFormErrors = {};

    if (!v.name.trim()) next.name = '请输入姓名';

    if (!v.email.trim()) {
      next.email = '请输入邮箱';
    } else if (!EMAIL_REGEX.test(v.email.trim())) {
      next.email = '邮箱格式不正确';
    }

    if (!v.password) {
      next.password = '请输入密码';
    } else if (v.password.length < MIN_PASSWORD_LENGTH) {
      next.password = `密码长度至少为 ${MIN_PASSWORD_LENGTH} 位`;
    }

    if (!v.confirmPassword) {
      next.confirmPassword = '请再次输入密码';
    } else if (v.confirmPassword !== v.password) {
      next.confirmPassword = '两次输入的密码不一致';
    }

    return next;
  }, []);

  const hasErrors = useMemo(() => Object.keys(errors).length > 0, [errors]);

  const onChange = useCallback(
    (key: keyof RegisterFormValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = { ...values, [key]: e.target.value };
      setValues(next);
      setFormError(null);

      if (Object.keys(errors).length > 0) {
        setErrors(validate(next));
      }
    },
    [errors, validate, values]
  );

  const onBlur = useCallback(() => {
    setErrors(validate(values));
  }, [validate, values]);

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setFormError(null);

      const nextErrors = validate(values);
      setErrors(nextErrors);

      if (Object.keys(nextErrors).length > 0) return;

      setSubmitting(true);
      try {
        const res = await auth.register({
          name: values.name.trim(),
          email: values.email.trim(),
          password: values.password,
        });

        if (!res.ok) {
          setFormError(res.error ?? '注册失败，请稍后重试');
          return;
        }

        navigate('/login', { replace: true });
      } catch (_err) {
        setFormError('注册失败，请稍后重试');
      } finally {
        setSubmitting(false);
      }
    },
    [auth, navigate, validate, values]
  );

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ margin: '0 0 16px' }}>注册</h1>

      <form onSubmit={onSubmit} noValidate>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>姓名</span>
            <input
              name="name"
              type="text"
              autoComplete="name"
              value={values.name}
              onChange={onChange('name')}
              onBlur={onBlur}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'name-error' : undefined}
              disabled={submitting}
            />
            {errors.name ? (
              <span id="name-error" role="alert" style={{ color: '#b00020', fontSize: 12 }}>
                {errors.name}
              </span>
            ) : null}
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>邮箱</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={values.email}
              onChange={onChange('email')}
              onBlur={onBlur}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'email-error' : undefined}
              disabled={submitting}
            />
            {errors.email ? (
              <span id="email-error" role="alert" style={{ color: '#b00020', fontSize: 12 }}>
                {errors.email}
              </span>
            ) : null}
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>密码</span>
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              value={values.password}
              onChange={onChange('password')}
              onBlur={onBlur}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'password-error' : undefined}
              disabled={submitting}
            />
            {errors.password ? (
              <span id="password-error" role="alert" style={{ color: '#b00020', fontSize: 12 }}>
                {errors.password}
              </span>
            ) : null}
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>确认密码</span>
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={values.confirmPassword}
              onChange={onChange('confirmPassword')}
              onBlur={onBlur}
              aria-invalid={Boolean(errors.confirmPassword)}
              aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
              disabled={submitting}
            />
            {errors.confirmPassword ? (
              <span
                id="confirmPassword-error"
                role="alert"
                style={{ color: '#b00020', fontSize: 12 }}
              >
                {errors.confirmPassword}
              </span>
            ) : null}
          </label>

          {formError ? (
            <div role="alert" style={{ color: '#b00020', fontSize: 13 }}>
              {formError}
            </div>
          ) : null}

          <button type="submit" disabled={submitting || hasErrors} style={{ height: 40 }}>
            {submitting ? '提交中...' : '注册'}
          </button>

          <div style={{ fontSize: 13 }}>
            已有账号？<Link to="/login">去登录</Link>
          </div>
        </div>
      </form>
    </div>
  );
};

export default Register;