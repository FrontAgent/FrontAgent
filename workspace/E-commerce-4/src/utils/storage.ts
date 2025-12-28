export const STORAGE_KEYS = {
  CART: 'shopping_cart',
  AUTH_TOKEN: 'auth_token',
  USER: 'user_info'
} as const;

export function setItem<T>(key: string, value: T): void {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
  } catch (error) {
    console.error(`Error saving to localStorage key "${key}":`, error);
  }
}

export function getItem<T>(key: string, defaultValue?: T): T | null {
  try {
    const item = localStorage.getItem(key);
    if (item === null) {
      return defaultValue ?? null;
    }
    return JSON.parse(item) as T;
  } catch (error) {
    console.error(`Error reading from localStorage key "${key}":`, error);
    return defaultValue ?? null;
  }
}

export function removeItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing localStorage key "${key}":`, error);
  }
}

export function clear(): void {
  try {
    localStorage.clear();
  } catch (error) {
    console.error('Error clearing localStorage:', error);
  }
}

// Storage object for contexts that expect this interface
export const storage = {
  get: <T>(key: string): T | null => getItem<T>(key),
  set: <T>(key: string, value: T): void => setItem(key, value),
  remove: (key: string): void => removeItem(key),
  clear: (): void => clear(),
};