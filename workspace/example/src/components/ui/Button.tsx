import React from 'react';

type ClassValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Record<string, unknown>
  | ClassValue[];

const classnames = (...values: ClassValue[]): string => {
  const classes: string[] = [];

  const push = (v: ClassValue): void => {
    if (!v) return;

    if (typeof v === 'string' || typeof v === 'number') {
      classes.push(String(v));
      return;
    }

    if (Array.isArray(v)) {
      for (const item of v) push(item);
      return;
    }

    if (typeof v === 'object') {
      for (const [key, val] of Object.entries(v)) {
        if (val) classes.push(key);
      }
    }
  };

  for (const v of values) push(v);

  return classes.join(' ');
};

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> {
  /**
   * Visual style of the button.
   * @default "primary"
   */
  variant?: ButtonVariant;
  /**
   * Size of the button.
   * @default "md"
   */
  size?: ButtonSize;
  /**
   * Whether the button is disabled. When `loading` is true, the button will be disabled as well.
   * @default false
   */
  disabled?: boolean;
  /**
   * Whether the button is in a loading state. Disables the button and shows a spinner.
   * @default false
   */
  loading?: boolean;
}

const baseStyles =
  'relative inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400 ring-offset-white disabled:opacity-50 disabled:pointer-events-none';

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-900',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 active:bg-slate-100',
  outline:
    'border border-slate-300 bg-transparent text-slate-900 hover:bg-slate-50 active:bg-transparent',
  ghost: 'bg-transparent text-slate-900 hover:bg-slate-100 active:bg-transparent',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-600',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
};

const spinnerSizeStyles: Record<ButtonSize, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-4.5 w-4.5',
};

const Spinner: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <svg
      className={classnames('animate-spin', className)}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
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
        d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
      />
    </svg>
  );
};

/**
 * Button component with Tailwind-based variants and sizes.
 * Supports `disabled` and `loading` states and forwards refs to the underlying `<button>`.
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      disabled = false,
      loading = false,
      className,
      type = 'button',
      children,
      onClick,
      ...rest
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    const handleClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
      if (isDisabled) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      onClick?.(e);
    };

    return (
      <button
        ref={ref}
        type={type}
        className={classnames(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        disabled={isDisabled}
        aria-disabled={isDisabled || undefined}
        aria-busy={loading || undefined}
        onClick={handleClick}
        {...rest}
      >
        {loading ? (
          <>
            <Spinner className={classnames(spinnerSizeStyles[size])} />
            <span className="sr-only">Loading</span>
          </>
        ) : null}
        <span className={classnames({ 'opacity-0': loading })}>{children}</span>
      </button>
    );
  },
);

Button.displayName = 'Button';

export default Button;