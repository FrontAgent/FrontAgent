import path from 'node:path';
import { inferDirectoryPurpose } from './engine-helpers.js';
import type { FilesenseConfig, IndexFile, NotesFile } from './types.js';

function relativeSchemaRef(dirPath: string, schemaPath: string): string {
  return path.relative(dirPath, schemaPath).replace(/\\/g, '/');
}

export function inferAgentHints(index: IndexFile): string[] {
  const hints: string[] = [];
  const names = new Set(index.children.map((c) => c.name));
  const entrypoints = inferKeyEntrypoints(index);
  if (entrypoints.length > 0)
    hints.push(
      `Read ${entrypoints.slice(0, 3).join(', ')} first for local entrypoints and conventions.`,
    );
  if (names.has('package.json'))
    hints.push('Inspect package.json before changing scripts, package metadata, or dependencies.');
  if (names.has('tsconfig.json'))
    hints.push('Respect tsconfig.json compiler settings when adding or moving TypeScript files.');
  if (
    index.children.some((c) => c.type === 'dir') &&
    index.children.filter((c) => c.type === 'file').length <= 2
  ) {
    hints.push(
      'Descend into child directories before making edits here; this level is mostly structural.',
    );
  }
  if (hints.length === 0)
    hints.push(
      'Start from high-importance files before editing lower-level implementation details.',
    );
  return hints.slice(0, 4);
}

export function inferConventions(index: IndexFile): string[] {
  const conventions: string[] = [];
  if (index.children.some((c) => ['.ts', '.tsx'].includes(c.ext)))
    conventions.push('Prefer TypeScript for new source files in this directory.');
  if (index.children.some((c) => c.ext === '.tsx' && /^[A-Z]/.test(c.name)))
    conventions.push('Component-like files use PascalCase filenames.');
  if (index.children.some((c) => /test|spec/i.test(c.name)))
    conventions.push('Keep tests close to the implementation they validate.');
  if (index.children.some((c) => c.name === 'README.md'))
    conventions.push('Update README.md when directory-level usage or setup changes.');
  if (conventions.length === 0)
    conventions.push('Preserve the local naming and file-placement patterns already present here.');
  return conventions.slice(0, 4);
}

export function inferKeyEntrypoints(index: IndexFile): string[] {
  const preferred = [
    'README.md',
    'package.json',
    'tsconfig.json',
    'index.ts',
    'index.tsx',
    'main.ts',
    'main.js',
    'App.tsx',
    'App.vue',
  ];
  const names = index.children.map((c) => c.name);
  const selected = preferred.filter((n) => names.includes(n));
  if (selected.length > 0) return selected.slice(0, 6);
  return index.children
    .filter((c) => c.type === 'file' && c.importance === 'high')
    .map((c) => c.name)
    .slice(0, 6);
}

export function buildNotesFile(
  root: string,
  dirPath: string,
  config: FilesenseConfig,
  index: IndexFile,
  previous: NotesFile | null,
  force: boolean,
): NotesFile {
  const notesSchemaPath = path.join(root, config.schemaDir, 'FILES.notes.schema.json');
  const inferred: NotesFile = {
    $schema: relativeSchemaRef(dirPath, notesSchemaPath),
    directory_purpose: inferDirectoryPurpose(index),
    agent_hints: inferAgentHints(index),
    conventions: inferConventions(index),
    key_entrypoints: inferKeyEntrypoints(index),
  };
  if (!previous || force) return inferred;
  return {
    $schema: inferred.$schema,
    directory_purpose: previous.directory_purpose || inferred.directory_purpose,
    agent_hints: previous.agent_hints?.length ? previous.agent_hints : inferred.agent_hints,
    conventions: previous.conventions?.length ? previous.conventions : inferred.conventions,
    key_entrypoints: previous.key_entrypoints?.length
      ? previous.key_entrypoints
      : inferred.key_entrypoints,
  };
}
