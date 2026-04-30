import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SnapshotManager } from './snapshot.js';
import { applyPatch } from './tools/apply-patch.js';
import { createFile } from './tools/create-file.js';
import { readFile } from './tools/read-file.js';

let roots: string[] = [];

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'frontagent-file-'));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
  roots = [];
});

describe('mcp-file security boundaries', () => {
  it('blocks sibling-prefix path traversal', () => {
    const root = makeRoot();
    const sibling = `${root}-sibling`;
    mkdirSync(sibling);
    writeFileSync(join(sibling, 'secret.txt'), 'secret', 'utf-8');
    roots.push(sibling);

    const result = readFile({ path: relative(root, join(sibling, 'secret.txt')) }, root);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/outside project root|not found/i);
  });

  it('blocks symlink escapes for reads', () => {
    const root = makeRoot();
    const outside = mkdtempSync(join(tmpdir(), 'frontagent-outside-'));
    roots.push(outside);
    writeFileSync(join(outside, 'secret.txt'), 'secret', 'utf-8');
    symlinkSync(join(outside, 'secret.txt'), join(root, 'link.txt'));

    const result = readFile({ path: 'link.txt' }, root);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/outside project root/i);
  });

  it('does not let apply_patch create missing files', () => {
    const root = makeRoot();
    const snapshotManager = new SnapshotManager(root);

    const result = applyPatch({
      path: 'src/new.ts',
      patches: [{ operation: 'insert', startLine: 1, content: 'export {};' }],
    }, root, snapshotManager);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/does not exist/i);
  });

  it('does not create snapshots during dry runs', () => {
    const root = makeRoot();
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'src/app.ts'), 'const value = 1;\n', 'utf-8');
    const snapshotManager = new SnapshotManager(root);

    const result = applyPatch({
      path: 'src/app.ts',
      dryRun: true,
      patches: [{ operation: 'replace', startLine: 1, content: 'const value = 2;' }],
    }, root, snapshotManager);

    expect(result.success).toBe(true);
    expect(result.snapshotId).toBe('');
    expect(readFileSync(join(root, 'src/app.ts'), 'utf-8')).toBe('const value = 1;\n');
    expect(snapshotManager.getFileSnapshots('src/app.ts')).toHaveLength(0);
  });

  it('requires security approval for dependency files and overwrites', () => {
    const root = makeRoot();
    writeFileSync(join(root, 'package.json'), '{"name":"x"}\n', 'utf-8');
    const snapshotManager = new SnapshotManager(root);

    const deniedPatch = applyPatch({
      path: 'package.json',
      patches: [{ operation: 'replace', startLine: 1, content: '{"name":"y"}' }],
    }, root, snapshotManager);
    const deniedOverwrite = createFile({
      path: 'src/app.ts',
      content: 'export {};',
      overwrite: true,
    }, root, snapshotManager);
    const approvedPatch = applyPatch({
      path: 'package.json',
      __frontagentSecurityApproved: true,
      patches: [{ operation: 'replace', startLine: 1, content: '{"name":"z"}' }],
    }, root, snapshotManager);

    expect(deniedPatch.success).toBe(false);
    expect(deniedPatch.error).toMatch(/Security approval required/i);
    expect(deniedOverwrite.success).toBe(false);
    expect(deniedOverwrite.error).toMatch(/overwriting/i);
    expect(approvedPatch.success).toBe(true);
  });

  it('ignores tampered snapshot records outside the project root', () => {
    const root = makeRoot();
    const snapshotDir = join(root, '.frontagent', 'snapshots');
    mkdirSync(snapshotDir, { recursive: true });
    writeFileSync(
      join(snapshotDir, 'snap-tampered.json'),
      JSON.stringify({
        id: 'snap-tampered',
        timestamp: Date.now(),
        filePath: '/tmp/outside-frontagent-file.txt',
        content: '',
        operation: 'modify',
        previousContent: 'bad',
      }),
      'utf-8',
    );

    const snapshotManager = new SnapshotManager(root);
    snapshotManager.loadSnapshots();

    expect(snapshotManager.rollback('snap-tampered').success).toBe(false);
  });
});
