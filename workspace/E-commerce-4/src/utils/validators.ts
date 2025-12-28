/**
 * 验证邮箱格式
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 验证手机号格式（中国大陆手机号）
 */
export function validatePhone(phone: string): boolean {
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(phone);
}

/**
 * 验证密码强度
 * 要求：至少8位，包含数字和字母
 */
export function validatePassword(password: string): { valid: boolean; message: string } {
  if (password.length < 8) {
    return {
      valid: false,
      message: '密码长度至少为8位'
    };
  }

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);

  if (!hasLetter) {
    return {
      valid: false,
      message: '密码必须包含字母'
    };
  }

  if (!hasNumber) {
    return {
      valid: false,
      message: '密码必须包含数字'
    };
  }

  return {
    valid: true,
    message: '密码强度符合要求'
  };
}

/**
 * 验证必填项
 */
export function validateRequired(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * 验证最小长度
 */
export function validateMinLength(value: string, min: number): boolean {
  return value.length >= min;
}

/**
 * 验证最大长度
 */
export function validateMaxLength(value: string, max: number): boolean {
  return value.length <= max;
}