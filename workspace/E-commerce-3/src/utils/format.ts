/**
 * 格式化价格为货币格式
 * @param price - 价格数值
 * @param currency - 货币符号，默认为 ¥
 * @returns 格式化后的价格字符串，如 ¥1,234.56
 */
export function formatPrice(price: number, currency: string = '¥'): string {
  if (isNaN(price)) {
    return `${currency}0.00`;
  }
  
  const formatted = price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${currency}${formatted}`;
}

/**
 * 格式化日期为友好格式
 * @param date - 日期对象或时间戳
 * @param format - 格式类型：'full' | 'date' | 'time' | 'relative'
 * @returns 格式化后的日期字符串
 */
export function formatDate(
  date: Date | number | string,
  format: 'full' | 'date' | 'time' | 'relative' = 'full'
): string {
  const dateObj = new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    return '无效日期';
  }

  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const seconds = String(dateObj.getSeconds()).padStart(2, '0');

  switch (format) {
    case 'date':
      return `${year}-${month}-${day}`;
    case 'time':
      return `${hours}:${minutes}:${seconds}`;
    case 'relative':
      return formatRelativeTime(dateObj);
    case 'full':
    default:
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
}

/**
 * 格式化相对时间
 * @param date - 日期对象
 * @returns 相对时间字符串，如"刚刚"、"3分钟前"
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) {
    return '刚刚';
  } else if (minutes < 60) {
    return `${minutes}分钟前`;
  } else if (hours < 24) {
    return `${hours}小时前`;
  } else if (days < 30) {
    return `${days}天前`;
  } else if (months < 12) {
    return `${months}个月前`;
  } else {
    return `${years}年前`;
  }
}

/**
 * 格式化数字，添加千分位分隔符
 * @param num - 数字
 * @param decimals - 小数位数，默认为0
 * @returns 格式化后的数字字符串，如 1,234,567.89
 */
export function formatNumber(num: number, decimals: number = 0): string {
  if (isNaN(num)) {
    return '0';
  }

  const fixed = num.toFixed(decimals);
  const parts = fixed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  return parts.join('.');
}

/**
 * 截断长文本并添加省略号
 * @param text - 原始文本
 * @param maxLength - 最大长度
 * @param ellipsis - 省略号，默认为 ...
 * @returns 截断后的文本
 */
export function truncateText(
  text: string,
  maxLength: number,
  ellipsis: string = '...'
): string {
  if (!text) {
    return '';
  }

  if (text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength - ellipsis.length) + ellipsis;
}

/**
 * 格式化电话号码
 * @param phone - 电话号码字符串
 * @param format - 格式类型：'default' | 'dashed' | 'spaced'
 * @returns 格式化后的电话号码，如 138-1234-5678
 */
export function formatPhoneNumber(
  phone: string,
  format: 'default' | 'dashed' | 'spaced' = 'default'
): string {
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length !== 11) {
    return phone;
  }

  const part1 = cleaned.slice(0, 3);
  const part2 = cleaned.slice(3, 7);
  const part3 = cleaned.slice(7, 11);

  switch (format) {
    case 'dashed':
      return `${part1}-${part2}-${part3}`;
    case 'spaced':
      return `${part1} ${part2} ${part3}`;
    case 'default':
    default:
      return `${part1}${part2}${part3}`;
  }
}

/**
 * 验证邮箱格式
 * @param email - 邮箱地址
 * @returns 是否为有效的邮箱格式
 */
export function validateEmail(email: string): boolean {
  if (!email) {
    return false;
  }

  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

/**
 * 验证手机号格式
 * @param phone - 手机号码
 * @returns 是否为有效的手机号格式（中国大陆）
 */
export function validatePhone(phone: string): boolean {
  if (!phone) {
    return false;
  }

  const cleaned = phone.replace(/\D/g, '');
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(cleaned);
}