import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { init, syncIndexes, summarize, query, check, syncAndSummarize, navigate } from './engine.js';

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
    const configExists = await fs.access(path.join(TEST_DIR, '.filesrc.json')).then(() => true).catch(() => false);
    expect(configExists).toBe(true);

    // Index file created
    const indexExists = await fs.access(path.join(TEST_DIR, 'FILES.json')).then(() => true).catch(() => false);
    expect(indexExists).toBe(true);
  });

  it('sync detects files and directories', async () => {
    await fs.writeFile(path.join(TEST_DIR, '.filesrc.json'), JSON.stringify({ schemaVersion: '1.0', root: '.', recursive: true, indexFile: 'FILES.json', notesFile: 'FILES.notes.json', ignoreFile: '.filesignore', schemaDir: 'schemas', exclude: ['.git', 'node_modules'], hashAlgorithm: 'sha1' }));
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
    await fs.writeFile(path.join(TEST_DIR, 'components', 'Button.tsx'), 'export const Button = () => <button/>;');
    await syncIndexes(TEST_DIR);

    const result = await summarize(TEST_DIR);
    expect(result.notesWritten).toBeGreaterThanOrEqual(1);

    const notes = JSON.parse(await fs.readFile(path.join(TEST_DIR, 'components', 'FILES.notes.json'), 'utf8'));
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
    await fs.writeFile(path.join(TEST_DIR, 'utils.ts'), 'export function add(a: number, b: number) { return a + b; }');

    const result = await syncAndSummarize(TEST_DIR);
    expect(result.sync.directoriesScanned).toBeGreaterThanOrEqual(1);
    expect(result.summarize.directoriesScanned).toBeGreaterThanOrEqual(1);
  });

  it('incremental sync skips unchanged files', async () => {
    await fs.writeFile(path.join(TEST_DIR, '.filesrc.json'), JSON.stringify({ schemaVersion: '1.0', root: '.', recursive: true, indexFile: 'FILES.json', notesFile: 'FILES.notes.json', ignoreFile: '.filesignore', schemaDir: 'schemas', exclude: ['.git', 'node_modules'], hashAlgorithm: 'sha1' }));
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

    const result = await navigate(TEST_DIR, { paths: ['.'], depth: 1, maxEntries: 20, output: 'summary' });
    expect(result.summary.packageManager).toBe('node');
    expect(result.summary.mainEntrypoints).toContain('package.json');
    expect(result.candidates.some(candidate => candidate.path === 'src')).toBe(true);
    expect(result.factsDelta.existingDirectories).toContain('src');

    const indexExists = await fs.access(path.join(TEST_DIR, 'FILES.json')).then(() => true).catch(() => false);
    expect(indexExists).toBe(false);
  });
});
