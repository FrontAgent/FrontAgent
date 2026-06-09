import { promises as fs } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildIndexSchema,
  buildNotesSchema,
  ensureSchemaFiles,
  relativeSchemaRef,
  schemaPathsForRoot,
} from './engine-schema.js';
import type { FilesenseConfig } from './types.js';

const TEST_DIR = path.join(import.meta.dirname, '..', '.test-schema-workspace');

const config: FilesenseConfig = {
  schemaVersion: '1.0',
  root: '.',
  recursive: true,
  indexFile: 'FILES.json',
  notesFile: 'FILES.notes.json',
  ignoreFile: '.filesignore',
  schemaDir: 'custom-schemas',
  exclude: ['.git', 'node_modules'],
  hashAlgorithm: 'sha1',
};

async function ensureClean() {
  await fs.rm(TEST_DIR, { recursive: true, force: true });
  await fs.mkdir(TEST_DIR, { recursive: true });
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(targetPath: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(targetPath, 'utf8')) as unknown;
}

async function writeJson(targetPath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}

describe('schema orchestration helpers', () => {
  beforeEach(ensureClean);
  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('resolves generated schema paths and relative refs from nested directories', () => {
    const paths = schemaPathsForRoot(TEST_DIR, config);
    expect(paths.indexSchemaPath).toBe(path.join(TEST_DIR, 'custom-schemas', 'FILES.schema.json'));
    expect(paths.notesSchemaPath).toBe(
      path.join(TEST_DIR, 'custom-schemas', 'FILES.notes.schema.json'),
    );

    expect(relativeSchemaRef(TEST_DIR, paths.indexSchemaPath)).toBe(
      'custom-schemas/FILES.schema.json',
    );
    expect(relativeSchemaRef(path.join(TEST_DIR, 'src'), paths.indexSchemaPath)).toBe(
      '../custom-schemas/FILES.schema.json',
    );
    expect(relativeSchemaRef(TEST_DIR, paths.notesSchemaPath)).toBe(
      'custom-schemas/FILES.notes.schema.json',
    );
  });

  it('builds the expected FILES schema contract', () => {
    const schema = buildIndexSchema(config);

    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$id).toBe('https://filesense.dev/schema/1.0/FILES.schema.json');
    expect(schema.title).toBe('FILES.json');
    expect(schema.required).toEqual([
      'schema_version',
      'generated_at',
      'root_relative_path',
      'directory',
      'children',
      'sync',
    ]);
    expect(schema.properties).toMatchObject({
      schema_version: { type: 'string' },
      children: {
        type: 'array',
        items: {
          required: [
            'name',
            'type',
            'path',
            'ext',
            'size',
            'mtimeMs',
            'hash',
            'summary',
            'importance',
            'status',
          ],
        },
      },
      sync: {
        required: [
          'child_count',
          'file_count',
          'dir_count',
          'last_full_sync',
          'last_incremental_sync',
        ],
      },
    });
  });

  it('builds the expected FILES notes schema contract', () => {
    const schema = buildNotesSchema(config);

    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$id).toBe('https://filesense.dev/schema/1.0/FILES.notes.schema.json');
    expect(schema.title).toBe('FILES.notes.json');
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties).toMatchObject({
      $schema: { type: 'string' },
      directory_purpose: { type: 'string' },
      agent_hints: { type: 'array', items: { type: 'string' } },
      conventions: { type: 'array', items: { type: 'string' } },
      key_entrypoints: { type: 'array', items: { type: 'string' } },
    });
  });

  it('writes generated schema files without rewriting unchanged contents', async () => {
    const paths = schemaPathsForRoot(TEST_DIR, config);
    const deps = { exists, readJson, writeJson, stableStringify };

    await ensureSchemaFiles(TEST_DIR, config, deps);
    const firstIndexSchema = await fs.readFile(paths.indexSchemaPath, 'utf8');
    const firstNotesSchema = await fs.readFile(paths.notesSchemaPath, 'utf8');
    const firstIndexMtime = (await fs.stat(paths.indexSchemaPath)).mtimeMs;
    const firstNotesMtime = (await fs.stat(paths.notesSchemaPath)).mtimeMs;

    await ensureSchemaFiles(TEST_DIR, config, deps);

    expect(await fs.readFile(paths.indexSchemaPath, 'utf8')).toBe(firstIndexSchema);
    expect(await fs.readFile(paths.notesSchemaPath, 'utf8')).toBe(firstNotesSchema);
    expect((await fs.stat(paths.indexSchemaPath)).mtimeMs).toBe(firstIndexMtime);
    expect((await fs.stat(paths.notesSchemaPath)).mtimeMs).toBe(firstNotesMtime);
  });
});
