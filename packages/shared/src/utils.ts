export const DEFAULT_LLM_TEMPERATURE = 0.2;
export const DEFAULT_LLM_MAX_TOKENS = 4096;

export function generateId(prefix = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
}

export function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key in source) {
    if (Object.hasOwn(source, key)) {
      const sourceValue = source[key];
      if (sourceValue === undefined) continue;
      const targetValue = result[key];
      if (
        sourceValue !== null &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue !== null &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        result[key] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>,
        ) as T[Extract<keyof T, string>];
      } else {
        result[key] = sourceValue as T[Extract<keyof T, string>];
      }
    }
  }
  return result;
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

export function matchGlob(path: string, pattern: string): boolean {
  const regexPattern = pattern
    .replace(/\*\*/g, '\0GLOBSTAR\0')
    .replace(/\*/g, '\0STAR\0')
    .replace(/\?/g, '\0QUESTION\0')
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\0GLOBSTAR\0/g, '.*')
    .replace(/\0STAR\0/g, '[^/]*')
    .replace(/\0QUESTION\0/g, '[^/]');
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(normalizePath(path));
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
