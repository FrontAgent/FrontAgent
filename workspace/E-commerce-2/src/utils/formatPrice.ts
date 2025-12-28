/**
 * 格式化价格为带货币符号和千位分隔符的字符串
 * @param price - 需要格式化的价格数字
 * @param currencyCode - 货币代码，默认为 'CNY'（人民币）
 * @returns 格式化后的价格字符串，如 ¥1,234.56
 */
export default function formatPrice(
  price: number,
  currencyCode: string = 'CNY'
): string {
  const currencySymbols: Record<string, string> = {
    CNY: '¥',
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
  };

  const symbol = currencySymbols[currencyCode] || currencyCode;
  
  const formattedNumber = price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  return `${symbol}${formattedNumber}`;
}