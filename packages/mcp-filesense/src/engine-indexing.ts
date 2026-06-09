import type { ChildEntry, IndexFile } from './types.js';

export interface ComparableIndex {
  $schema?: string;
  schema_version: string;
  root_relative_path: string;
  directory: { name: string; path: string };
  children: ChildEntry[];
  sync: { child_count: number; file_count: number; dir_count: number };
}

export interface PersistDirectoryIndexOptions {
  indexPath: string;
  previous: IndexFile | null;
  nextComparable: ComparableIndex;
  forceFull: boolean;
  filesHashed: number;
  stableStringify: (value: unknown) => string;
  writeJson: (targetPath: string, value: unknown) => Promise<void>;
  now?: () => string;
}

function comparableIndex(index: IndexFile): ComparableIndex {
  return {
    $schema: index.$schema,
    schema_version: index.schema_version,
    root_relative_path: index.root_relative_path,
    directory: index.directory,
    children: index.children,
    sync: {
      child_count: index.sync.child_count,
      file_count: index.sync.file_count,
      dir_count: index.sync.dir_count,
    },
  };
}

export async function persistDirectoryIndex({
  indexPath,
  previous,
  nextComparable,
  forceFull,
  filesHashed,
  stableStringify,
  writeJson,
  now = () => new Date().toISOString(),
}: PersistDirectoryIndexOptions): Promise<{ filesHashed: number; wroteIndex: boolean }> {
  const previousComparable = previous ? comparableIndex(previous) : null;

  if (
    previousComparable &&
    stableStringify(previousComparable) === stableStringify(nextComparable)
  ) {
    return { filesHashed, wroteIndex: false };
  }

  const timestamp = now();
  const nextIndex: IndexFile = {
    $schema: nextComparable.$schema,
    schema_version: nextComparable.schema_version,
    generated_at: timestamp,
    root_relative_path: nextComparable.root_relative_path,
    directory: nextComparable.directory,
    children: nextComparable.children,
    sync: {
      ...nextComparable.sync,
      last_full_sync: forceFull ? timestamp : (previous?.sync.last_full_sync ?? null),
      last_incremental_sync: timestamp,
    },
  };

  await writeJson(indexPath, nextIndex);
  return { filesHashed, wroteIndex: true };
}
