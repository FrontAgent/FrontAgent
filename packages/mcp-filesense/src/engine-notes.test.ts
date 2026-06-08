import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildNotesFile, inferConventions, inferKeyEntrypoints } from './engine-notes.js';
import type { FilesenseConfig, IndexFile, NotesFile } from './types.js';

const config: FilesenseConfig = {
  schemaVersion: '1.0',
  root: '.',
  recursive: true,
  indexFile: 'FILES.json',
  notesFile: 'FILES.notes.json',
  ignoreFile: '.filesignore',
  schemaDir: 'schemas',
  exclude: ['.git', 'node_modules'],
  hashAlgorithm: 'sha1',
};

function createIndex(children: IndexFile['children']): IndexFile {
  return {
    schema_version: '1.0',
    generated_at: '2026-06-08T00:00:00.000Z',
    root_relative_path: 'components',
    directory: {
      name: 'components',
      path: 'components',
    },
    children,
    sync: {
      child_count: children.length,
      file_count: children.filter((child) => child.type === 'file').length,
      dir_count: children.filter((child) => child.type === 'dir').length,
      last_full_sync: null,
      last_incremental_sync: null,
    },
  };
}

describe('engine notes helpers', () => {
  it('builds the same notes shape used by summarize', () => {
    const root = path.join('/workspace', 'project');
    const dirPath = path.join(root, 'components');
    const index = createIndex([
      {
        name: 'Button.tsx',
        type: 'file',
        path: 'components/Button.tsx',
        ext: '.tsx',
        size: 42,
        mtimeMs: 1,
        hash: 'sha1:button',
        summary: 'TypeScript source file',
        importance: 'normal',
        status: 'active',
      },
      {
        name: 'index.ts',
        type: 'file',
        path: 'components/index.ts',
        ext: '.ts',
        size: 12,
        mtimeMs: 1,
        hash: 'sha1:index',
        summary: 'TypeScript source file',
        importance: 'high',
        status: 'active',
      },
    ]);

    const notes = buildNotesFile(root, dirPath, config, index, null, false);

    expect(notes).toEqual({
      $schema: '../schemas/FILES.notes.schema.json',
      directory_purpose: 'Reusable component directory.',
      agent_hints: ['Read index.ts first for local entrypoints and conventions.'],
      conventions: [
        'Prefer TypeScript for new source files in this directory.',
        'Component-like files use PascalCase filenames.',
      ],
      key_entrypoints: ['index.ts'],
    });
  });

  it('preserves populated previous fields unless forced', () => {
    const root = path.join('/workspace', 'project');
    const dirPath = path.join(root, 'components');
    const index = createIndex([]);
    const previous: NotesFile = {
      $schema: 'old-schema',
      directory_purpose: 'Human-authored purpose.',
      agent_hints: ['Human hint.'],
      conventions: ['Human convention.'],
      key_entrypoints: ['Human.ts'],
    };

    expect(buildNotesFile(root, dirPath, config, index, previous, false)).toEqual({
      $schema: '../schemas/FILES.notes.schema.json',
      directory_purpose: 'Human-authored purpose.',
      agent_hints: ['Human hint.'],
      conventions: ['Human convention.'],
      key_entrypoints: ['Human.ts'],
    });

    expect(buildNotesFile(root, dirPath, config, index, previous, true)).toEqual({
      $schema: '../schemas/FILES.notes.schema.json',
      directory_purpose: 'Reusable component directory.',
      agent_hints: [
        'Start from high-importance files before editing lower-level implementation details.',
      ],
      conventions: ['Preserve the local naming and file-placement patterns already present here.'],
      key_entrypoints: [],
    });
  });

  it('exposes convention and entrypoint inference for navigate reuse', () => {
    const index = createIndex([
      {
        name: 'README.md',
        type: 'file',
        path: 'components/README.md',
        ext: '.md',
        size: 12,
        mtimeMs: 1,
        hash: 'sha1:readme',
        summary: 'Markdown document',
        importance: 'high',
        status: 'active',
      },
      {
        name: 'Button.test.tsx',
        type: 'file',
        path: 'components/Button.test.tsx',
        ext: '.tsx',
        size: 12,
        mtimeMs: 1,
        hash: 'sha1:test',
        summary: 'TypeScript source file',
        importance: 'normal',
        status: 'active',
      },
    ]);

    expect(inferKeyEntrypoints(index)).toEqual(['README.md']);
    expect(inferConventions(index)).toEqual([
      'Prefer TypeScript for new source files in this directory.',
      'Component-like files use PascalCase filenames.',
      'Keep tests close to the implementation they validate.',
      'Update README.md when directory-level usage or setup changes.',
    ]);
  });
});
