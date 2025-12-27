/**
 * 格式化价格显示
 * @param price - 价格数值
 * @param currency - 货币符号，默认为 '¥'
 * @param decimals - 小数位数，默认为 2
 * @returns 格式化后的价格字符串
 */
export const formatPrice = (
  price: number,
  currency: string = '¥',
  decimals: number = 2
): string => {
  if (typeof price !== 'number' || isNaN(price)) {
    return `${currency}0.00`;
  }

  const formattedPrice = price.toFixed(decimals);
  const parts = formattedPrice.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return `${currency}${parts.join('.')}`;
};

/**
 * 格式化价格区间
 * @param minPrice - 最低价格
 * @param maxPrice - 最高价格
 * @param currency - 货币符号，默认为 '¥'
 * @returns 格式化后的价格区间字符串
 */
export const formatPriceRange = (
  minPrice: number,
  maxPrice: number,
  currency: string = '¥'
): string => {
  const minFormatted = formatPrice(minPrice, currency);
  const maxFormatted = formatPrice(maxPrice, currency);
  
  return `${minFormatted} - ${maxFormatted}`;
};