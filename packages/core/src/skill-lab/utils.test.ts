import { describe, expect, it } from 'vitest';
import {
  extractReferencedFilesFromMarkdown,
  normalizeText,
  sanitizeToken,
  stripCodeFences,
  truncateText,
} from './utils.js';

describe('normalizeText', () => {
  it('lowercases input', () => {
    expect(normalizeText('Hello World')).toBe('hello world');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeText('a   b    c')).toBe('a b c');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeText('  hello  ')).toBe('hello');
  });

  it('normalizes tabs and newlines to single space', () => {
    expect(normalizeText('a\tb\nc')).toBe('a b c');
  });

  it('handles empty string', () => {
    expect(normalizeText('')).toBe('');
  });
});

describe('sanitizeToken', () => {
  it('converts to lowercase kebab-case', () => {
    expect(sanitizeToken('Hello World')).toBe('hello-world');
  });

  it('replaces special characters with hyphens', () => {
    expect(sanitizeToken('foo@bar#baz')).toBe('foo-bar-baz');
  });

  it('strips leading and trailing hyphens', () => {
    expect(sanitizeToken('--hello--')).toBe('hello');
  });

  it('collapses consecutive special chars to single hyphen', () => {
    expect(sanitizeToken('a!!!b')).toBe('a-b');
  });

  it('preserves digits', () => {
    expect(sanitizeToken('version 2.0')).toBe('version-2-0');
  });

  it('handles empty string', () => {
    expect(sanitizeToken('')).toBe('');
  });
});

describe('stripCodeFences', () => {
  it('removes triple backtick fences', () => {
    const input = '```\nconst x = 1;\n```';
    expect(stripCodeFences(input)).toBe('const x = 1;');
  });

  it('removes fences with language tag', () => {
    const input = '```typescript\nconst x = 1;\n```';
    expect(stripCodeFences(input)).toBe('const x = 1;');
  });

  it('returns plain text unchanged', () => {
    const input = 'just plain text';
    expect(stripCodeFences(input)).toBe('just plain text');
  });

  it('trims surrounding whitespace', () => {
    const input = '  hello  ';
    expect(stripCodeFences(input)).toBe('hello');
  });

  it('handles multi-line content inside fences', () => {
    const input = '```js\nline1\nline2\nline3\n```';
    expect(stripCodeFences(input)).toBe('line1\nline2\nline3');
  });

  it('does not strip partial fences', () => {
    const input = '```start\nbut no end';
    expect(stripCodeFences(input)).toBe('```start\nbut no end');
  });
});

describe('extractReferencedFilesFromMarkdown', () => {
  it('extracts references/ paths from backticks', () => {
    const md = 'See `references/design.md` for details.';
    expect(extractReferencedFilesFromMarkdown(md)).toEqual(['references/design.md']);
  });

  it('extracts assets/ paths from backticks', () => {
    const md = 'Image at `assets/logo.png`.';
    expect(extractReferencedFilesFromMarkdown(md)).toEqual(['assets/logo.png']);
  });

  it('extracts multiple paths', () => {
    const md = '`references/a.md` and `assets/b.png` and `references/c.ts`';
    const result = extractReferencedFilesFromMarkdown(md);
    expect(result).toContain('references/a.md');
    expect(result).toContain('assets/b.png');
    expect(result).toContain('references/c.ts');
  });

  it('deduplicates repeated paths', () => {
    const md = '`references/x.md` then `references/x.md` again';
    expect(extractReferencedFilesFromMarkdown(md)).toEqual(['references/x.md']);
  });

  it('ignores non-references/assets paths', () => {
    const md = '`src/app.ts` and `lib/utils.ts`';
    expect(extractReferencedFilesFromMarkdown(md)).toEqual([]);
  });

  it('returns empty array for no matches', () => {
    expect(extractReferencedFilesFromMarkdown('no paths here')).toEqual([]);
  });
});

describe('truncateText', () => {
  it('returns input unchanged when within limit', () => {
    expect(truncateText('short', 100)).toBe('short');
  });

  it('returns input unchanged when exactly at limit', () => {
    expect(truncateText('12345', 5)).toBe('12345');
  });

  it('truncates and appends ellipsis marker', () => {
    const result = truncateText('hello world', 5);
    expect(result).toBe('hello\n...');
  });

  it('handles empty string', () => {
    expect(truncateText('', 10)).toBe('');
  });
});
