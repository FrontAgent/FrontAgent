import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { searchCode } from './search-code.js';

let roots: string[] = [];

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'mcp-file-search-'));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
  roots = [];
});

describe('searchCode', () => {
  it('finds plain query matches', async () => {
    const root = makeRoot();
    writeFileSync(join(root, 'app.ts'), 'const foo = 1;\nconst bar = foo + 1;\n', 'utf-8');

    const result = await searchCode({ query: 'foo' }, root);
    expect(result.success).toBe(true);
    expect(result.totalMatches).toBe(2);
  });

  it('terminates on zero-width regex patterns instead of looping forever', {
    timeout: 5000,
  }, async () => {
    const root = makeRoot();
    writeFileSync(join(root, 'app.ts'), 'const foo = 1;\nconst bar = 2;\n', 'utf-8');

    // `x*` 在不含 x 的位置产生零宽匹配，旧实现会死循环
    const result = await searchCode({ pattern: 'x*' }, root);
    expect(result.success).toBe(true);
  });

  it('still reports non-empty matches for patterns that can match empty strings', {
    timeout: 5000,
  }, async () => {
    const root = makeRoot();
    writeFileSync(join(root, 'app.ts'), 'xx yy xxx\n', 'utf-8');

    const result = await searchCode({ pattern: 'x*' }, root);
    expect(result.success).toBe(true);
    expect(result.matches?.map((m) => m.column)).toEqual([1, 7]);
  });

  it('terminates on lookahead-only patterns', { timeout: 5000 }, async () => {
    const root = makeRoot();
    writeFileSync(join(root, 'app.ts'), 'const foo = 1;\n', 'utf-8');

    const result = await searchCode({ pattern: '(?=foo)' }, root);
    expect(result.success).toBe(true);
    expect(result.totalMatches).toBe(0);
  });
});
