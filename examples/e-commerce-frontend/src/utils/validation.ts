/**
 * Validation utility functions for form validation
 */

/**
 * Validates email format
 * @param email - Email string to validate
 * @returns True if email is valid, false otherwise
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validates phone number format (Chinese mobile numbers)
 * @param phone - Phone number string to validate
 * @returns True if phone number is valid, false otherwise
 */
export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(phone);
};

/**
 * Validates password strength
 * @param password - Password string to validate
 * @returns True if password meets requirements, false otherwise
 */
export const validatePassword = (password: string): boolean => {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
};

/**
 * Validates required field
 * @param value - Value to validate
 * @returns True if value is not empty, false otherwise
 */
export const validateRequired = (value: string): boolean => {
  return value.trim().length > 0;
};

/**
 * Validates minimum length
 * @param value - String to validate
 * @param minLength - Minimum required length
 * @returns True if value meets minimum length, false otherwise
 */
export const validateMinLength = (value: string, minLength: number): boolean => {
  return value.length >= minLength;
};

/**
 * Validates maximum length
 * @param value - String to validate
 * @param maxLength - Maximum allowed length
 * @returns True if value is within maximum length, false otherwise
 */
export const validateMaxLength = (value: string, maxLength: number): boolean => {
  return value.length <= maxLength;
};

/**
 * Validates numeric input
 * @param value - String to validate
 * @returns True if value is numeric, false otherwise
 */
export const validateNumeric = (value: string): boolean => {
  return /^\d+$/.test(value);
};

/**
 * Validates positive number
 * @param value - Number to validate
 * @returns True if value is positive, false otherwise
 */
export const validatePositive = (value: number): boolean => {
  return value > 0;
};

/**
 * Validates URL format
 * @param url - URL string to validate
 * @returns True if URL is valid, false otherwise
 */
export const validateUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validates Chinese ID card number
 * @param idCard - ID card string to validate
 * @returns True if ID card is valid, false otherwise
 */
export const validateIdCard = (idCard: string): boolean => {
  const idCardRegex = /(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)/;
  return idCardRegex.test(idCard);
};

/**
 * Validates date format (YYYY-MM-DD)
 * @param date - Date string to validate
 * @returns True if date is valid, false otherwise
 */
export const validateDate = (date: string): boolean => {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;
  
  const dateObj = new Date(date);
  return dateObj instanceof Date && !isNaN(dateObj.getTime());
};

/**
 * Validates age range
 * @param birthDate - Birth date string
 * @param minAge - Minimum age
 * @param maxAge - Maximum age
 * @returns True if age is within range, false otherwise
 */
export const validateAgeRange = (birthDate: string, minAge: number, maxAge: number): boolean => {
  const birth = new Date(birthDate);
  const today = new Date();
  const age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate()) ? age - 1 : age;
  
  return actualAge >= minAge && actualAge <= maxAge;
};