/**
 * 格式化价格显示
 * @param price - 价格数值
 * @param currency - 货币符号，默认为 '¥'
 * @param locale - 本地化设置，默认为 'zh-CN'
 * @returns 格式化后的价格字符串
 */
export const formatPrice = (
  price: number,
  currency: string = '¥',
  locale: string = 'zh-CN'
): string => {
  if (typeof price !== 'number' || isNaN(price)) {
    return `${currency}0.00`;
  }

  const formattedPrice = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);

  return `${currency}${formattedPrice}`;
};

/**
 * 格式化价格范围
 * @param minPrice - 最低价格
 * @param maxPrice - 最高价格
 * @param currency - 货币符号，默认为 '¥'
 * @param locale - 本地化设置，默认为 'zh-CN'
 * @returns 格式化后的价格范围字符串
 */
export const formatPriceRange = (
  minPrice: number,
  maxPrice: number,
  currency: string = '¥',
  locale: string = 'zh-CN'
): string => {
  if (minPrice === maxPrice) {
    return formatPrice(minPrice, currency, locale);
  }

  const formattedMin = formatPrice(minPrice, currency, locale);
  const formattedMax = formatPrice(maxPrice, currency, locale);

  return `${formattedMin} - ${formattedMax}`;
};

/**
 * 将价格字符串转换为数字
 * @param priceString - 价格字符串
 * @returns 转换后的数字
 */
export const parsePrice = (priceString: string): number => {
  const numericString = priceString.replace(/[^\d.-]/g, '');
  const parsed = parseFloat(numericString);
  return isNaN(parsed) ? 0 : parsed;
};