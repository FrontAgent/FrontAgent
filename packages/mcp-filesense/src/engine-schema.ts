import path from 'node:path';
import type { FilesenseConfig } from './types.js';

type SchemaFileDeps = {
  exists: (targetPath: string) => Promise<boolean>;
  readJson: (targetPath: string) => Promise<unknown>;
  stableStringify: (value: unknown) => string;
  writeJson: (targetPath: string, value: unknown) => Promise<void>;
};

export function schemaPathsForRoot(root: string, config: FilesenseConfig) {
  return {
    indexSchemaPath: path.join(root, config.schemaDir, 'FILES.schema.json'),
    notesSchemaPath: path.join(root, config.schemaDir, 'FILES.notes.schema.json'),
  };
}

export function relativeSchemaRef(dirPath: string, schemaPath: string): string {
  return path.relative(dirPath, schemaPath).replace(/\\/g, '/');
}

export async function ensureSchemaFiles(
  root: string,
  config: FilesenseConfig,
  deps: SchemaFileDeps,
): Promise<void> {
  const paths = schemaPathsForRoot(root, config);
  const indexSchema = buildIndexSchema(config);
  const notesSchema = buildNotesSchema(config);

  const readSafe = async (p: string) => {
    try {
      return await deps.readJson(p);
    } catch {
      return null;
    }
  };

  if (
    !(await deps.exists(paths.indexSchemaPath)) ||
    deps.stableStringify(await readSafe(paths.indexSchemaPath)) !==
      deps.stableStringify(indexSchema)
  ) {
    await deps.writeJson(paths.indexSchemaPath, indexSchema);
  }
  if (
    !(await deps.exists(paths.notesSchemaPath)) ||
    deps.stableStringify(await readSafe(paths.notesSchemaPath)) !==
      deps.stableStringify(notesSchema)
  ) {
    await deps.writeJson(paths.notesSchemaPath, notesSchema);
  }
}

export function buildIndexSchema(config: FilesenseConfig): Record<string, unknown> {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `https://filesense.dev/schema/${config.schemaVersion}/FILES.schema.json`,
    title: 'FILES.json',
    type: 'object',
    required: [
      'schema_version',
      'generated_at',
      'root_relative_path',
      'directory',
      'children',
      'sync',
    ],
    additionalProperties: false,
    properties: {
      $schema: { type: 'string' },
      schema_version: { type: 'string' },
      generated_at: { type: 'string' },
      root_relative_path: { type: 'string' },
      directory: {
        type: 'object',
        required: ['name', 'path'],
        additionalProperties: false,
        properties: { name: { type: 'string' }, path: { type: 'string' } },
      },
      children: {
        type: 'array',
        items: {
          type: 'object',
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
          additionalProperties: false,
          properties: {
            name: { type: 'string' },
            type: { enum: ['file', 'dir'] },
            path: { type: 'string' },
            ext: { type: 'string' },
            size: { type: 'number' },
            mtimeMs: { type: 'number' },
            hash: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            summary: { type: 'string' },
            importance: { enum: ['high', 'normal'] },
            status: { enum: ['active'] },
          },
        },
      },
      sync: {
        type: 'object',
        required: [
          'child_count',
          'file_count',
          'dir_count',
          'last_full_sync',
          'last_incremental_sync',
        ],
        additionalProperties: false,
        properties: {
          child_count: { type: 'number' },
          file_count: { type: 'number' },
          dir_count: { type: 'number' },
          last_full_sync: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          last_incremental_sync: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        },
      },
    },
  };
}

export function buildNotesSchema(config: FilesenseConfig): Record<string, unknown> {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `https://filesense.dev/schema/${config.schemaVersion}/FILES.notes.schema.json`,
    title: 'FILES.notes.json',
    type: 'object',
    additionalProperties: false,
    properties: {
      $schema: { type: 'string' },
      directory_purpose: { type: 'string' },
      agent_hints: { type: 'array', items: { type: 'string' } },
      conventions: { type: 'array', items: { type: 'string' } },
      key_entrypoints: { type: 'array', items: { type: 'string' } },
    },
  };
}
