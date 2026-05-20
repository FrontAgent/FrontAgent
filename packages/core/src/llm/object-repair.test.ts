import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { ObjectRepairDeps } from './object-repair.js';
import {
  deepParseStringifiedFields,
  tryFixGeneratedObject,
  unwrapDollarKeys,
} from './object-repair.js';

const noopDeps: ObjectRepairDeps = {
  debugLog: () => {},
  debugError: () => {},
  incrementStrategy: () => {},
};

describe('unwrapDollarKeys', () => {
  it('unwraps single $-prefixed key', () => {
    const input = { $result: { name: 'test' } };
    expect(unwrapDollarKeys(input, noopDeps)).toEqual({ name: 'test' });
  });

  it('unwraps nested $-prefixed keys', () => {
    const input = { $outer: { $inner: 'value' } };
    expect(unwrapDollarKeys(input, noopDeps)).toBe('value');
  });

  it('removes $-prefixed keys when mixed with normal keys', () => {
    const input = { name: 'test', $meta: 'ignored' };
    expect(unwrapDollarKeys(input, noopDeps)).toEqual({ name: 'test' });
  });

  it('processes arrays recursively', () => {
    const input = [{ $item: 'a' }, { $item: 'b' }];
    expect(unwrapDollarKeys(input, noopDeps)).toEqual(['a', 'b']);
  });

  it('returns primitives unchanged', () => {
    expect(unwrapDollarKeys('hello', noopDeps)).toBe('hello');
    expect(unwrapDollarKeys(42, noopDeps)).toBe(42);
    expect(unwrapDollarKeys(null, noopDeps)).toBe(null);
    expect(unwrapDollarKeys(true, noopDeps)).toBe(true);
  });

  it('returns object unchanged when no $-keys present', () => {
    const input = { name: 'test', value: 123 };
    const result = unwrapDollarKeys(input, noopDeps);
    expect(result).toEqual(input);
  });

  it('does not unwrap when multiple $-keys exist', () => {
    const input = { $a: 1, $b: 2 };
    expect(unwrapDollarKeys(input, noopDeps)).toEqual({});
  });
});

describe('deepParseStringifiedFields', () => {
  it('parses JSON object strings in fields', () => {
    const input = { data: '{"name":"test"}' };
    expect(deepParseStringifiedFields(input, noopDeps)).toEqual({
      data: { name: 'test' },
    });
  });

  it('parses JSON array strings in fields', () => {
    const input = { items: '["a","b","c"]' };
    expect(deepParseStringifiedFields(input, noopDeps)).toEqual({
      items: ['a', 'b', 'c'],
    });
  });

  it('recursively parses nested stringified fields', () => {
    const input = { outer: '{"inner":"{\\"deep\\":true}"}' };
    const result = deepParseStringifiedFields(input, noopDeps) as Record<string, unknown>;
    const outer = result.outer as Record<string, unknown>;
    expect(outer.inner).toEqual({ deep: true });
  });

  it('leaves non-JSON strings unchanged', () => {
    const input = { name: 'hello world', count: 'not json' };
    expect(deepParseStringifiedFields(input, noopDeps)).toEqual(input);
  });

  it('leaves empty strings unchanged', () => {
    const input = { value: '' };
    expect(deepParseStringifiedFields(input, noopDeps)).toEqual({ value: '' });
  });

  it('processes arrays recursively', () => {
    const input = [{ data: '{"x":1}' }];
    expect(deepParseStringifiedFields(input, noopDeps)).toEqual([{ data: { x: 1 } }]);
  });

  it('returns primitives unchanged', () => {
    expect(deepParseStringifiedFields('hello', noopDeps)).toBe('hello');
    expect(deepParseStringifiedFields(42, noopDeps)).toBe(42);
    expect(deepParseStringifiedFields(null, noopDeps)).toBe(null);
  });

  it('handles strings that look like JSON but are invalid', () => {
    const input = { data: '{not valid json}' };
    expect(deepParseStringifiedFields(input, noopDeps)).toEqual(input);
  });
});

describe('tryFixGeneratedObject', () => {
  const schema = z.object({
    name: z.string(),
    items: z.array(z.string()),
  });

  it('returns null when error has no value', () => {
    const error = { message: 'fail' };
    expect(tryFixGeneratedObject(error, schema, noopDeps)).toBeNull();
  });

  it('fixes $-wrapped values (strategy 1)', () => {
    const error = { value: { $result: { name: 'test', items: ['a'] } } };
    const strategies: string[] = [];
    const deps: ObjectRepairDeps = {
      debugLog: () => {},
      debugError: () => {},
      incrementStrategy: (s) => strategies.push(s),
    };
    const result = tryFixGeneratedObject(error, schema, deps);
    expect(result).toEqual({ name: 'test', items: ['a'] });
    expect(strategies).toContain('unwrapDollarKeys');
  });

  it('fixes stringified fields (strategy 2)', () => {
    const error = { value: { name: 'test', items: '["a","b"]' } };
    const strategies: string[] = [];
    const deps: ObjectRepairDeps = {
      debugLog: () => {},
      debugError: () => {},
      incrementStrategy: (s) => strategies.push(s),
    };
    const result = tryFixGeneratedObject(error, schema, deps);
    expect(result).toEqual({ name: 'test', items: ['a', 'b'] });
    expect(strategies).toContain('deepParseStringified');
  });

  it('fixes combined $-wrap + stringified (strategy 3)', () => {
    const error = { value: { $result: { name: 'test', items: '["x"]' } } };
    const strategies: string[] = [];
    const deps: ObjectRepairDeps = {
      debugLog: () => {},
      debugError: () => {},
      incrementStrategy: (s) => strategies.push(s),
    };
    const result = tryFixGeneratedObject(error, schema, deps);
    expect(result).toEqual({ name: 'test', items: ['x'] });
    expect(strategies).toContain('combined');
  });

  it('fixes from text field (strategy 4)', () => {
    const error = {
      value: { broken: true },
      text: JSON.stringify({ name: 'from-text', items: ['y'] }),
    };
    const strategies: string[] = [];
    const deps: ObjectRepairDeps = {
      debugLog: () => {},
      debugError: () => {},
      incrementStrategy: (s) => strategies.push(s),
    };
    const result = tryFixGeneratedObject(error, schema, deps);
    expect(result).toEqual({ name: 'from-text', items: ['y'] });
    expect(strategies).toContain('parseFromText');
  });

  it('returns null when all strategies fail', () => {
    const error = { value: { completely: 'wrong', structure: 123 } };
    expect(tryFixGeneratedObject(error, schema, noopDeps)).toBeNull();
  });

  it('uses cause.value when error has cause', () => {
    const error = {
      cause: { value: { $result: { name: 'from-cause', items: ['z'] } } },
    };
    const result = tryFixGeneratedObject(error, schema, noopDeps);
    expect(result).toEqual({ name: 'from-cause', items: ['z'] });
  });
});
