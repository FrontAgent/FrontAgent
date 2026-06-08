import { describe, expect, it } from 'vitest';
import { persistDirectoryIndex } from './engine-indexing.js';
import type { IndexFile } from './types.js';

function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}

describe('persistDirectoryIndex', () => {
  const previous: IndexFile = {
    $schema: '../schemas/FILES.schema.json',
    schema_version: '1.0',
    generated_at: '2026-06-08T00:00:00.000Z',
    root_relative_path: '.',
    directory: { name: 'workspace', path: '.' },
    children: [],
    sync: {
      child_count: 0,
      file_count: 0,
      dir_count: 0,
      last_full_sync: '2026-06-08T00:00:00.000Z',
      last_incremental_sync: '2026-06-08T00:00:00.000Z',
    },
  };

  it('skips writing when the comparable index is unchanged', async () => {
    const writes: Array<{ targetPath: string; value: unknown }> = [];

    const result = await persistDirectoryIndex({
      indexPath: '/workspace/FILES.json',
      previous,
      nextComparable: {
        $schema: previous.$schema,
        schema_version: previous.schema_version,
        root_relative_path: previous.root_relative_path,
        directory: previous.directory,
        children: previous.children,
        sync: {
          child_count: previous.sync.child_count,
          file_count: previous.sync.file_count,
          dir_count: previous.sync.dir_count,
        },
      },
      forceFull: false,
      filesHashed: 0,
      stableStringify,
      writeJson: async (targetPath, value) => {
        writes.push({ targetPath, value });
      },
      now: () => '2026-06-08T01:00:00.000Z',
    });

    expect(result).toEqual({ filesHashed: 0, wroteIndex: false });
    expect(writes).toHaveLength(0);
  });

  it('writes a full index and preserves previous full sync during incremental sync', async () => {
    const writes: Array<{ targetPath: string; value: IndexFile }> = [];

    const result = await persistDirectoryIndex({
      indexPath: '/workspace/FILES.json',
      previous,
      nextComparable: {
        $schema: previous.$schema,
        schema_version: previous.schema_version,
        root_relative_path: previous.root_relative_path,
        directory: previous.directory,
        children: [
          {
            name: 'app.ts',
            type: 'file',
            path: 'app.ts',
            ext: '.ts',
            size: 18,
            mtimeMs: 10,
            hash: 'sha1:abc',
            summary: 'TypeScript source file',
            importance: 'normal',
            status: 'active',
          },
        ],
        sync: {
          child_count: 1,
          file_count: 1,
          dir_count: 0,
        },
      },
      forceFull: false,
      filesHashed: 1,
      stableStringify,
      writeJson: async (targetPath, value) => {
        writes.push({ targetPath, value: value as IndexFile });
      },
      now: () => '2026-06-08T01:00:00.000Z',
    });

    expect(result).toEqual({ filesHashed: 1, wroteIndex: true });
    expect(writes).toHaveLength(1);
    expect(writes[0]).toEqual({
      targetPath: '/workspace/FILES.json',
      value: {
        $schema: previous.$schema,
        schema_version: previous.schema_version,
        generated_at: '2026-06-08T01:00:00.000Z',
        root_relative_path: previous.root_relative_path,
        directory: previous.directory,
        children: [
          {
            name: 'app.ts',
            type: 'file',
            path: 'app.ts',
            ext: '.ts',
            size: 18,
            mtimeMs: 10,
            hash: 'sha1:abc',
            summary: 'TypeScript source file',
            importance: 'normal',
            status: 'active',
          },
        ],
        sync: {
          child_count: 1,
          file_count: 1,
          dir_count: 0,
          last_full_sync: '2026-06-08T00:00:00.000Z',
          last_incremental_sync: '2026-06-08T01:00:00.000Z',
        },
      },
    });
  });

  it('sets full and incremental sync timestamps on forced first writes', async () => {
    const writes: IndexFile[] = [];

    const result = await persistDirectoryIndex({
      indexPath: '/workspace/FILES.json',
      previous: null,
      nextComparable: {
        $schema: previous.$schema,
        schema_version: previous.schema_version,
        root_relative_path: previous.root_relative_path,
        directory: previous.directory,
        children: [],
        sync: {
          child_count: 0,
          file_count: 0,
          dir_count: 0,
        },
      },
      forceFull: true,
      filesHashed: 0,
      stableStringify,
      writeJson: async (_targetPath, value) => {
        writes.push(value as IndexFile);
      },
      now: () => '2026-06-08T02:00:00.000Z',
    });

    expect(result).toEqual({ filesHashed: 0, wroteIndex: true });
    expect(writes[0]?.sync).toEqual({
      child_count: 0,
      file_count: 0,
      dir_count: 0,
      last_full_sync: '2026-06-08T02:00:00.000Z',
      last_incremental_sync: '2026-06-08T02:00:00.000Z',
    });
  });
});
