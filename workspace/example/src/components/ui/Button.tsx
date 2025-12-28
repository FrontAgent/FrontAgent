import React from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /**
   * Visual style variant.
   * @default 'default'
   */
  variant?: ButtonVariant;
  /**
   * Button size.
   * @default 'md'
   */
  size?: ButtonSize;
  /**
   * Show loading state and disable interactions.
   * @default false
   */
  loading?: boolean;
};

/**
 * Button UI component.
 *
 * Features:
 * - Supports `variant`, `size`, `disabled`, and optional `loading`.
 * - Uses native `<button>` element and forwards all native button props.
 * - Merges Tailwind class names via `cn`.
 *
 * @param props - {@link ButtonProps}
 */
export default function Button({
  className,
  variant = 'default',
  size = 'md',
  disabled,
  loading = false,
  type = 'button',
  children,
  onClick,
  ...props
}: ButtonProps) {
  const isDisabled = Boolean(disabled || loading);

  const base =
    'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background ' +
    'disabled:pointer-events-none disabled:opacity-50';

  const variants: Record<ButtonVariant, string> = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    link: 'text-primary underline-offset-4 hover:underline',
  };

  const sizes: Record<ButtonSize, string> = {
    sm: 'h-9 px-3',
    md: 'h-10 px-4 py-2',
    lg: 'h-11 px-8',
    icon: 'h-10 w-10',
  };

  const spinner = (
    <span
      aria-hidden="true"
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );

  return (
    <button
      type={type}
      className={cn(base, variants[variant], sizes[size], loading && 'cursor-wait', className)}
      disabled={isDisabled}
      aria-disabled={isDisabled || undefined}
      aria-busy={loading || undefined}
      onClick={isDisabled ? undefined : onClick}
      {...props}
    >
      {loading ? spinner : null}
      <span className={cn(loading && 'opacity-90')}>{children}</span>
    </button>
  );
}