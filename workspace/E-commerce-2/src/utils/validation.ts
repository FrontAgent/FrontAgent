/**
 * Validates if a string is a valid email address
 * @param email - The email string to validate
 * @returns True if email is valid, false otherwise
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validates password strength based on common security requirements
 * @param password - The password string to validate
 * @param minLength - Minimum password length (default: 8)
 * @returns True if password meets strength requirements, false otherwise
 */
export function validatePassword(password: string, minLength: number = 8): boolean {
  if (!password || typeof password !== 'string') {
    return false;
  }
  
  if (password.length < minLength) {
    return false;
  }
  
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  return hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;
}

/**
 * Validates if a required field has a value
 * @param value - The value to validate
 * @returns True if value is not empty, false otherwise
 */
export function validateRequired(value: string | number | boolean | null | undefined): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  
  if (typeof value === 'number') {
    return !isNaN(value);
  }
  
  if (typeof value === 'boolean') {
    return true;
  }
  
  return false;
}