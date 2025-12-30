/**
 * 格式化价格显示
 * @param price - 价格数值
 * @param currency - 货币符号，默认为 '$'
 * @param decimals - 小数位数，默认为 2
 * @returns 格式化后的价格字符串
 */
export function formatPrice(
  price: number,
  currency: string = '$',
  decimals: number = 2
): string {
  return `${currency}${price.toFixed(decimals)}`;
}

/**
 * 格式化日期时间显示
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
    return 'Invalid Date';
  }

  switch (format) {
    case 'date':
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

    case 'time':
      return dateObj.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });

    case 'relative':
      return formatRelativeTime(dateObj);

    case 'full':
    default:
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
  }
}

/**
 * 格式化相对时间
 * @param date - 日期对象
 * @returns 相对时间字符串（例如：2 hours ago）
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} ${diffInMonths === 1 ? 'month' : 'months'} ago`;
  }

  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears} ${diffInYears === 1 ? 'year' : 'years'} ago`;
}

/**
 * 截断长文本并添加省略号
 * @param text - 原始文本
 * @param maxLength - 最大长度
 * @param suffix - 省略号后缀，默认为 '...'
 * @returns 截断后的文本
 */
export function truncateText(
  text: string,
  maxLength: number,
  suffix: string = '...'
): string {
  if (text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * 格式化评分显示
 * @param rating - 评分数值
 * @param maxRating - 最大评分，默认为 5.0
 * @param decimals - 小数位数，默认为 1
 * @returns 格式化后的评分字符串
 */
export function formatRating(
  rating: number,
  maxRating: number = 5.0,
  decimals: number = 1
): string {
  const clampedRating = Math.max(0, Math.min(rating, maxRating));
  return `${clampedRating.toFixed(decimals)}/${maxRating.toFixed(decimals)}`;
}

/**
 * 将字符串转换为URL友好的格式
 * @param text - 原始文本
 * @returns URL友好的字符串
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}