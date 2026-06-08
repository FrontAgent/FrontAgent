import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildQueryResult } from './engine-query.js';
import type { IndexFile, NotesFile } from './types.js';

const index: IndexFile = {
  schema_version: '1.0',
  generated_at: '2026-06-08T00:00:00.000Z',
  root_relative_path: '.',
  directory: { name: 'workspace', path: '.' },
  children: [],
  sync: {
    child_count: 0,
    file_count: 0,
    dir_count: 0,
    last_full_sync: null,
    last_incremental_sync: null,
  },
};

const notes: NotesFile = {
  directory_purpose: 'Project root directory containing source code.',
};

describe('engine query helpers', () => {
  it('builds root query results with dot rootRelativePath', () => {
    const result = buildQueryResult({
      root: '/repo',
      target: '/repo',
      index,
      notes,
    });

    expect(result).toEqual({
      root: '/repo',
      target: '/repo',
      rootRelativePath: '.',
      index,
      notes,
    });
  });

  it('builds nested query results with native path.relative semantics', () => {
    const result = buildQueryResult({
      root: '/repo',
      target: '/repo/src\\components',
      index,
      notes: null,
    });

    expect(result.rootRelativePath).toBe(path.relative('/repo', '/repo/src\\components'));
    expect(result.notes).toBeNull();
  });
});
