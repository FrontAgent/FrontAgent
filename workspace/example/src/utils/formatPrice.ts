export function formatPrice(amount: number, currency: string = 'USD', locale: string = 'en-US'): string {
  /**
   * Formats a numeric amount as a localized currency string.
   *
   * This is a pure function with no side effects. It uses `Intl.NumberFormat`
   * for correct locale-aware formatting, including currency symbol placement,
   * grouping separators, and decimal precision rules.
   *
   * @param amount - The numeric amount to format.
   * @param currency - ISO 4217 currency code (e.g., "USD", "EUR", "CNY"). Defaults to "USD".
   * @param locale - BCP 47 locale string (e.g., "en-US", "zh-CN"). Defaults to "en-US".
   * @returns A localized currency string representation of the amount.
   *
   * @example
   * formatPrice(1234.5) // "$1,234.50" (in en-US, USD)
   *
   * @example
   * formatPrice(1234.5, 'CNY', 'zh-CN') // "¥1,234.50"
   */
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  });

  return formatter.format(amount);
}