import { TLocale } from '../types/locale';

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
  const formatted = price.toFixed(decimals);
  return `${currency}${formatted.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

/**
 * 格式化货币显示
 * @param amount - 金额数值
 * @param locale - 地区设置，默认为 'zh-CN'
 * @param currency - 货币代码，默认为 'CNY'
 * @returns 格式化后的货币字符串
 */
export const formatCurrency = (
  amount: number,
  locale: TLocale = 'zh-CN',
  currency: string = 'CNY'
): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * 格式化数字显示
 * @param num - 数字
 * @param locale - 地区设置，默认为 'zh-CN'
 * @param options - 格式化选项
 * @returns 格式化后的数字字符串
 */
export const formatNumber = (
  num: number,
  locale: TLocale = 'zh-CN',
  options?: Intl.NumberFormatOptions
): string => {
  return new Intl.NumberFormat(locale, options).format(num);
};

/**
 * 格式化百分比
 * @param value - 数值（0-1之间的小数）
 * @param decimals - 小数位数，默认为 2
 * @returns 格式化后的百分比字符串
 */
export const formatPercentage = (
  value: number,
  decimals: number = 2
): string => {
  return `${(value * 100).toFixed(decimals)}%`;
};

/**
 * 格式化日期显示
 * @param date - 日期对象或日期字符串
 * @param format - 格式化模式，默认为 'YYYY-MM-DD'
 * @param locale - 地区设置，默认为 'zh-CN'
 * @returns 格式化后的日期字符串
 */
export const formatDate = (
  date: Date | string,
  format: string = 'YYYY-MM-DD',
  locale: TLocale = 'zh-CN'
): string => {
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
};

/**
 * 格式化相对时间
 * @param date - 日期对象或日期字符串
 * @param locale - 地区设置，默认为 'zh-CN'
 * @returns 相对时间字符串
 */
export const formatRelativeTime = (
  date: Date | string,
  locale: TLocale = 'zh-CN'
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return '刚刚';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}分钟前`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}小时前`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays}天前`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths}个月前`;
  }

  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears}年前`;
};

/**
 * 格式化文件大小
 * @param bytes - 字节数
 * @param decimals - 小数位数，默认为 2
 * @returns 格式化后的文件大小字符串
 */
export const formatFileSize = (
  bytes: number,
  decimals: number = 2
): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
};

/**
 * 格式化手机号码
 * @param phone - 手机号码字符串
 * @param mask - 是否隐藏中间四位，默认为 true
 * @returns 格式化后的手机号码
 */
export const formatPhone = (
  phone: string,
  mask: boolean = true
): string => {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length !== 11) {
    return phone;
  }

  if (mask) {
    return `${cleaned.slice(0, 3)}****${cleaned.slice(7)}`;
  }

  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
};

/**
 * 格式化身份证号码
 * @param idCard - 身份证号码字符串
 * @param mask - 是否隐藏中间八位，默认为 true
 * @returns 格式化后的身份证号码
 */
export const formatIdCard = (
  idCard: string,
  mask: boolean = true
): string => {
  const cleaned = idCard.replace(/\D/g, '');
  
  if (cleaned.length !== 18) {
    return idCard;
  }

  if (mask) {
    return `${cleaned.slice(0, 6)}********${cleaned.slice(14)}`;
  }

  return `${cleaned.slice(0, 6)}-${cleaned.slice(6, 14)}-${cleaned.slice(14)}`;
};