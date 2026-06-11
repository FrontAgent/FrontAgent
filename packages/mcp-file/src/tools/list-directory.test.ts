import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { listDirectory } from './list-directory.js';

let roots: string[] = [];

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'mcp-file-list-'));
  roots.push(root);
  return root;
}

/** Creates root/d1/d2/.../d{depth}, each level containing marker.txt */
function makeDeepFixture(root: string, depth: number): void {
  let current = root;
  for (let i = 1; i <= depth; i += 1) {
    current = join(current, `d${i}`);
    mkdirSync(current);
    writeFileSync(join(current, 'marker.txt'), `level ${i}`, 'utf-8');
  }
}

/** Creates `count` flat files file-0000.txt ... in root/flat */
function makeFlatFixture(root: string, count: number): void {
  const dir = join(root, 'flat');
  mkdirSync(dir);
  for (let i = 0; i < count; i += 1) {
    writeFileSync(join(dir, `file-${String(i).padStart(4, '0')}.txt`), 'x', 'utf-8');
  }
}

afterEach(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
  roots = [];
});

describe('listDirectory maxDepth clamping', () => {
  it('clamps oversized maxDepth to the hard limit of 10', () => {
    const root = makeRoot();
    makeDeepFixture(root, 13);

    const result = listDirectory({ path: '.', recursive: true, maxDepth: 999999 }, root);
    expect(result.success).toBe(true);
    const paths = (result.entries ?? []).map((entry) => entry.path);
    // maxDepth=10 lists items down to call depth 10, i.e. contents of d10 (d11 + its marker)
    expect(paths).toContain(
      join('d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9', 'd10', 'd11'),
    );
    expect(paths.some((p) => p.endsWith(join('d11', 'd12')))).toBe(false);
    expect(paths.some((p) => p.endsWith(join('d12', 'marker.txt')))).toBe(false);
  });

  it.each([
    ['zero', 0],
    ['negative', -3],
    ['non-integer', 2.5],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['NaN', Number.NaN],
  ])('rejects %s maxDepth with an error', (_label, maxDepth) => {
    const root = makeRoot();
    makeDeepFixture(root, 2);

    const result = listDirectory({ path: '.', recursive: true, maxDepth }, root);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/maxDepth/);
  });

  it('keeps the default depth of 3 when maxDepth is omitted', () => {
    const root = makeRoot();
    makeDeepFixture(root, 6);

    const result = listDirectory({ path: '.', recursive: true }, root);
    expect(result.success).toBe(true);
    const paths = (result.entries ?? []).map((entry) => entry.path);
    expect(paths).toContain(join('d1', 'd2', 'd3', 'd4'));
    expect(paths.some((p) => p.endsWith(join('d4', 'd5')))).toBe(false);
  });
});

describe('listDirectory entry budget', () => {
  it('truncates at maxEntries and reports omitted count', () => {
    const root = makeRoot();
    makeFlatFixture(root, 10);

    const result = listDirectory({ path: 'flat', maxEntries: 3 }, root);
    expect(result.success).toBe(true);
    expect(result.entries).toHaveLength(3);
    expect(result.truncated).toBe(true);
    expect(result.omittedEntries).toBe(7);
  });

  it('reports truncated: false when under budget', () => {
    const root = makeRoot();
    makeFlatFixture(root, 5);

    const result = listDirectory({ path: 'flat', maxEntries: 100 }, root);
    expect(result.success).toBe(true);
    expect(result.entries).toHaveLength(5);
    expect(result.truncated).toBe(false);
    expect(result.omittedEntries).toBeUndefined();
  });

  it('counts omitted entries across recursive subdirectories', () => {
    const root = makeRoot();
    makeDeepFixture(root, 4); // 4 dirs + 4 markers = 8 entries total

    const result = listDirectory({ path: '.', recursive: true, maxDepth: 10, maxEntries: 2 }, root);
    expect(result.success).toBe(true);
    expect(result.entries).toHaveLength(2);
    expect(result.truncated).toBe(true);
    expect(result.omittedEntries).toBe(6);
  });

  it('clamps oversized maxEntries to the hard limit of 2000', () => {
    const root = makeRoot();
    makeFlatFixture(root, 2005);

    const result = listDirectory({ path: 'flat', maxEntries: 999999 }, root);
    expect(result.success).toBe(true);
    expect(result.entries).toHaveLength(2000);
    expect(result.truncated).toBe(true);
    expect(result.omittedEntries).toBe(5);
  });

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['non-integer', 1.5],
  ])('rejects %s maxEntries with an error', (_label, maxEntries) => {
    const root = makeRoot();
    makeFlatFixture(root, 1);

    const result = listDirectory({ path: 'flat', maxEntries }, root);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/maxEntries/);
  });
});
