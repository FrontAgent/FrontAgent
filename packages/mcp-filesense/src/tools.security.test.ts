import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { handleFilesenseTool } from './tools.js';

let roots: string[] = [];

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'frontagent-filesense-'));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
  roots = [];
});

describe('mcp-filesense path containment', () => {
  it('rejects absolute paths outside the project root', async () => {
    const root = makeRoot();
    const result = await handleFilesenseTool('filesense_check', { path: '/etc' }, root);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/outside project root/i);
  });

  it('rejects parent-directory traversal', async () => {
    const root = makeRoot();
    const result = await handleFilesenseTool('filesense_check', { path: '../../../etc' }, root);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/outside project root/i);
  });

  it('rejects sibling-prefix traversal', async () => {
    const root = makeRoot();
    const sibling = `${root}-sibling`;
    roots.push(sibling);
    const result = await handleFilesenseTool(
      'filesense_check',
      { path: '../frontagent-filesense-sibling' },
      root,
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/outside project root/i);
  });

  it('rejects out-of-root entries in navigate paths', async () => {
    const root = makeRoot();
    const result = await handleFilesenseTool(
      'filesense_navigate',
      { paths: ['.', '../../../etc'] },
      root,
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/outside project root/i);
  });

  it('allows in-root relative paths', async () => {
    const root = makeRoot();
    writeFileSync(join(root, 'index.ts'), 'export const x = 1;\n', 'utf-8');

    const result = await handleFilesenseTool('filesense_check', { path: '.' }, root);

    expect(result.success).toBe(true);
  });
});
