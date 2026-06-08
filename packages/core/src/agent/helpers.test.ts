import { describe, expect, it } from 'vitest';
import { mergeRetrievalQuery, normalizeSearchQuery, truncateForPrompt } from './helpers.js';

describe('truncateForPrompt', () => {
  it('returns input unchanged when within limit', () => {
    expect(truncateForPrompt('short', 100)).toBe('short');
  });

  it('returns input unchanged when exactly at limit', () => {
    expect(truncateForPrompt('12345', 5)).toBe('12345');
  });

  it('truncates and appends ellipsis marker', () => {
    expect(truncateForPrompt('hello world', 5)).toBe('hello\n...');
  });

  it('handles empty string', () => {
    expect(truncateForPrompt('', 10)).toBe('');
  });
});

describe('normalizeSearchQuery', () => {
  it('removes code fences', () => {
    const input = 'before ```code here``` after';
    expect(normalizeSearchQuery(input)).toBe('before after');
  });

  it('collapses whitespace', () => {
    expect(normalizeSearchQuery('a   b\n\nc')).toBe('a b c');
  });

  it('strips surrounding quotes', () => {
    expect(normalizeSearchQuery('"hello world"')).toBe('hello world');
    expect(normalizeSearchQuery("'hello world'")).toBe('hello world');
    expect(normalizeSearchQuery('`hello world`')).toBe('hello world');
  });

  it('strips smart quotes', () => {
    expect(normalizeSearchQuery('“hello”')).toBe('hello');
  });

  it('trims result', () => {
    expect(normalizeSearchQuery('  hello  ')).toBe('hello');
  });

  it('handles empty string', () => {
    expect(normalizeSearchQuery('')).toBe('');
  });

  it('handles multi-line code fences', () => {
    const input = 'query ```\nconst x = 1;\nconst y = 2;\n``` end';
    expect(normalizeSearchQuery(input)).toBe('query end');
  });
});

describe('mergeRetrievalQuery', () => {
  it('returns rewritten when original is empty', () => {
    expect(mergeRetrievalQuery('', 'rewritten query')).toBe('rewritten query');
  });

  it('returns original when rewritten is empty', () => {
    expect(mergeRetrievalQuery('original query', '')).toBe('original query');
  });

  it('returns rewritten when it contains original', () => {
    expect(mergeRetrievalQuery('auth', 'auth validation logic')).toBe('auth validation logic');
  });

  it('returns original when it contains rewritten', () => {
    expect(mergeRetrievalQuery('auth validation logic', 'auth')).toBe('auth validation logic');
  });

  it('concatenates when neither contains the other', () => {
    expect(mergeRetrievalQuery('login flow', 'session management')).toBe(
      'login flow session management',
    );
  });

  it('truncates merged result at 320 chars', () => {
    const long1 = 'a'.repeat(200);
    const long2 = 'b'.repeat(200);
    const result = mergeRetrievalQuery(long1, long2);
    expect(result.length).toBeLessThanOrEqual(320);
  });
});
