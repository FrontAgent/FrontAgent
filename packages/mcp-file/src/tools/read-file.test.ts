import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readFile } from './read-file.js';

let roots: string[] = [];

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'mcp-file-read-'));
  roots.push(root);
  return root;
}

function makeFixture(root: string): void {
  writeFileSync(join(root, 'sample.txt'), 'line1\nline2\nline3\nline4\nline5', 'utf-8');
}

afterEach(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
  roots = [];
});

describe('readFile', () => {
  it('reads the whole file by default', () => {
    const root = makeRoot();
    makeFixture(root);

    const result = readFile({ path: 'sample.txt' }, root);
    expect(result.success).toBe(true);
    expect(result.content).toBe('line1\nline2\nline3\nline4\nline5');
    expect(result.lines).toBe(5);
  });

  it('returns the requested line range with accurate line count', () => {
    const root = makeRoot();
    makeFixture(root);

    const result = readFile({ path: 'sample.txt', startLine: 2, endLine: 4 }, root);
    expect(result.success).toBe(true);
    expect(result.content).toBe('line2\nline3\nline4');
    expect(result.lines).toBe(3);
  });

  it('clamps endLine beyond file length and reports actual lines', () => {
    const root = makeRoot();
    makeFixture(root);

    const result = readFile({ path: 'sample.txt', startLine: 4, endLine: 100 }, root);
    expect(result.success).toBe(true);
    expect(result.content).toBe('line4\nline5');
    expect(result.lines).toBe(2);
  });

  it('rejects startLine of 0 instead of returning the last line', () => {
    const root = makeRoot();
    makeFixture(root);

    const result = readFile({ path: 'sample.txt', startLine: 0, endLine: 2 }, root);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid startline/i);
  });

  it('rejects negative startLine', () => {
    const root = makeRoot();
    makeFixture(root);

    const result = readFile({ path: 'sample.txt', startLine: -2 }, root);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid startline/i);
  });

  it('rejects endLine smaller than startLine instead of negative line count', () => {
    const root = makeRoot();
    makeFixture(root);

    const result = readFile({ path: 'sample.txt', startLine: 4, endLine: 2 }, root);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid endline/i);
  });

  it('rejects startLine beyond file length instead of silent empty content', () => {
    const root = makeRoot();
    makeFixture(root);

    const result = readFile({ path: 'sample.txt', startLine: 10 }, root);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/exceeds file length/i);
  });

  it('rejects non-integer line numbers', () => {
    const root = makeRoot();
    makeFixture(root);

    const result = readFile({ path: 'sample.txt', startLine: 1.5 }, root);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid startline/i);
  });
});
