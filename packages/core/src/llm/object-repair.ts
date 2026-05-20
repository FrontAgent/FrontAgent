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
  error: unknown,
  schema: z.ZodType<T>,
  deps: ObjectRepairDeps,
): T | null {
  const err = error as Record<string, unknown>;
  const errorToCheck = (err.cause || err) as Record<string, unknown>;

  if (!errorToCheck.value || typeof errorToCheck.value !== 'object') {
    deps.debugLog('[LLMService] No value to fix');
    return null;
  }

  deps.debugLog('[LLMService] ========================================');
  deps.debugLog('[LLMService] Schema Validation Error Detected');
  deps.debugLog('[LLMService] ========================================');
  deps.debugLog('[LLMService] Error name:', err.name);
  deps.debugLog(
    '[LLMService] Error type:',
    (error as { constructor?: { name?: string } })?.constructor?.name,
  );
  deps.debugLog('[LLMService] Has cause:', !!err.cause);
  deps.debugLog('[LLMService] Original value keys:', Object.keys(errorToCheck.value));
  deps.debugLog(
    '[LLMService] Original value structure:',
    `${JSON.stringify(errorToCheck.value, null, 2).substring(0, 500)}...`,
  );

  if ((errorToCheck.cause as Record<string, unknown>)?.issues) {
    deps.debugLog('[LLMService] Zod validation issues:');
    const issues = (errorToCheck.cause as Record<string, unknown>).issues as Array<
      Record<string, unknown>
    >;
    issues.forEach((issue, index: number) => {
      deps.debugLog(`[LLMService]   Issue ${index + 1}:`, {
        path: (issue.path as string[])?.join('.'),
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

export function unwrapDollarKeys(obj: unknown, deps: ObjectRepairDeps): unknown {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => unwrapDollarKeys(item, deps));
  }

  const record = obj as Record<string, unknown>;
  const dollarKeys = Object.keys(record).filter((key) => key.startsWith('$'));

  if (dollarKeys.length === 1 && Object.keys(record).length === 1) {
    deps.debugLog(`[LLMService] Unwrapping ${dollarKeys[0]}`);
    return unwrapDollarKeys(record[dollarKeys[0]], deps);
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!key.startsWith('$')) {
      result[key] = unwrapDollarKeys(value, deps);
    }
  }

  return result;
}

export function deepParseStringifiedFields(obj: unknown, deps: ObjectRepairDeps): unknown {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepParseStringifiedFields(item, deps));
  }

  const record = obj as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
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
