/**
 * 格式化工具函数
 */

/**
 * 将数字格式化为人民币价格字符串
 * @param price 价格数字
 * @param decimals 小数位数，默认2位
 * @returns 格式化后的价格字符串，如 ¥99.00
 */
export function formatPrice(price: number, decimals: number = 2): string {
  if (isNaN(price) || price === null || price === undefined) {
    return '¥0.00';
  }
  return `¥${price.toFixed(decimals)}`;
}

/**
 * 将日期字符串或Date对象格式化为本地日期时间字符串
 * @param date 日期字符串或Date对象
 * @param format 格式类型：'date' | 'time' | 'datetime'，默认 'datetime'
 * @returns 格式化后的日期时间字符串
 */
export function formatDate(
  date: string | Date | number,
  format: 'date' | 'time' | 'datetime' = 'datetime'
): string {
  if (!date) {
    return '';
  }

  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    return '';
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
    case 'datetime':
    default:
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
}

/**
 * 将手机号格式化为隐藏中间四位的形式
 * @param phone 手机号字符串
 * @returns 格式化后的手机号，如 138****8888
 */
export function formatPhone(phone: string): string {
  if (!phone || typeof phone !== 'string') {
    return '';
  }

  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length !== 11) {
    return phone;
  }

  return `${cleaned.slice(0, 3)}****${cleaned.slice(7)}`;
}

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @param decimals 小数位数，默认2位
 * @returns 格式化后的文件大小字符串，如 1.5 MB
 */
export function formatFileSize(bytes: number, decimals: number = 2): string {
  if (bytes === 0) {
    return '0 B';
  }

  if (isNaN(bytes) || bytes < 0) {
    return '';
  }

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * 格式化数字，添加千分位分隔符
 * @param num 数字
 * @param decimals 小数位数
 * @returns 格式化后的数字字符串，如 1,234,567.89
 */
export function formatNumber(num: number, decimals?: number): string {
  if (isNaN(num) || num === null || num === undefined) {
    return '0';
  }

  const fixed = decimals !== undefined ? num.toFixed(decimals) : String(num);
  const parts = fixed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return parts.join('.');
}

/**
 * 格式化百分比
 * @param value 数值（0-1之间的小数或0-100的整数）
 * @param decimals 小数位数，默认2位
 * @param isDecimal 是否为小数形式（0-1），默认true
 * @returns 格式化后的百分比字符串，如 85.50%
 */
export function formatPercent(
  value: number,
  decimals: number = 2,
  isDecimal: boolean = true
): string {
  if (isNaN(value) || value === null || value === undefined) {
    return '0%';
  }

  const percent = isDecimal ? value * 100 : value;
  return `${percent.toFixed(decimals)}%`;
}

/**
 * 格式化身份证号，隐藏中间部分
 * @param idCard 身份证号
 * @returns 格式化后的身份证号，如 110***********1234
 */
export function formatIdCard(idCard: string): string {
  if (!idCard || typeof idCard !== 'string') {
    return '';
  }

  const cleaned = idCard.replace(/\s/g, '');

  if (cleaned.length !== 18 && cleaned.length !== 15) {
    return idCard;
  }

  if (cleaned.length === 18) {
    return `${cleaned.slice(0, 3)}***********${cleaned.slice(14)}`;
  }

  return `${cleaned.slice(0, 3)}********${cleaned.slice(11)}`;
}

/**
 * 格式化银行卡号，每4位添加空格
 * @param cardNumber 银行卡号
 * @param hideMiddle 是否隐藏中间部分，默认false
 * @returns 格式化后的银行卡号
 */
export function formatBankCard(cardNumber: string, hideMiddle: boolean = false): string {
  if (!cardNumber || typeof cardNumber !== 'string') {
    return '';
  }

  const cleaned = cardNumber.replace(/\D/g, '');

  if (hideMiddle && cleaned.length >= 8) {
    const first = cleaned.slice(0, 4);
    const last = cleaned.slice(-4);
    const middleLength = cleaned.length - 8;
    const middle = '*'.repeat(middleLength);
    const hidden = first + middle + last;
    return hidden.replace(/(.{4})/g, '$1 ').trim();
  }

  return cleaned.replace(/(.{4})/g, '$1 ').trim();
}

/**
 * 截断文本并添加省略号
 * @param text 原始文本
 * @param maxLength 最大长度
 * @param suffix 后缀，默认 '...'
 * @returns 截断后的文本
 */
export function truncateText(
  text: string,
  maxLength: number,
  suffix: string = '...'
): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  if (text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength - suffix.length) + suffix;
}