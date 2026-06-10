/**
 * Filesense configuration types
 */

export interface FilesenseConfig {
  schemaVersion: string;
  root: string;
  recursive: boolean;
  indexFile: string;
  notesFile: string;
  ignoreFile: string;
  schemaDir: string;
  exclude: string[];
  hashAlgorithm: 'sha1';
}

export interface ChildEntry {
  name: string;
  type: 'file' | 'dir';
  path: string;
  ext: string;
  size: number;
  mtimeMs: number;
  hash: string | null;
  summary: string;
  importance: 'high' | 'normal';
  status: 'active';
}

export interface IndexFile {
  $schema?: string;
  schema_version: string;
  generated_at: string;
  root_relative_path: string;
  directory: {
    name: string;
    path: string;
  };
  children: ChildEntry[];
  sync: {
    child_count: number;
    file_count: number;
    dir_count: number;
    last_full_sync: string | null;
    last_incremental_sync: string | null;
  };
}

export interface NotesFile {
  $schema?: string;
  directory_purpose?: string;
  agent_hints?: string[];
  conventions?: string[];
  key_entrypoints?: string[];
}

export interface SyncSummary {
  root: string;
  directoriesScanned: number;
  indexesWritten: number;
  filesHashed: number;
  directoriesSkipped: number;
}

export interface SummarizeSummary {
  root: string;
  directoriesScanned: number;
  notesWritten: number;
  notesSkipped: number;
}

export interface CheckSummary {
  root: string;
  checkedDirectories: number;
  missingIndexes: string[];
  staleIndexes: string[];
  invalidIndexes: string[];
  invalidNotes: string[];
  missingSchemas: string[];
}

export interface QueryResult {
  root: string;
  target: string;
  rootRelativePath: string;
  index: IndexFile;
  notes: NotesFile | null;
}

export interface FilesenseBudget {
  depth?: number;
  maxEntries?: number;
  maxBytes?: number;
  timeoutMs?: number;
}

export interface NavigateOptions extends FilesenseBudget {
  /** Containment boundary (e.g. MCP projectRoot); config-root discovery and scanning never leave it. */
  boundary?: string;
  paths?: string[];
  intent?:
    | 'locate'
    | 'understand_structure'
    | 'find_conventions'
    | 'prepare_refactor'
    | 'prepare_create'
    | 'validate_freshness';
  output?: 'summary' | 'candidates' | 'verbose';
  writeMode?: 'cache' | 'workspace' | 'none';
}

export interface NavigateResult {
  root: string;
  scanned: {
    paths: string[];
    depth: number;
    entries: number;
    elapsedMs: number;
    truncated: boolean;
  };
  summary: {
    projectType?: string;
    packageManager?: string;
    mainEntrypoints: string[];
    importantDirs: Array<{ path: string; purpose: string; confidence: number }>;
    conventions: string[];
    risks: string[];
  };
  candidates: Array<{ path: string; type: 'file' | 'dir'; reason: string; score: number }>;
  factsDelta: {
    existingFiles: string[];
    existingDirectories: string[];
  };
  warnings: string[];
  indexes?: IndexFile[];
}

export type IgnoreMatcher = (relativePath: string, isDirectory: boolean) => boolean;

export const DEFAULT_CONFIG: FilesenseConfig = {
  schemaVersion: '1.0',
  root: '.',
  recursive: true,
  indexFile: 'FILES.json',
  notesFile: 'FILES.notes.json',
  ignoreFile: '.filesignore',
  schemaDir: 'schemas',
  exclude: ['.git', 'node_modules', 'dist', 'build', '.next', 'coverage'],
  hashAlgorithm: 'sha1',
};

export const INTERNAL_FILES = new Set(['FILES.json', 'FILES.notes.json', '.filesrc.json']);
