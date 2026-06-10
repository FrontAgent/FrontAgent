import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SnapshotManager } from '../snapshot.js';
import { applyPatch } from './apply-patch.js';

const FIXTURE = 'line1\nline2\nline3\nline4\nline5';

let roots: string[] = [];

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'mcp-file-patch-'));
  roots.push(root);
  return root;
}

function makeFixture(root: string): void {
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src/sample.ts'), FIXTURE, 'utf-8');
}

function readFixture(root: string): string {
  return readFileSync(join(root, 'src/sample.ts'), 'utf-8');
}

afterEach(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
  roots = [];
});

describe('applyPatch line-range validation', () => {
  it('applies a valid replace patch', () => {
    const root = makeRoot();
    makeFixture(root);

    const result = applyPatch(
      {
        path: 'src/sample.ts',
        patches: [{ operation: 'replace', startLine: 2, endLine: 3, content: 'patched' }],
      },
      root,
      new SnapshotManager(root),
    );

    expect(result.success).toBe(true);
    expect(readFixture(root)).toBe('line1\npatched\nline4\nline5');
  });

  it('allows insert at lineCount + 1 to append at end of file', () => {
    const root = makeRoot();
    makeFixture(root);

    const result = applyPatch(
      {
        path: 'src/sample.ts',
        patches: [{ operation: 'insert', startLine: 6, content: 'line6' }],
      },
      root,
      new SnapshotManager(root),
    );

    expect(result.success).toBe(true);
    expect(readFixture(root)).toBe(`${FIXTURE}\nline6`);
  });

  it('rejects startLine of 0 instead of splicing from the end', () => {
    const root = makeRoot();
    makeFixture(root);

    const result = applyPatch(
      {
        path: 'src/sample.ts',
        patches: [{ operation: 'replace', startLine: 0, content: 'corrupted' }],
      },
      root,
      new SnapshotManager(root),
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/startLine 0 must be an integer >= 1/);
    expect(readFixture(root)).toBe(FIXTURE);
  });

  it('rejects negative startLine', () => {
    const root = makeRoot();
    makeFixture(root);

    const result = applyPatch(
      {
        path: 'src/sample.ts',
        patches: [{ operation: 'delete', startLine: -2 }],
      },
      root,
      new SnapshotManager(root),
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/startLine -2 must be an integer >= 1/);
    expect(readFixture(root)).toBe(FIXTURE);
  });

  it('rejects non-integer startLine', () => {
    const root = makeRoot();
    makeFixture(root);

    const result = applyPatch(
      {
        path: 'src/sample.ts',
        patches: [{ operation: 'replace', startLine: 1.5, content: 'x' }],
      },
      root,
      new SnapshotManager(root),
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/startLine 1.5 must be an integer/);
    expect(readFixture(root)).toBe(FIXTURE);
  });

  it('rejects replace/delete startLine beyond file length', () => {
    const root = makeRoot();
    makeFixture(root);

    const result = applyPatch(
      {
        path: 'src/sample.ts',
        patches: [{ operation: 'delete', startLine: 6 }],
      },
      root,
      new SnapshotManager(root),
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/startLine 6 exceeds file length \(5 lines\)/);
    expect(readFixture(root)).toBe(FIXTURE);
  });

  it('rejects insert startLine beyond lineCount + 1', () => {
    const root = makeRoot();
    makeFixture(root);

    const result = applyPatch(
      {
        path: 'src/sample.ts',
        patches: [{ operation: 'insert', startLine: 7, content: 'late' }],
      },
      root,
      new SnapshotManager(root),
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/startLine 7 exceeds file length \+ 1/);
    expect(readFixture(root)).toBe(FIXTURE);
  });

  it('rejects endLine lower than startLine', () => {
    const root = makeRoot();
    makeFixture(root);

    const result = applyPatch(
      {
        path: 'src/sample.ts',
        patches: [{ operation: 'replace', startLine: 3, endLine: 2, content: 'x' }],
      },
      root,
      new SnapshotManager(root),
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/endLine 2 must be an integer >= startLine \(3\)/);
    expect(readFixture(root)).toBe(FIXTURE);
  });

  it('rejects endLine beyond file length', () => {
    const root = makeRoot();
    makeFixture(root);

    const result = applyPatch(
      {
        path: 'src/sample.ts',
        patches: [{ operation: 'delete', startLine: 4, endLine: 100 }],
      },
      root,
      new SnapshotManager(root),
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/endLine 100 exceeds file length \(5 lines\)/);
    expect(readFixture(root)).toBe(FIXTURE);
  });

  it('rejects the whole patch set before creating a snapshot when any patch is invalid', () => {
    const root = makeRoot();
    makeFixture(root);
    const snapshotManager = new SnapshotManager(root);

    const result = applyPatch(
      {
        path: 'src/sample.ts',
        patches: [
          { operation: 'replace', startLine: 1, content: 'valid' },
          { operation: 'delete', startLine: 99 },
        ],
      },
      root,
      snapshotManager,
    );

    expect(result.success).toBe(false);
    expect(result.snapshotId).toBe('');
    expect(snapshotManager.getFileSnapshots(join(root, 'src/sample.ts'))).toHaveLength(0);
    expect(readFixture(root)).toBe(FIXTURE);
  });
});
