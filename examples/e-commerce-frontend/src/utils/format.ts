/**
 * 格式化工具函数集合
 * @fileoverview 提供价格、日期、数字等格式化功能
 */

/**
 * 格式化价格显示
 * @param price - 价格数值
 * @param currency - 货币符号，默认为 '¥'
 * @param decimals - 小数位数，默认为 2
 * @returns 格式化后的价格字符串
 */
export const formatPrice = (price: number, currency: string = '¥', decimals: number = 2): string => {
  if (isNaN(price)) return `${currency}0.00`;
  
  const formattedPrice = price.toFixed(decimals);
  const parts = formattedPrice.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  return `${currency}${parts.join('.')}`;
};

/**
 * 格式化日期显示
 * @param date - 日期对象或时间戳
 * @param format - 格式类型，默认为 'YYYY-MM-DD'
 * @returns 格式化后的日期字符串
 */
export const formatDate = (date: Date | number | string, format: string = 'YYYY-MM-DD'): string => {
  const dateObj = new Date(date);
  
  if (isNaN(dateObj.getTime())) return '';
  
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
 * 格式化数字显示
 * @param num - 数字
 * @param decimals - 小数位数，默认为 0
 * @param separator - 千位分隔符，默认为 ','
 * @returns 格式化后的数字字符串
 */
export const formatNumber = (num: number, decimals: number = 0, separator: string = ','): string => {
  if (isNaN(num)) return '0';
  
  const fixedNum = num.toFixed(decimals);
  const parts = fixedNum.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  
  return parts.join('.');
};

/**
 * 格式化文件大小
 * @param bytes - 字节数
 * @param decimals - 小数位数，默认为 2
 * @returns 格式化后的文件大小字符串
 */
export const formatFileSize = (bytes: number, decimals: number = 2): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
};

/**
 * 格式化百分比
 * @param value - 数值（0-1之间）
 * @param decimals - 小数位数，默认为 2
 * @returns 格式化后的百分比字符串
 */
export const formatPercentage = (value: number, decimals: number = 2): string => {
  if (isNaN(value)) return '0%';
  
  const percentage = value * 100;
  return `${percentage.toFixed(decimals)}%`;
};

/**
 * 格式化手机号
 * @param phone - 手机号字符串
 * @returns 格式化后的手机号（138****5678）
 */
export const formatPhone = (phone: string): string => {
  if (!phone || phone.length !== 11) return phone;
  
  return `${phone.slice(0, 3)}****${phone.slice(7)}`;
};

/**
 * 格式化相对时间
 * @param date - 日期对象或时间戳
 * @returns 相对时间字符串（如：刚刚、5分钟前、1小时前）
 */
export const formatRelativeTime = (date: Date | number | string): string => {
  const dateObj = new Date(date);
  const now = new Date();
  const diff = now.getTime() - dateObj.getTime();
  
  if (diff < 0) return formatDate(dateObj);
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  
  return formatDate(dateObj);
};