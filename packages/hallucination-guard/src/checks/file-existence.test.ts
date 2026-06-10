import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkFileExistence, checkFilesExistence } from './file-existence.js';

let roots: string[] = [];

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'hallucination-guard-'));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
  roots = [];
});

describe('checkFileExistence', () => {
  it('passes for existing file', async () => {
    const root = makeRoot();
    writeFileSync(join(root, 'app.ts'), '', 'utf-8');

    const result = await checkFileExistence({ path: 'app.ts', projectRoot: root });
    expect(result.pass).toBe(true);
    expect(result.type).toBe('file_existence');
  });

  it('fails for non-existent file', async () => {
    const root = makeRoot();

    const result = await checkFileExistence({ path: 'missing.ts', projectRoot: root });
    expect(result.pass).toBe(false);
    expect(result.message).toMatch(/does not exist/i);
  });

  it('blocks path traversal outside project root', async () => {
    const root = makeRoot();

    const result = await checkFileExistence({ path: '../../../etc/passwd', projectRoot: root });
    expect(result.pass).toBe(false);
    expect(result.severity).toBe('block');
    expect(result.message).toMatch(/outside project root/i);
  });

  it('blocks sibling directory sharing the project root prefix', async () => {
    const root = makeRoot();
    const sibling = `${root}-secret`;
    mkdirSync(sibling);
    roots.push(sibling);
    writeFileSync(join(sibling, 'leak.txt'), '', 'utf-8');

    const result = await checkFileExistence({
      path: relative(root, join(sibling, 'leak.txt')),
      projectRoot: root,
    });
    expect(result.pass).toBe(false);
    expect(result.severity).toBe('block');
    expect(result.message).toMatch(/outside project root/i);
  });

  it('blocks absolute path outside project root', async () => {
    const root = makeRoot();

    const result = await checkFileExistence({ path: '/etc/hosts', projectRoot: root });
    expect(result.pass).toBe(false);
    expect(result.severity).toBe('block');
    expect(result.message).toMatch(/outside project root/i);
  });

  it('normalizes project root with trailing separator', async () => {
    const root = makeRoot();
    writeFileSync(join(root, 'app.ts'), '', 'utf-8');

    const result = await checkFileExistence({ path: 'app.ts', projectRoot: `${root}/` });
    expect(result.pass).toBe(true);
  });

  it('fails when path is a directory, not a file', async () => {
    const root = makeRoot();
    mkdirSync(join(root, 'src'));

    const result = await checkFileExistence({ path: 'src', projectRoot: root });
    expect(result.pass).toBe(false);
    expect(result.message).toMatch(/not a file/i);
  });

  it('passes with shouldExist=false when file does not exist', async () => {
    const root = makeRoot();

    const result = await checkFileExistence({
      path: 'new-file.ts',
      projectRoot: root,
      shouldExist: false,
    });
    expect(result.pass).toBe(true);
  });

  it('fails with shouldExist=false when file exists', async () => {
    const root = makeRoot();
    writeFileSync(join(root, 'existing.ts'), '', 'utf-8');

    const result = await checkFileExistence({
      path: 'existing.ts',
      projectRoot: root,
      shouldExist: false,
    });
    expect(result.pass).toBe(false);
    expect(result.severity).toBe('warn');
  });
});

describe('checkFilesExistence', () => {
  it('checks multiple files in batch', async () => {
    const root = makeRoot();
    writeFileSync(join(root, 'a.ts'), '', 'utf-8');

    const results = await checkFilesExistence(['a.ts', 'b.ts'], root);
    expect(results).toHaveLength(2);
    expect(results[0].pass).toBe(true);
    expect(results[1].pass).toBe(false);
  });
});
