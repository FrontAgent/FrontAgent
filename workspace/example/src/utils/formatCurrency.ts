export type CurrencyInput = number | string;

export interface FormatCurrencyOptions {
  locale?: string | string[];
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  useGrouping?: boolean;
}

const DEFAULT_LOCALE = 'en-US';

function toFiniteNumber(value: CurrencyInput): number | null {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.trim())
        : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * Format a numeric value as a currency string using Intl.NumberFormat.
 *
 * - Handles non-finite values by returning an empty string.
 * - Preserves sign for negative numbers.
 * - Supports decimals; fraction digits can be controlled via options.
 * - Pure function: no side effects and no reliance on global mutable state.
 *
 * @param value - The numeric value to format. Accepts number or numeric string.
 * @param currency - ISO 4217 currency code (e.g., "USD", "EUR", "CNY").
 * @param locale - BCP 47 locale tag(s). Defaults to "en-US".
 * @param options - Optional formatting overrides (fraction digits, grouping).
 * @returns The formatted currency string, or empty string for invalid input.
 *
 * @example
 * formatCurrency(1234.56, 'USD'); // "$1,234.56"
 *
 * @example
 * formatCurrency('-98.1', 'EUR', 'de-DE'); // "-98,10 €"
 *
 * @example
 * formatCurrency(NaN, 'USD'); // ""
 */
export function formatCurrency(
  value: CurrencyInput,
  currency: string,
  locale: string | string[] = DEFAULT_LOCALE,
  options: FormatCurrencyOptions = {}
): string {
  const n = toFiniteNumber(value);
  if (n === null) return '';

  const { locale: optLocale, minimumFractionDigits, maximumFractionDigits, useGrouping } = options;

  const fmt = new Intl.NumberFormat(optLocale ?? locale, {
    style: 'currency',
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
    useGrouping,
  });

  return fmt.format(n);
}