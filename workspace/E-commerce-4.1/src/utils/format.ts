/**
 * 格式化价格显示
 * @param price - 价格数值
 * @param currency - 货币符号，默认为 '¥'
 * @returns 格式化后的价格字符串
 */
export function formatPrice(price: number, currency: string = '¥'): string {
  const formattedNumber = price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${currency}${formattedNumber}`;
}

/**
 * 格式化日期显示
 * @param date - 日期对象或日期字符串
 * @param format - 日期格式，默认为 'YYYY-MM-DD'
 * @returns 格式化后的日期字符串
 */
export function formatDate(date: Date | string, format: string = 'YYYY-MM-DD'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return '';
  }

  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const seconds = String(dateObj.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/**
 * 截断长文本并添加省略号
 * @param text - 原始文本
 * @param maxLength - 最大长度
 * @param ellipsis - 省略号，默认为 '...'
 * @returns 截断后的文本
 */
export function truncateText(text: string, maxLength: number, ellipsis: string = '...'): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - ellipsis.length) + ellipsis;
}

/**
 * 格式化电话号码
 * @param phoneNumber - 电话号码字符串
 * @param format - 格式类型，默认为 'default'
 * @returns 格式化后的电话号码
 */
export function formatPhoneNumber(phoneNumber: string, format: 'default' | 'international' = 'default'): string {
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  if (cleaned.length !== 11) {
    return phoneNumber;
  }

  if (format === 'international') {
    return `+86 ${cleaned.slice(0, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7)}`;
  }

  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
}