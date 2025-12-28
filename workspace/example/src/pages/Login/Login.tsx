import React, { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

type LoginFormValues = {
  email: string;
  password: string;
};

type LoginFormErrors = Partial<Record<keyof LoginFormValues, string>> & {
  form?: string;
};

type AuthLoginInput = {
  email: string;
  password: string;
};

type AuthLoginResult = {
  ok: boolean;
  error?: string;
};

type AuthApi = {
  login: (input: AuthLoginInput) => Promise<AuthLoginResult>;
};

const useAuth = (): AuthApi => {
  const login = useCallback(async (_input: AuthLoginInput): Promise<AuthLoginResult> => {
    return { ok: false, error: 'Auth hook is not implemented.' };
  }, []);

  return useMemo(() => ({ login }), [login]);
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validate = (values: LoginFormValues): LoginFormErrors => {
  const errors: LoginFormErrors = {};

  const email = values.email.trim();
  if (!email) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_REGEX.test(email)) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!values.password) {
    errors.password = 'Password is required.';
  } else if (values.password.length < 8) {
    errors.password = 'Password must be at least 8 characters.';
  }

  return errors;
};

const Login: React.FC = () => {
  const navigate = useNavigate();
  const auth = useAuth();

  const [values, setValues] = useState<LoginFormValues>({ email: '', password: '' });
  const [errors, setErrors] = useState<LoginFormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof LoginFormValues, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setFieldValue = useCallback(<K extends keyof LoginFormValues>(key: K, value: LoginFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setFieldTouched = useCallback(<K extends keyof LoginFormValues>(key: K) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
  }, []);

  const visibleErrors = useMemo(() => {
    const next: LoginFormErrors = {};
    if (touched.email && errors.email) next.email = errors.email;
    if (touched.password && errors.password) next.password = errors.password;
    if (errors.form) next.form = errors.form;
    return next;
  }, [errors, touched]);

  const onBlurEmail = useCallback(() => {
    setFieldTouched('email');
    setErrors(validate(values));
  }, [setFieldTouched, values]);

  const onBlurPassword = useCallback(() => {
    setFieldTouched('password');
    setErrors(validate(values));
  }, [setFieldTouched, values]);

  const onChangeEmail = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFieldValue('email', e.target.value);
      if (touched.email) setErrors(validate({ ...values, email: e.target.value }));
    },
    [setFieldValue, touched.email, values]
  );

  const onChangePassword = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFieldValue('password', e.target.value);
      if (touched.password) setErrors(validate({ ...values, password: e.target.value }));
    },
    [setFieldValue, touched.password, values]
  );

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      const nextTouched: Partial<Record<keyof LoginFormValues, boolean>> = { email: true, password: true };
      setTouched(nextTouched);

      const nextErrors = validate(values);
      setErrors(nextErrors);

      const hasErrors = Object.keys(nextErrors).length > 0;
      if (hasErrors) return;

      setIsSubmitting(true);
      try {
        const result = await auth.login({ email: values.email.trim(), password: values.password });
        if (!result.ok) {
          setErrors({ form: result.error || 'Login failed. Please try again.' });
          return;
        }
        navigate('/', { replace: true });
      } catch (_err) {
        setErrors({ form: 'Something went wrong. Please try again.' });
      } finally {
        setIsSubmitting(false);
      }
    },
    [auth, navigate, values]
  );

  const emailId = 'login-email';
  const passwordId = 'login-password';

  return (
    <div className="login-page" style={{ maxWidth: 420, margin: '0 auto', padding: 24 }}>
      <h1 style={{ margin: '0 0 16px' }}>Login</h1>

      <form onSubmit={onSubmit} noValidate aria-describedby={visibleErrors.form ? 'login-form-error' : undefined}>
        {visibleErrors.form ? (
          <div
            id="login-form-error"
            role="alert"
            style={{
              marginBottom: 12,
              padding: 12,
              borderRadius: 6,
              border: '1px solid rgba(220, 38, 38, 0.4)',
              background: 'rgba(220, 38, 38, 0.06)',
              color: '#b91c1c',
            }}
          >
            {visibleErrors.form}
          </div>
        ) : null}

        <div style={{ marginBottom: 12 }}>
          <label htmlFor={emailId} style={{ display: 'block', marginBottom: 6 }}>
            Email
          </label>
          <input
            id={emailId}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={values.email}
            onChange={onChangeEmail}
            onBlur={onBlurEmail}
            aria-invalid={Boolean(visibleErrors.email)}
            aria-describedby={visibleErrors.email ? `${emailId}-error` : undefined}
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 6,
              border: visibleErrors.email ? '1px solid #dc2626' : '1px solid rgba(0,0,0,0.2)',
              outline: 'none',
            }}
          />
          {visibleErrors.email ? (
            <div id={`${emailId}-error`} role="alert" style={{ marginTop: 6, color: '#b91c1c', fontSize: 13 }}>
              {visibleErrors.email}
            </div>
          ) : null}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label htmlFor={passwordId} style={{ display: 'block', marginBottom: 6 }}>
            Password
          </label>
          <input
            id={passwordId}
            name="password"
            type="password"
            autoComplete="current-password"
            value={values.password}
            onChange={onChangePassword}
            onBlur={onBlurPassword}
            aria-invalid={Boolean(visibleErrors.password)}
            aria-describedby={visibleErrors.password ? `${passwordId}-error` : undefined}
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 6,
              border: visibleErrors.password ? '1px solid #dc2626' : '1px solid rgba(0,0,0,0.2)',
              outline: 'none',
            }}
          />
          {visibleErrors.password ? (
            <div id={`${passwordId}-error`} role="alert" style={{ marginTop: 6, color: '#b91c1c', fontSize: 13 }}>
              {visibleErrors.password}
            </div>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 6,
            border: '1px solid rgba(0,0,0,0.2)',
            background: isSubmitting ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.02)',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
          }}
        >
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </button>

        <div style={{ marginTop: 14, fontSize: 14 }}>
          <span>Don&apos;t have an account? </span>
          <Link to="/register">Register</Link>
        </div>
      </form>
    </div>
  );
};

export default Login;