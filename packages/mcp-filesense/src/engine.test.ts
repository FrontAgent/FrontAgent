import { promises as fs } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  check,
  findConfigRoot,
  init,
  loadConfig,
  loadIgnoreMatcher,
  navigate,
  query,
  summarize,
  syncAndSummarize,
  syncIndexes,
} from './engine.js';
import type { FilesenseConfig } from './types.js';

const TEST_DIR = path.join(import.meta.dirname, '..', '.test-workspace');

async function ensureClean() {
  await fs.rm(TEST_DIR, { recursive: true, force: true });
  await fs.mkdir(TEST_DIR, { recursive: true });
}

describe('Filesense Engine', () => {
  beforeEach(ensureClean);
  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('init creates config, ignore, schemas, and index', async () => {
    await fs.writeFile(path.join(TEST_DIR, 'index.ts'), 'export const x = 1;\n');
    await fs.mkdir(path.join(TEST_DIR, 'src'));
    await fs.writeFile(path.join(TEST_DIR, 'src', 'main.ts'), 'console.log("hi");\n');

    const result = await init(TEST_DIR);
    expect(result.directoriesScanned).toBe(2);
    expect(result.indexesWritten).toBeGreaterThanOrEqual(1);

    // Config file created
    const configExists = await fs
      .access(path.join(TEST_DIR, '.filesrc.json'))
      .then(() => true)
      .catch(() => false);
    expect(configExists).toBe(true);

    // Index file created
    const indexExists = await fs
      .access(path.join(TEST_DIR, 'FILES.json'))
      .then(() => true)
      .catch(() => false);
    expect(indexExists).toBe(true);
  });

  it('sync detects files and directories', async () => {
    await fs.writeFile(
      path.join(TEST_DIR, '.filesrc.json'),
      JSON.stringify({
        schemaVersion: '1.0',
        root: '.',
        recursive: true,
        indexFile: 'FILES.json',
        notesFile: 'FILES.notes.json',
        ignoreFile: '.filesignore',
        schemaDir: 'schemas',
        exclude: ['.git', 'node_modules'],
        hashAlgorithm: 'sha1',
      }),
    );
    await fs.writeFile(path.join(TEST_DIR, 'app.tsx'), '<div>Hello</div>');
    await fs.writeFile(path.join(TEST_DIR, 'package.json'), '{}');

    const result = await syncIndexes(TEST_DIR);
    expect(result.directoriesScanned).toBe(1);
    expect(result.filesHashed).toBeGreaterThanOrEqual(2);

    const index = JSON.parse(await fs.readFile(path.join(TEST_DIR, 'FILES.json'), 'utf8'));
    const names = index.children.map((c: { name: string }) => c.name);
    expect(names).toContain('app.tsx');
    expect(names).toContain('package.json');
  });

  it('summarize generates notes with directory purpose', async () => {
    await init(TEST_DIR);
    await fs.mkdir(path.join(TEST_DIR, 'components'));
    await fs.writeFile(
      path.join(TEST_DIR, 'components', 'Button.tsx'),
      'export const Button = () => <button/>;',
    );
    await syncIndexes(TEST_DIR);

    const result = await summarize(TEST_DIR);
    expect(result.notesWritten).toBeGreaterThanOrEqual(1);

    const notes = JSON.parse(
      await fs.readFile(path.join(TEST_DIR, 'components', 'FILES.notes.json'), 'utf8'),
    );
    expect(notes.directory_purpose).toContain('component');
  });

  it('query returns index and notes', async () => {
    await fs.writeFile(path.join(TEST_DIR, 'README.md'), '# Test');
    await init(TEST_DIR);
    await summarize(TEST_DIR);

    const result = await query(TEST_DIR);
    expect(result.index.children.length).toBeGreaterThan(0);
    expect(result.notes).not.toBeNull();
    expect(result.notes?.directory_purpose).toBeDefined();
  });

  it('check reports missing indexes', async () => {
    await init(TEST_DIR);
    await fs.mkdir(path.join(TEST_DIR, 'newdir'));
    await fs.writeFile(path.join(TEST_DIR, 'newdir', 'file.ts'), 'const x = 1;');

    // Don't sync newdir - it should be reported as missing
    const result = await check(TEST_DIR);
    expect(result.checkedDirectories).toBeGreaterThanOrEqual(1);
    // newdir won't have an index since we didn't sync after creating it
    expect(result.missingIndexes.length).toBeGreaterThanOrEqual(1);
  });

  it('syncAndSummarize does both in one call', async () => {
    await init(TEST_DIR);
    await fs.writeFile(
      path.join(TEST_DIR, 'utils.ts'),
      'export function add(a: number, b: number) { return a + b; }',
    );

    const result = await syncAndSummarize(TEST_DIR);
    expect(result.sync.directoriesScanned).toBeGreaterThanOrEqual(1);
    expect(result.summarize.directoriesScanned).toBeGreaterThanOrEqual(1);
  });

  it('incremental sync skips unchanged files', async () => {
    await fs.writeFile(
      path.join(TEST_DIR, '.filesrc.json'),
      JSON.stringify({
        schemaVersion: '1.0',
        root: '.',
        recursive: true,
        indexFile: 'FILES.json',
        notesFile: 'FILES.notes.json',
        ignoreFile: '.filesignore',
        schemaDir: 'schemas',
        exclude: ['.git', 'node_modules'],
        hashAlgorithm: 'sha1',
      }),
    );
    await fs.writeFile(path.join(TEST_DIR, 'stable.ts'), 'const x = 1;');

    const first = await syncIndexes(TEST_DIR);
    expect(first.filesHashed).toBeGreaterThanOrEqual(1);

    // Second sync without changes should hash 0 files
    const second = await syncIndexes(TEST_DIR);
    expect(second.filesHashed).toBe(0);
    expect(second.indexesWritten).toBe(0);
  });

  it('navigate returns compact summary without writing workspace indexes', async () => {
    await fs.writeFile(path.join(TEST_DIR, 'package.json'), '{"scripts":{"dev":"vite"}}');
    await fs.mkdir(path.join(TEST_DIR, 'src'));
    await fs.writeFile(path.join(TEST_DIR, 'src', 'main.tsx'), 'export const main = 1;');

    const result = await navigate(TEST_DIR, {
      paths: ['.'],
      depth: 1,
      maxEntries: 20,
      output: 'summary',
    });
    expect(result.summary.packageManager).toBe('node');
    expect(result.summary.mainEntrypoints).toContain('package.json');
    expect(result.candidates.some((candidate) => candidate.path === 'src')).toBe(true);
    expect(result.factsDelta.existingDirectories).toContain('src');

    const indexExists = await fs
      .access(path.join(TEST_DIR, 'FILES.json'))
      .then(() => true)
      .catch(() => false);
    expect(indexExists).toBe(false);
  });
});

describe('loadConfig', () => {
  beforeEach(ensureClean);
  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('returns default config when no .filesrc.json exists', async () => {
    const config = await loadConfig(TEST_DIR);
    expect(config.schemaVersion).toBe('1.0');
    expect(config.indexFile).toBe('FILES.json');
    expect(config.recursive).toBe(true);
    expect(config.exclude).toContain('node_modules');
  });

  it('merges custom config with defaults', async () => {
    await fs.writeFile(
      path.join(TEST_DIR, '.filesrc.json'),
      JSON.stringify({ recursive: false, exclude: ['dist', '.cache'] }),
    );
    const config = await loadConfig(TEST_DIR);
    expect(config.recursive).toBe(false);
    expect(config.exclude).toEqual(['dist', '.cache']);
    expect(config.indexFile).toBe('FILES.json');
  });
});

describe('findConfigRoot', () => {
  beforeEach(ensureClean);
  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('returns directory containing .filesrc.json', async () => {
    await fs.writeFile(path.join(TEST_DIR, '.filesrc.json'), '{}');
    await fs.mkdir(path.join(TEST_DIR, 'sub', 'deep'), { recursive: true });

    const root = await findConfigRoot(path.join(TEST_DIR, 'sub', 'deep'));
    expect(root).toBe(TEST_DIR);
  });

  it('returns start directory when no config found', async () => {
    await fs.mkdir(path.join(TEST_DIR, 'orphan'), { recursive: true });
    const root = await findConfigRoot(path.join(TEST_DIR, 'orphan'));
    expect(root).toBe(path.join(TEST_DIR, 'orphan'));
  });

  it('handles file path by using its parent directory', async () => {
    await fs.writeFile(path.join(TEST_DIR, '.filesrc.json'), '{}');
    await fs.writeFile(path.join(TEST_DIR, 'file.ts'), 'const x = 1;');
    const root = await findConfigRoot(path.join(TEST_DIR, 'file.ts'));
    expect(root).toBe(TEST_DIR);
  });
});

describe('loadIgnoreMatcher', () => {
  beforeEach(ensureClean);
  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  const baseConfig: FilesenseConfig = {
    schemaVersion: '1.0',
    root: '.',
    recursive: true,
    indexFile: 'FILES.json',
    notesFile: 'FILES.notes.json',
    ignoreFile: '.filesignore',
    schemaDir: 'schemas',
    exclude: ['node_modules', '.git'],
    hashAlgorithm: 'sha1',
  };

  it('matches patterns from config.exclude', async () => {
    const matcher = await loadIgnoreMatcher(TEST_DIR, baseConfig);
    expect(matcher('node_modules', true)).toBe(true);
    expect(matcher('.git', true)).toBe(true);
    expect(matcher('src', true)).toBe(false);
  });

  it('loads additional patterns from .filesignore file', async () => {
    await fs.writeFile(path.join(TEST_DIR, '.filesignore'), 'dist\n# comment\n\n*.log\n');
    const matcher = await loadIgnoreMatcher(TEST_DIR, baseConfig);
    expect(matcher('dist', true)).toBe(true);
    expect(matcher('app.log', false)).toBe(false); // *.log is not a segment match
    expect(matcher('src', true)).toBe(false);
  });

  it('handles directory-trailing-slash patterns', async () => {
    await fs.writeFile(path.join(TEST_DIR, '.filesignore'), 'build/\n');
    const matcher = await loadIgnoreMatcher(TEST_DIR, baseConfig);
    expect(matcher('build', true)).toBe(true);
    expect(matcher('build/output.js', false)).toBe(true);
  });

  it('handles path patterns with slashes', async () => {
    await fs.writeFile(path.join(TEST_DIR, '.filesignore'), 'src/generated\n');
    const matcher = await loadIgnoreMatcher(TEST_DIR, baseConfig);
    expect(matcher('src/generated', true)).toBe(true);
    expect(matcher('src/generated/types.ts', false)).toBe(true);
    expect(matcher('other/generated', true)).toBe(false);
  });

  it('returns false for everything when no patterns match', async () => {
    const emptyConfig = { ...baseConfig, exclude: [] };
    const matcher = await loadIgnoreMatcher(TEST_DIR, emptyConfig);
    expect(matcher('anything', false)).toBe(false);
    expect(matcher('any/path', true)).toBe(false);
  });
});

describe('Edge cases', () => {
  beforeEach(ensureClean);
  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('sync handles empty directory', async () => {
    await fs.writeFile(
      path.join(TEST_DIR, '.filesrc.json'),
      JSON.stringify({
        schemaVersion: '1.0',
        root: '.',
        recursive: true,
        indexFile: 'FILES.json',
        notesFile: 'FILES.notes.json',
        ignoreFile: '.filesignore',
        schemaDir: 'schemas',
        exclude: ['.git', 'node_modules'],
        hashAlgorithm: 'sha1',
      }),
    );
    await fs.mkdir(path.join(TEST_DIR, 'empty'));

    const result = await syncIndexes(TEST_DIR);
    expect(result.directoriesScanned).toBeGreaterThanOrEqual(1);

    const index = JSON.parse(await fs.readFile(path.join(TEST_DIR, 'FILES.json'), 'utf8'));
    const emptyDir = index.children.find((c: { name: string }) => c.name === 'empty');
    expect(emptyDir).toBeDefined();
    expect(emptyDir.type).toBe('dir');
  });

  it('sync excludes configured patterns', async () => {
    await fs.writeFile(
      path.join(TEST_DIR, '.filesrc.json'),
      JSON.stringify({
        schemaVersion: '1.0',
        root: '.',
        recursive: true,
        indexFile: 'FILES.json',
        notesFile: 'FILES.notes.json',
        ignoreFile: '.filesignore',
        schemaDir: 'schemas',
        exclude: ['.git', 'node_modules', 'dist'],
        hashAlgorithm: 'sha1',
      }),
    );
    await fs.mkdir(path.join(TEST_DIR, 'dist'));
    await fs.writeFile(path.join(TEST_DIR, 'dist', 'bundle.js'), 'var x=1;');
    await fs.writeFile(path.join(TEST_DIR, 'src.ts'), 'const x = 1;');

    const result = await syncIndexes(TEST_DIR);
    const index = JSON.parse(await fs.readFile(path.join(TEST_DIR, 'FILES.json'), 'utf8'));
    const names = index.children.map((c: { name: string }) => c.name);
    expect(names).not.toContain('dist');
    expect(names).toContain('src.ts');
    expect(result.directoriesScanned).toBeGreaterThanOrEqual(1);
  });

  it('navigate with depth 0 returns only top-level entries', async () => {
    await fs.writeFile(path.join(TEST_DIR, 'root.ts'), 'export const r = 1;');
    await fs.mkdir(path.join(TEST_DIR, 'deep'));
    await fs.writeFile(path.join(TEST_DIR, 'deep', 'nested.ts'), 'export const n = 1;');

    const result = await navigate(TEST_DIR, {
      paths: ['.'],
      depth: 0,
      maxEntries: 50,
      output: 'summary',
    });
    const paths = result.candidates.map((c) => c.path);
    expect(paths).toContain('root.ts');
    expect(paths).toContain('deep');
    expect(paths).not.toContain('deep/nested.ts');
  });

  it('navigate respects maxEntries limit with many directories', async () => {
    for (let i = 0; i < 5; i++) {
      const dir = path.join(TEST_DIR, `dir${i}`);
      await fs.mkdir(dir);
      await fs.writeFile(path.join(dir, 'index.ts'), `export const x${i} = ${i};`);
    }

    const result = await navigate(TEST_DIR, {
      paths: ['.'],
      depth: 2,
      maxEntries: 2,
      output: 'summary',
    });
    expect(result.scanned.truncated).toBe(true);
  });

  it('check reports no issues on fully synced workspace', async () => {
    await init(TEST_DIR);
    await syncIndexes(TEST_DIR);
    const result = await check(TEST_DIR);
    expect(result.missingIndexes).toHaveLength(0);
    expect(result.staleIndexes).toHaveLength(0);
  });

  it('check detects stale indexes after adding a new file', async () => {
    await fs.writeFile(path.join(TEST_DIR, 'app.ts'), 'const v1 = 1;');
    await init(TEST_DIR);
    await syncIndexes(TEST_DIR);

    await fs.writeFile(path.join(TEST_DIR, 'newfile.ts'), 'const v2 = 2;');
    const result = await check(TEST_DIR);
    expect(result.staleIndexes.length).toBeGreaterThanOrEqual(1);
  });
});
