import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LLM_MAX_TOKENS,
  DEFAULT_LLM_TEMPERATURE,
  deepMerge,
  delay,
  escapeRegex,
  generateId,
  matchGlob,
  normalizePath,
  safeJsonParse,
} from './utils.js';

describe('generateId', () => {
  it('generates unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });

  it('includes prefix when provided', () => {
    const id = generateId('task');
    expect(id).toMatch(/^task_/);
  });

  it('generates without prefix', () => {
    const id = generateId();
    expect(id).toMatch(/^[a-z0-9]+_[a-z0-9]+$/);
  });
});

describe('delay', () => {
  it('resolves after specified time', async () => {
    const start = Date.now();
    await delay(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });
});

describe('safeJsonParse', () => {
  it('parses valid JSON', () => {
    const result = safeJsonParse('{"a": 1}', {});
    expect(result).toEqual({ a: 1 });
  });

  it('returns default for invalid JSON', () => {
    const result = safeJsonParse('not json', { fallback: true });
    expect(result).toEqual({ fallback: true });
  });

  it('returns default for empty string', () => {
    const result = safeJsonParse('', []);
    expect(result).toEqual([]);
  });
});

describe('deepMerge', () => {
  it('merges flat objects', () => {
    const target = { a: 1, b: 2 };
    const result = deepMerge(target, { b: 3, c: 4 } as Partial<typeof target>);
    expect(result).toEqual({ a: 1, b: 3, c: 4 });
  });

  it('deep merges nested objects', () => {
    const target = { nested: { a: 1, b: 2 } };
    const source = { nested: { b: 3 } };
    const result = deepMerge(target, source as Partial<typeof target>);
    expect(result).toEqual({ nested: { a: 1, b: 3 } });
  });

  it('overwrites arrays (no merge)', () => {
    const target = { arr: [1, 2, 3] };
    const source = { arr: [4, 5] };
    const result = deepMerge(target, source as Partial<typeof target>);
    expect(result).toEqual({ arr: [4, 5] });
  });

  it('skips undefined values', () => {
    const target = { a: 1, b: 2 };
    const source: Partial<typeof target> = { a: undefined, b: 3 };
    const result = deepMerge(target, source);
    expect(result).toEqual({ a: 1, b: 3 });
  });

  it('does not mutate target', () => {
    const target = { a: 1 };
    deepMerge(target, { a: 2 });
    expect(target.a).toBe(1);
  });
});

describe('normalizePath', () => {
  it('converts backslashes to forward slashes', () => {
    expect(normalizePath('src\\components\\App.tsx')).toBe('src/components/App.tsx');
  });

  it('collapses multiple slashes', () => {
    expect(normalizePath('src//components///App.tsx')).toBe('src/components/App.tsx');
  });

  it('handles already normalized paths', () => {
    expect(normalizePath('src/components/App.tsx')).toBe('src/components/App.tsx');
  });
});

describe('matchGlob', () => {
  it('matches exact path', () => {
    expect(matchGlob('src/index.ts', 'src/index.ts')).toBe(true);
  });

  it('matches single wildcard', () => {
    expect(matchGlob('src/index.ts', 'src/*.ts')).toBe(true);
    expect(matchGlob('src/deep/index.ts', 'src/*.ts')).toBe(false);
  });

  it('matches globstar', () => {
    expect(matchGlob('src/deep/nested/file.ts', 'src/**/*.ts')).toBe(true);
    expect(matchGlob('src/deep/file.ts', '**/*.ts')).toBe(true);
  });

  it('matches question mark', () => {
    expect(matchGlob('src/a.ts', 'src/?.ts')).toBe(true);
    expect(matchGlob('src/ab.ts', 'src/?.ts')).toBe(false);
  });

  it('escapes regex metacharacters in pattern', () => {
    expect(matchGlob('src/file.test.ts', 'src/file.test.ts')).toBe(true);
    expect(matchGlob('src/filextest.ts', 'src/file.test.ts')).toBe(false);
  });

  it('handles backslash paths via normalization', () => {
    expect(matchGlob('src\\components\\App.tsx', 'src/components/*.tsx')).toBe(true);
  });
});

describe('escapeRegex', () => {
  it('escapes all regex metacharacters', () => {
    const templatePlaceholderChars = '$' + '{}';
    expect(escapeRegex(`.*+?^${templatePlaceholderChars}()|[]\\`)).toBe(
      '\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\',
    );
  });

  it('leaves normal strings unchanged', () => {
    expect(escapeRegex('hello world')).toBe('hello world');
  });

  it('escapes dots in file patterns', () => {
    const escaped = escapeRegex('file.test.ts');
    expect(new RegExp(escaped).test('file.test.ts')).toBe(true);
    expect(new RegExp(escaped).test('filextest.ts')).toBe(false);
  });
});

describe('constants', () => {
  it('exports DEFAULT_LLM_TEMPERATURE', () => {
    expect(DEFAULT_LLM_TEMPERATURE).toBe(0.2);
  });

  it('exports DEFAULT_LLM_MAX_TOKENS', () => {
    expect(DEFAULT_LLM_MAX_TOKENS).toBe(4096);
  });
});
