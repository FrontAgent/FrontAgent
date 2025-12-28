import React from 'react';

type ClassValue = string | undefined | null | false;
const cx = (...classes: ClassValue[]) => classes.filter(Boolean).join(' ');

export type SpinnerSize = 'sm' | 'md' | 'lg';

export type SpinnerProps = React.HTMLAttributes<HTMLSpanElement> & {
  size?: SpinnerSize;
  label?: string;
};

const sizes: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-3',
};

export const Spinner = React.forwardRef<HTMLSpanElement, SpinnerProps>(function Spinner(
  { className, size = 'md', label = 'Loading...', ...props },
  ref
) {
  return (
    <span
      ref={ref}
      role="status"
      aria-label={label}
      className={cx('inline-block', className)}
      {...props}
    >
      <span
        className={cx(
          'inline-block animate-spin rounded-full border-current border-t-transparent opacity-80',
          sizes[size]
        )}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
});

export default Spinner;
