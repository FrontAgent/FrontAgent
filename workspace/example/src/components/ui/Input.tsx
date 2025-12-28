import React from 'react';

type InputBaseProps = React.InputHTMLAttributes<HTMLInputElement>;

export interface InputProps extends Omit<InputBaseProps, 'size'> {
  /**
   * Input label text. If provided, a <label> will be rendered and linked via htmlFor.
   */
  label?: React.ReactNode;
  /**
   * Helper text shown beneath the input when there is no error.
   */
  helperText?: React.ReactNode;
  /**
   * Error message. When present, the input is styled as invalid and the message is shown.
   * If boolean true, the input will be styled as invalid without showing an error message.
   */
  error?: React.ReactNode | boolean;
  /**
   * An accessible description for screen readers. If provided, it will be linked via aria-describedby.
   * If not provided, helperText/error will be used for aria-describedby automatically.
   */
  description?: string;
  /**
   * Container className applied to the outer wrapper.
   */
  containerClassName?: string;
  /**
   * Class name applied to the label element.
   */
  labelClassName?: string;
  /**
   * Class name applied to the input element (merged with internal classes).
   */
  inputClassName?: string;
  /**
   * Class name applied to the helper/error text element.
   */
  messageClassName?: string;
}

function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Input component that renders an accessible label, input, and helper/error message.
 * Uses Tailwind CSS for focus and error states.
 */
export default function Input(props: InputProps): React.JSX.Element {
  const {
    label,
    helperText,
    error,
    description,
    containerClassName,
    labelClassName,
    inputClassName,
    messageClassName,
    id,
    name,
    disabled,
    required,
    className,
    'aria-describedby': ariaDescribedByProp,
    'aria-invalid': ariaInvalidProp,
    ...rest
  } = props;

  const reactId = React.useId();
  const inputId = id ?? `${name ?? 'input'}-${reactId}`;

  const hasError = Boolean(error);
  const showErrorMessage = typeof error !== 'boolean' && error != null;
  const showHelperMessage = !hasError && helperText != null;

  const helperId = `${inputId}-help`;
  const errorId = `${inputId}-error`;
  const descriptionId = `${inputId}-desc`;

  const derivedDescribedByIds: string[] = [];
  if (description) derivedDescribedByIds.push(descriptionId);
  if (showErrorMessage) derivedDescribedByIds.push(errorId);
  if (showHelperMessage) derivedDescribedByIds.push(helperId);

  const ariaDescribedBy = cn(
    ariaDescribedByProp as string | undefined,
    derivedDescribedByIds.length ? derivedDescribedByIds.join(' ') : undefined
  ).trim();

  const ariaInvalid = (ariaInvalidProp ?? hasError) ? true : undefined;

  const inputClasses = cn(
    'block w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400',
    'shadow-sm transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900/20',
    hasError
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
      : 'border-slate-300 focus:border-slate-900/40',
    disabled && 'cursor-not-allowed bg-slate-50 text-slate-500 placeholder:text-slate-400/70',
    className,
    inputClassName
  );

  const labelClasses = cn(
    'mb-1 block text-sm font-medium text-slate-800',
    disabled && 'text-slate-500',
    labelClassName
  );

  const messageClasses = cn(
    'mt-1 text-xs leading-5',
    hasError ? 'text-red-600' : 'text-slate-600',
    messageClassName
  );

  return (
    <div className={cn('w-full', containerClassName)}>
      {label != null && (
        <label htmlFor={inputId} className={labelClasses}>
          {label}
          {required ? <span className="ml-0.5 text-red-600">*</span> : null}
        </label>
      )}

      <input
        id={inputId}
        name={name}
        disabled={disabled}
        required={required}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy || undefined}
        className={inputClasses}
        {...rest}
      />

      {description ? (
        <p id={descriptionId} className={cn('mt-1 text-xs leading-5 text-slate-600', messageClassName)}>
          {description}
        </p>
      ) : null}

      {showErrorMessage ? (
        <p id={errorId} className={messageClasses}>
          {error as React.ReactNode}
        </p>
      ) : showHelperMessage ? (
        <p id={helperId} className={messageClasses}>
          {helperText}
        </p>
      ) : null}
    </div>
  );
}