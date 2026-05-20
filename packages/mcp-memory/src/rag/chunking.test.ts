import { describe, expect, it } from 'vitest';
import { chunkText } from './chunking.js';

describe('chunkText', () => {
  it('returns empty for empty/whitespace content', () => {
    expect(chunkText('', 'test.ts', 1200, 200)).toEqual([]);
    expect(chunkText('   \n  \n  ', 'test.ts', 1200, 200)).toEqual([]);
  });

  it('returns a single chunk for short content', () => {
    const content = 'const x = 1;\nconst y = 2;';
    const chunks = chunkText(content, 'test.ts', 1200, 200);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toContain('const x = 1;');
    expect(chunks[0].lineStart).toBe(1);
    expect(chunks[0].lineEnd).toBe(2);
  });

  it('splits large content into multiple chunks', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `const var${i} = ${i};`);
    const content = lines.join('\n\n');
    const chunks = chunkText(content, 'test.ts', 200, 50);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('preserves line numbers across chunks', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`);
    const content = lines.join('\n\n');
    const chunks = chunkText(content, 'test.md', 100, 20);
    expect(chunks[0].lineStart).toBe(1);
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].lineStart).toBeGreaterThanOrEqual(chunks[i - 1].lineStart);
    }
  });

  it('handles markdown headers as semantic boundaries', () => {
    const content =
      '# Title\n\nSome intro text.\n\n## Section A\n\nContent A.\n\n## Section B\n\nContent B.';
    const chunks = chunkText(content, 'readme.md', 50, 10);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('handles code fences as blocks', () => {
    const content = 'Some text\n\n```ts\nconst x = 1;\nconst y = 2;\n```\n\nMore text';
    const chunks = chunkText(content, 'doc.md', 1200, 200);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    const allText = chunks.map((c) => c.text).join('\n');
    expect(allText).toContain('```ts');
    expect(allText).toContain('const x = 1;');
  });

  it('recognizes TypeScript function boundaries', () => {
    const content = [
      'export function foo() {',
      '  return 1;',
      '}',
      '',
      'export function bar() {',
      '  return 2;',
      '}',
    ].join('\n');
    const chunks = chunkText(content, 'module.ts', 60, 10);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it('handles overlap between chunks', () => {
    const blocks = Array.from({ length: 20 }, (_, i) => `Block ${i}: ${'x'.repeat(40)}`);
    const content = blocks.join('\n\n');
    const chunks = chunkText(content, 'test.txt', 150, 60);
    if (chunks.length >= 2) {
      const firstEnd = chunks[0].lineEnd;
      const secondStart = chunks[1].lineStart;
      expect(secondStart).toBeLessThanOrEqual(firstEnd + 1);
    }
  });
});
