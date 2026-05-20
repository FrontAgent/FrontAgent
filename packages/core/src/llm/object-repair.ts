import type { z } from 'zod';

export interface ObjectRepairDeps {
  debugLog: (...args: unknown[]) => void;
  debugError: (...args: unknown[]) => void;
  incrementStrategy: (strategy: keyof typeof STRATEGY_NAMES) => void;
}

const STRATEGY_NAMES = {
  unwrapDollarKeys: 'unwrapDollarKeys',
  deepParseStringified: 'deepParseStringified',
  combined: 'combined',
  parseFromText: 'parseFromText',
} as const;

export function tryFixGeneratedObject<T>(
  error: any,
  schema: z.ZodType<T>,
  deps: ObjectRepairDeps,
): T | null {
  const errorToCheck = error.cause || error;

  if (!errorToCheck.value || typeof errorToCheck.value !== 'object') {
    deps.debugLog('[LLMService] No value to fix');
    return null;
  }

  deps.debugLog('[LLMService] ========================================');
  deps.debugLog('[LLMService] Schema Validation Error Detected');
  deps.debugLog('[LLMService] ========================================');
  deps.debugLog('[LLMService] Error name:', error.name);
  deps.debugLog('[LLMService] Error type:', error.constructor.name);
  deps.debugLog('[LLMService] Has cause:', !!error.cause);
  deps.debugLog('[LLMService] Original value keys:', Object.keys(errorToCheck.value));
  deps.debugLog(
    '[LLMService] Original value structure:',
    `${JSON.stringify(errorToCheck.value, null, 2).substring(0, 500)}...`,
  );

  if (errorToCheck.cause?.issues) {
    deps.debugLog('[LLMService] Zod validation issues:');
    errorToCheck.cause.issues.forEach((issue: any, index: number) => {
      deps.debugLog(`[LLMService]   Issue ${index + 1}:`, {
        path: issue.path.join('.'),
        message: issue.message,
        expected: issue.expected,
        received: issue.received,
      });
    });
  }

  // 策略 1: 检测并解包 $ 包装键
  const unwrapped = unwrapDollarKeys(errorToCheck.value, deps);
  if (unwrapped !== errorToCheck.value) {
    deps.debugLog('[LLMService] Strategy 1: Unwrapped $ keys');
    try {
      const validated = schema.parse(unwrapped);
      deps.incrementStrategy('unwrapDollarKeys');
      deps.debugLog('[LLMService] ✅ Strategy 1 succeeded');
      return validated as T;
    } catch (_validationError) {
      deps.debugLog('[LLMService] Strategy 1 failed, trying next...');
    }
  }

  // 策略 2: 深度递归解析字符串化的 JSON 字段
  const deepFixed = deepParseStringifiedFields(errorToCheck.value, deps);
  if (deepFixed !== errorToCheck.value) {
    deps.debugLog('[LLMService] Strategy 2: Deep parsed stringified fields');
    try {
      const validated = schema.parse(deepFixed);
      deps.incrementStrategy('deepParseStringified');
      deps.debugLog('[LLMService] ✅ Strategy 2 succeeded');
      return validated as T;
    } catch (_validationError) {
      deps.debugLog('[LLMService] Strategy 2 failed, trying next...');
    }
  }

  // 策略 3: 组合策略 - 先解包再解析
  const combined = deepParseStringifiedFields(unwrapped, deps);
  if (combined !== errorToCheck.value) {
    deps.debugLog('[LLMService] Strategy 3: Combined unwrap + parse');
    try {
      const validated = schema.parse(combined);
      deps.incrementStrategy('combined');
      deps.debugLog('[LLMService] ✅ Strategy 3 succeeded');
      return validated as T;
    } catch (_validationError) {
      deps.debugLog('[LLMService] Strategy 3 failed, trying next...');
    }
  }

  // 策略 4: 尝试从 text 字段中提取 JSON
  if (errorToCheck.text && typeof errorToCheck.text === 'string') {
    deps.debugLog('[LLMService] Strategy 4: Parsing from error.text field');
    try {
      const parsed = JSON.parse(errorToCheck.text);
      const fixed = deepParseStringifiedFields(unwrapDollarKeys(parsed, deps), deps);
      const validated = schema.parse(fixed);
      deps.incrementStrategy('parseFromText');
      deps.debugLog('[LLMService] ✅ Strategy 4 succeeded');
      return validated as T;
    } catch (_parseError) {
      deps.debugLog('[LLMService] Strategy 4 failed');
    }
  }

  deps.debugLog('[LLMService] All repair strategies failed');
  return null;
}

export function unwrapDollarKeys(obj: any, deps: ObjectRepairDeps): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => unwrapDollarKeys(item, deps));
  }

  const dollarKeys = Object.keys(obj).filter((key) => key.startsWith('$'));

  if (dollarKeys.length === 1 && Object.keys(obj).length === 1) {
    deps.debugLog(`[LLMService] Unwrapping ${dollarKeys[0]}`);
    return unwrapDollarKeys(obj[dollarKeys[0]], deps);
  }

  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!key.startsWith('$')) {
      result[key] = unwrapDollarKeys(value, deps);
    }
  }

  return result;
}

export function deepParseStringifiedFields(obj: any, deps: ObjectRepairDeps): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepParseStringifiedFields(item, deps));
  }

  const result: any = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && value.trim().length > 0) {
      if (value.trim().startsWith('[') || value.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(value);
          deps.debugLog(`[LLMService] Parsed string field "${key}"`);
          result[key] = deepParseStringifiedFields(parsed, deps);
          continue;
        } catch (_parseError) {
          // 无法解析，保持原样
        }
      }
    }

    result[key] = deepParseStringifiedFields(value, deps);
  }

  return result;
}
