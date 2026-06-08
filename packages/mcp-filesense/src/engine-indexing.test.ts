import { describe, expect, it } from 'vitest';
import { persistDirectoryIndex } from './engine-indexing.js';
import type { IndexFile } from './types.js';

describe('persistDirectoryIndex', () => {
  it('skips writing when the comparable index is unchanged', async () => {
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
      writeJson: async (targetPath, value) => {
        writes.push({ targetPath, value });
      },
      now: () => '2026-06-08T01:00:00.000Z',
    });

    expect(result).toEqual({ filesHashed: 0, wroteIndex: false });
    expect(writes).toHaveLength(0);
  });
});
