import { describe, expect, it } from 'vitest';
import type { ChecklistItem } from './types.js';
import { ChecklistValidator } from './validator.js';

function makeItem(overrides: Partial<ChecklistItem>): ChecklistItem {
  return {
    id: 'item-1',
    question: 'Test question?',
    category: 'completeness',
    required: true,
    evaluator: { type: 'min_length', chars: 1 },
    ...overrides,
  };
}

describe('ChecklistValidator', () => {
  const validator = new ChecklistValidator();

  describe('regex evaluator', () => {
    it('passes when pattern matches', () => {
      const item = makeItem({ evaluator: { type: 'regex', pattern: 'hello\\s+world' } });
      const result = validator.evaluate('test', [item], 'say hello world');
      expect(result.items[0].passed).toBe(true);
    });

    it('fails when pattern does not match', () => {
      const item = makeItem({ evaluator: { type: 'regex', pattern: 'missing' } });
      const result = validator.evaluate('test', [item], 'no match here');
      expect(result.items[0].passed).toBe(false);
    });

    it('inverts result when invert is true', () => {
      const item = makeItem({ evaluator: { type: 'regex', pattern: 'bad', invert: true } });
      const result = validator.evaluate('test', [item], 'good content');
      expect(result.items[0].passed).toBe(true);
    });

    it('fails inverted when pattern matches', () => {
      const item = makeItem({ evaluator: { type: 'regex', pattern: 'bad', invert: true } });
      const result = validator.evaluate('test', [item], 'this is bad');
      expect(result.items[0].passed).toBe(false);
    });

    it('is case-insensitive and multiline', () => {
      const item = makeItem({ evaluator: { type: 'regex', pattern: '^ERROR' } });
      const result = validator.evaluate('test', [item], 'line1\nError found');
      expect(result.items[0].passed).toBe(true);
    });
  });

  describe('keyword_presence evaluator', () => {
    it('passes when keyword is found', () => {
      const item = makeItem({
        evaluator: { type: 'keyword_presence', keywords: ['react', 'vue'] },
      });
      const result = validator.evaluate('test', [item], 'Using React for UI');
      expect(result.items[0].passed).toBe(true);
    });

    it('fails when no keywords found', () => {
      const item = makeItem({
        evaluator: { type: 'keyword_presence', keywords: ['angular'] },
      });
      const result = validator.evaluate('test', [item], 'Using React');
      expect(result.items[0].passed).toBe(false);
    });

    it('respects minMatches threshold', () => {
      const item = makeItem({
        evaluator: { type: 'keyword_presence', keywords: ['a', 'b', 'c'], minMatches: 2 },
      });
      const pass = validator.evaluate('test', [item], 'has a and b');
      expect(pass.items[0].passed).toBe(true);

      const fail = validator.evaluate('test', [item], 'only a');
      expect(fail.items[0].passed).toBe(false);
    });

    it('is case-insensitive', () => {
      const item = makeItem({
        evaluator: { type: 'keyword_presence', keywords: ['TypeScript'] },
      });
      const result = validator.evaluate('test', [item], 'using typescript');
      expect(result.items[0].passed).toBe(true);
    });
  });

  describe('section_exists evaluator', () => {
    it('passes when heading exists', () => {
      const item = makeItem({ evaluator: { type: 'section_exists', heading: 'Overview' } });
      const result = validator.evaluate('test', [item], '## Overview\nSome content');
      expect(result.items[0].passed).toBe(true);
    });

    it('fails when heading is missing', () => {
      const item = makeItem({ evaluator: { type: 'section_exists', heading: 'Missing' } });
      const result = validator.evaluate('test', [item], '## Other\nContent');
      expect(result.items[0].passed).toBe(false);
    });

    it('matches h1 through h4', () => {
      const item = makeItem({ evaluator: { type: 'section_exists', heading: 'Deep' } });
      const result = validator.evaluate('test', [item], '#### Deep Section');
      expect(result.items[0].passed).toBe(true);
    });
  });

  describe('min_length evaluator', () => {
    it('passes when content meets minimum', () => {
      const item = makeItem({ evaluator: { type: 'min_length', chars: 5 } });
      const result = validator.evaluate('test', [item], 'hello');
      expect(result.items[0].passed).toBe(true);
    });

    it('fails when content is too short', () => {
      const item = makeItem({ evaluator: { type: 'min_length', chars: 100 } });
      const result = validator.evaluate('test', [item], 'short');
      expect(result.items[0].passed).toBe(false);
    });

    it('trims whitespace before checking', () => {
      const item = makeItem({ evaluator: { type: 'min_length', chars: 5 } });
      const result = validator.evaluate('test', [item], '   ab   ');
      expect(result.items[0].passed).toBe(false);
    });
  });

  describe('custom evaluator', () => {
    it('calls custom function with content', () => {
      const item = makeItem({
        evaluator: { type: 'custom', fn: (c) => c.includes('secret') },
      });
      const result = validator.evaluate('test', [item], 'the secret word');
      expect(result.items[0].passed).toBe(true);
    });

    it('passes context to custom function', () => {
      const item = makeItem({
        evaluator: { type: 'custom', fn: (_c, ctx) => ctx?.flag === true },
      });
      const result = validator.evaluate('test', [item], 'content', { flag: true });
      expect(result.items[0].passed).toBe(true);
    });
  });

  describe('overall evaluation', () => {
    it('passes when all required items pass', () => {
      const items = [
        makeItem({ id: 'r1', required: true, evaluator: { type: 'min_length', chars: 1 } }),
        makeItem({ id: 'o1', required: false, evaluator: { type: 'min_length', chars: 999 } }),
      ];
      const result = validator.evaluate('test', items, 'content');
      expect(result.passed).toBe(true);
    });

    it('fails when any required item fails', () => {
      const items = [
        makeItem({ id: 'r1', required: true, evaluator: { type: 'min_length', chars: 999 } }),
      ];
      const result = validator.evaluate('test', items, 'short');
      expect(result.passed).toBe(false);
    });

    it('calculates passRate correctly', () => {
      const items = [
        makeItem({ id: '1', evaluator: { type: 'min_length', chars: 1 } }),
        makeItem({ id: '2', evaluator: { type: 'min_length', chars: 1 } }),
        makeItem({ id: '3', evaluator: { type: 'min_length', chars: 999 } }),
      ];
      const result = validator.evaluate('test', items, 'content');
      expect(result.passRate).toBeCloseTo(2 / 3);
    });

    it('returns passRate 1 for empty items', () => {
      const result = validator.evaluate('test', [], 'content');
      expect(result.passRate).toBe(1);
      expect(result.passed).toBe(true);
    });

    it('includes suggestion for failed items', () => {
      const item = makeItem({
        evaluator: { type: 'section_exists', heading: 'API' },
      });
      const result = validator.evaluate('test', [item], 'no heading');
      expect(result.items[0].suggestion).toContain('API');
    });

    it('omits suggestion for passed items', () => {
      const item = makeItem({ evaluator: { type: 'min_length', chars: 1 } });
      const result = validator.evaluate('test', [item], 'content');
      expect(result.items[0].suggestion).toBeUndefined();
    });
  });
});
