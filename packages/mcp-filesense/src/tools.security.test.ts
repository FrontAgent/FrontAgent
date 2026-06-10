import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { handleFilesenseTool } from './tools.js';
import type { CheckSummary, NavigateResult, SyncSummary } from './types.js';

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

describe('mcp-filesense config-root containment (issue #272)', () => {
  /** Temp layout: parent/.filesrc.json + parent/secret.txt above the sandboxed projectRoot. */
  function makeRootWithParentConfig(): { parent: string; projectRoot: string } {
    const parent = makeRoot();
    writeFileSync(join(parent, '.filesrc.json'), '{}', 'utf-8');
    writeFileSync(join(parent, 'secret.txt'), 'top secret\n', 'utf-8');
    const projectRoot = join(parent, 'app');
    mkdirSync(join(projectRoot, 'src'), { recursive: true });
    writeFileSync(join(projectRoot, 'src', 'main.ts'), 'export const x = 1;\n', 'utf-8');
    return { parent, projectRoot };
  }

  it('check does not adopt a config root above the project root', async () => {
    const { projectRoot } = makeRootWithParentConfig();

    const result = await handleFilesenseTool('filesense_check', { path: '.' }, projectRoot);

    expect(result.success).toBe(true);
    expect((result.data as CheckSummary).root).toBe(realpathSync(projectRoot));
  });

  it('sync from a subdirectory never indexes the parent tree', async () => {
    const { parent, projectRoot } = makeRootWithParentConfig();

    const result = await handleFilesenseTool('filesense_sync', { path: 'src' }, projectRoot);

    expect(result.success).toBe(true);
    expect((result.data as SyncSummary).root).toBe(realpathSync(projectRoot));
    // The parent tree must stay untouched: no FILES.json written above the sandbox.
    expect(existsSync(join(parent, 'FILES.json'))).toBe(false);
  });

  it('navigate does not expose parent-tree entries', async () => {
    const { projectRoot } = makeRootWithParentConfig();

    const result = await handleFilesenseTool('filesense_navigate', { paths: ['.'] }, projectRoot);

    expect(result.success).toBe(true);
    const data = result.data as NavigateResult;
    expect(data.root).toBe(realpathSync(projectRoot));
    expect(data.factsDelta.existingFiles).not.toContain('secret.txt');
    expect(data.factsDelta.existingFiles.some((file) => file.includes('secret'))).toBe(false);
  });
});

describe('mcp-filesense symlink containment', () => {
  /** Temp layout: projectRoot/link → sibling dir outside the sandbox holding leak.txt. */
  function makeRootWithEscapingSymlink(): { outside: string; projectRoot: string } {
    const parent = makeRoot();
    const outside = join(parent, 'outside');
    mkdirSync(outside);
    writeFileSync(join(outside, 'leak.txt'), 'leak\n', 'utf-8');
    writeFileSync(join(outside, '.filesrc.json'), '{}', 'utf-8');
    const projectRoot = join(parent, 'app');
    mkdirSync(projectRoot, { recursive: true });
    writeFileSync(join(projectRoot, 'index.ts'), 'export const x = 1;\n', 'utf-8');
    symlinkSync(outside, join(projectRoot, 'link'));
    return { outside, projectRoot };
  }

  it('rejects an in-root symlink target that escapes the sandbox', async () => {
    const { projectRoot } = makeRootWithEscapingSymlink();

    const result = await handleFilesenseTool('filesense_check', { path: 'link' }, projectRoot);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/outside the boundary/i);
  });

  it('sync via an escaping symlink writes nothing outside the sandbox', async () => {
    const { outside, projectRoot } = makeRootWithEscapingSymlink();

    const result = await handleFilesenseTool('filesense_sync', { path: 'link' }, projectRoot);

    expect(result.success).toBe(false);
    expect(existsSync(join(outside, 'FILES.json'))).toBe(false);
  });

  it('navigate skips escaping symlinks in multi-path requests', async () => {
    const { projectRoot } = makeRootWithEscapingSymlink();

    const result = await handleFilesenseTool(
      'filesense_navigate',
      { paths: ['.', 'link'] },
      projectRoot,
    );

    expect(result.success).toBe(true);
    const data = result.data as NavigateResult;
    expect(data.warnings.some((warning) => warning.includes('outside the allowed root'))).toBe(
      true,
    );
    expect(data.factsDelta.existingFiles.some((file) => file.includes('leak'))).toBe(false);
  });
});
