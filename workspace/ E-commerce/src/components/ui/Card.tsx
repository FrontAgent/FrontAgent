import React from 'react';

type ClassValue = string | undefined | null | false;
const cx = (...classes: ClassValue[]) => classes.filter(Boolean).join(' ');

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: 'default' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
};

const base = 'rounded-lg transition-shadow';
const variants: Record<NonNullable<CardProps['variant']>, string> = {
  default: 'bg-white shadow-sm hover:shadow-md',
  outlined: 'bg-white border border-gray-200 hover:border-gray-300',
};
const paddings: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, variant = 'default', padding = 'none', children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cx(base, variants[variant], paddings[padding], className)}
      {...props}
    >
      {children}
    </div>
  );
});

export default Card;
