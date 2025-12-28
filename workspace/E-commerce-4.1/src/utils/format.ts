/**
 * 格式化价格
 * @param price - 价格数值
 * @param currency - 货币符号，默认为 ¥
 * @returns 格式化后的价格字符串
 */
export function formatPrice(price: number, currency: string = '¥'): string {
  return `${currency}${price.toFixed(2)}`;
}

/**
 * 格式化日期
 * @param date - 日期对象或日期字符串
 * @param format - 日期格式，默认为 YYYY-MM-DD
 * @returns 格式化后的日期字符串
 */
export function formatDate(date: Date | string, format: string = 'YYYY-MM-DD'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/**
 * 格式化手机号
 * @param phone - 手机号字符串
 * @param separator - 分隔符，默认为 -
 * @returns 格式化后的手机号字符串
 */
export function formatPhone(phone: string, separator: string = '-'): string {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}${separator}${cleaned.slice(3, 7)}${separator}${cleaned.slice(7)}`;
  }
  
  return phone;
}

/**
 * 截断文本
 * @param text - 要截断的文本
 * @param maxLength - 最大长度
 * @param ellipsis - 省略号，默认为 ...
 * @returns 截断后的文本
 */
export function truncateText(text: string, maxLength: number, ellipsis: string = '...'): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  return text.slice(0, maxLength - ellipsis.length) + ellipsis;
}