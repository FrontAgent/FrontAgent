import { describe, expect, it } from 'vitest';
import { inferDirectoryPurpose, inferImportance, scoreCandidate } from './engine-helpers.js';
import type { ChildEntry, IndexFile, NavigateOptions } from './types.js';

function child(overrides: Partial<ChildEntry> & Pick<ChildEntry, 'name'>): ChildEntry {
  return {
    name: overrides.name,
    type: overrides.type ?? 'file',
    path: overrides.path ?? overrides.name,
    ext: overrides.ext ?? '',
    size: overrides.size ?? 0,
    mtimeMs: overrides.mtimeMs ?? 0,
    hash: overrides.hash ?? null,
    summary: overrides.summary ?? 'File',
    importance: overrides.importance ?? 'normal',
    status: overrides.status ?? 'active',
  };
}

function index(name: string, children: ChildEntry[], directoryPath = name): IndexFile {
  return {
    schema_version: '1.0',
    generated_at: '2026-06-08T00:00:00.000Z',
    root_relative_path: directoryPath,
    directory: { name, path: directoryPath },
    children,
    sync: {
      child_count: children.length,
      file_count: children.filter((entry) => entry.type === 'file').length,
      dir_count: children.filter((entry) => entry.type === 'dir').length,
      last_full_sync: null,
      last_incremental_sync: null,
    },
  };
}

describe('engine helper inference', () => {
  it('marks entrypoint and config-like files as high importance', () => {
    expect(inferImportance('README.md')).toBe('high');
    expect(inferImportance('package.json')).toBe('high');
    expect(inferImportance('vite.config.ts')).toBe('high');
    expect(inferImportance('feature.ts')).toBe('normal');
  });

  it('infers directory purpose from known directory names and root path', () => {
    expect(inferDirectoryPurpose(index('project', [], '.'))).toContain('Project root');
    expect(inferDirectoryPurpose(index('src', []))).toBe('Primary application source directory.');
    expect(inferDirectoryPurpose(index('components', []))).toContain('component');
    expect(inferDirectoryPurpose(index('__tests__', []))).toBe('Automated test directory.');
  });

  it('infers directory purpose from child composition when name is generic', () => {
    expect(
      inferDirectoryPurpose(
        index('features', [
          child({ name: 'button.tsx', ext: '.tsx' }),
          child({ name: 'index.ts', ext: '.ts' }),
        ]),
      ),
    ).toBe('Source directory for related implementation files.');

    expect(inferDirectoryPurpose(index('guides', [child({ name: 'usage.md', ext: '.md' })]))).toBe(
      'Documentation-focused directory.',
    );

    expect(
      inferDirectoryPurpose(
        index('groups', [
          child({ name: 'alpha', type: 'dir' }),
          child({ name: 'beta', type: 'dir' }),
        ]),
      ),
    ).toBe('Grouping directory for related subdirectories.');
  });
});

describe('scoreCandidate', () => {
  it('prioritizes important source directories and convention files by intent', () => {
    const srcDir = child({ name: 'src', type: 'dir', summary: 'Directory' });
    const readme = child({ name: 'README.md', importance: 'high', ext: '.md' });
    const feature = child({ name: 'feature.ts', ext: '.ts' });

    expect(scoreCandidate(srcDir, undefined)).toBe(70);
    expect(scoreCandidate(readme, 'find_conventions')).toBe(105);
    expect(scoreCandidate(readme, 'locate')).toBe(100);
    expect(scoreCandidate(feature, 'locate')).toBe(40);
  });

  it('accepts every navigate intent without changing base scores', () => {
    const feature = child({ name: 'feature.ts', ext: '.ts' });
    const intents: Array<NavigateOptions['intent']> = [
      'understand_structure',
      'prepare_refactor',
      'prepare_create',
      'validate_freshness',
    ];

    expect(intents.map((intent) => scoreCandidate(feature, intent))).toEqual([40, 40, 40, 40]);
  });
});
