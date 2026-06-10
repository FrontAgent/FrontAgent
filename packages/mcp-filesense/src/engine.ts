/**
 * Filesense Engine - Core indexing logic adapted for library use.
 * Provides sync, summarize, check, and query operations on directory trees.
 */

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { inferDirectoryPurpose, inferImportance, scoreCandidate } from './engine-helpers.js';
import { type ComparableIndex, persistDirectoryIndex } from './engine-indexing.js';
import { buildNotesFile, inferConventions } from './engine-notes.js';
import { buildQueryResult } from './engine-query.js';
import { ensureSchemaFiles, relativeSchemaRef, schemaPathsForRoot } from './engine-schema.js';
import type {
  CheckSummary,
  ChildEntry,
  FilesenseConfig,
  IgnoreMatcher,
  IndexFile,
  NavigateOptions,
  NavigateResult,
  NotesFile,
  QueryResult,
  SummarizeSummary,
  SyncSummary,
} from './types.js';
import { DEFAULT_CONFIG, INTERNAL_FILES } from './types.js';

// ─── Utility Helpers ───────────────────────────────────────────────────────────

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

async function hashFile(targetPath: string, algorithm: 'sha1'): Promise<string> {
  const buffer = await fs.readFile(targetPath);
  return `${algorithm}:${createHash(algorithm).update(buffer).digest('hex')}`;
}

function relativeToRoot(root: string, targetPath: string): string {
  const relative = path.relative(root, targetPath).replace(/\\/g, '/');
  return relative === '' ? '.' : relative;
}

function isWithinRoot(targetPath: string, root: string): boolean {
  const relative = path.relative(root, targetPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/**
 * Canonicalize a path for containment checks: realpath the deepest existing
 * ancestor and re-append the nonexistent remainder, so symlinked segments
 * cannot smuggle a lexically in-boundary path to a real location outside it.
 */
async function canonicalize(targetPath: string): Promise<string> {
  let base = path.resolve(targetPath);
  const suffix: string[] = [];
  while (true) {
    try {
      const real = await fs.realpath(base);
      return suffix.length > 0 ? path.join(real, ...suffix) : real;
    } catch {
      const parent = path.dirname(base);
      if (parent === base) return path.join(base, ...suffix);
      suffix.unshift(path.basename(base));
      base = parent;
    }
  }
}

/**
 * Resolve an operation target while enforcing the optional containment
 * boundary. Every public engine operation funnels its target through this so
 * a caller-supplied boundary bounds all reads and writes, not just
 * config-root discovery. Containment is checked lexically first (so paths
 * that are obviously outside are rejected without touching the filesystem)
 * and then on the canonical real path, so in-boundary symlinks cannot escape.
 */
async function resolveContainedTarget(targetPath: string, boundary?: string): Promise<string> {
  const target = path.resolve(targetPath);
  if (boundary === undefined) return target;
  const lexicalBoundary = path.resolve(boundary);
  if (!isWithinRoot(target, lexicalBoundary)) {
    throw new Error(`Access denied: Path resolves outside the boundary: ${targetPath}`);
  }
  const realBoundary = await canonicalize(lexicalBoundary);
  const realTarget = await canonicalize(target);
  if (!isWithinRoot(realTarget, realBoundary)) {
    throw new Error(`Access denied: Path resolves outside the boundary: ${targetPath}`);
  }
  return realTarget;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value !== 'object' || value === null) return value;
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    output[key] = sortKeys((value as Record<string, unknown>)[key]);
  }
  return output;
}

function sameSet(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) return false;
  for (const item of left) {
    if (!right.has(item)) return false;
  }
  return true;
}

const schemaFileDeps = { exists, readJson, stableStringify, writeJson };

// ─── Config & Ignore ───────────────────────────────────────────────────────────

export async function loadConfig(root: string): Promise<FilesenseConfig> {
  const configPath = path.join(root, '.filesrc.json');
  return (await exists(configPath))
    ? { ...DEFAULT_CONFIG, ...((await readJson(configPath)) as Partial<FilesenseConfig>) }
    : DEFAULT_CONFIG;
}

/**
 * Walk upward from startPath looking for a `.filesrc.json` config root.
 * When `stopAt` is provided (e.g. the MCP projectRoot sandbox), the walk never
 * leaves that boundary: a config above it is ignored, and the boundary itself
 * is the fallback root so discovered roots are always contained within it.
 */
export async function findConfigRoot(startPath: string, stopAt?: string): Promise<string> {
  let current = path.resolve(startPath);
  let boundary: string | undefined;
  if (stopAt !== undefined) {
    // Clamp lexically before any filesystem access so paths that are
    // obviously outside the boundary are never touched, even for metadata;
    // then re-check on canonical real paths so symlinks cannot escape.
    const lexicalBoundary = path.resolve(stopAt);
    if (!isWithinRoot(current, lexicalBoundary)) return lexicalBoundary;
    boundary = await canonicalize(lexicalBoundary);
    current = await canonicalize(current);
    if (!isWithinRoot(current, boundary)) return boundary;
  }
  const stat = await fs.stat(current);
  if (stat.isFile()) current = path.dirname(current);
  const initialDir = current;

  while (true) {
    if (await exists(path.join(current, '.filesrc.json'))) return current;
    if (current === boundary) return boundary;
    const parent = path.dirname(current);
    if (parent === current) return boundary ?? initialDir;
    current = parent;
  }
}

export async function loadIgnoreMatcher(
  root: string,
  config: FilesenseConfig,
): Promise<IgnoreMatcher> {
  const patterns = new Set(config.exclude);
  const ignorePath = path.join(root, config.ignoreFile);
  if (await exists(ignorePath)) {
    const raw = await fs.readFile(ignorePath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const normalized = line.trim();
      if (!normalized || normalized.startsWith('#')) continue;
      patterns.add(normalized.replace(/^\.\//, ''));
    }
  }

  return (relativePath: string, isDirectory: boolean): boolean => {
    const normalized = relativePath.replace(/\\/g, '/');
    const parts = normalized.split('/');
    for (const pattern of patterns) {
      const clean = pattern.replace(/\\/g, '/');
      if (clean.endsWith('/')) {
        const prefix = clean.slice(0, -1);
        if (normalized === prefix || normalized.startsWith(`${prefix}/`)) return true;
      } else if (clean.includes('/')) {
        if (normalized === clean || normalized.startsWith(`${clean}/`)) return true;
      } else if (parts.includes(clean)) {
        return true;
      } else if (!isDirectory && path.basename(normalized) === clean) {
        return true;
      }
    }
    return false;
  };
}

async function resolveRootAndConfig(targetPath: string, boundary?: string) {
  const target = await resolveContainedTarget(targetPath, boundary);
  const root = await findConfigRoot(target, boundary);
  const config = await loadConfig(root);
  const ignores = await loadIgnoreMatcher(root, config);
  return { root, config, ignores };
}

// ─── Directory Walking ─────────────────────────────────────────────────────────

async function listTrackedEntries(
  root: string,
  dirPath: string,
  config: FilesenseConfig,
  ignores: IgnoreMatcher,
) {
  const items = await fs.readdir(dirPath, { withFileTypes: true });
  const output: Array<{
    name: string;
    type: 'file' | 'dir';
    stat: Awaited<ReturnType<typeof fs.stat>>;
  }> = [];

  for (const item of items) {
    if (
      item.name === config.indexFile ||
      item.name === config.notesFile ||
      item.name === config.ignoreFile
    )
      continue;
    if (INTERNAL_FILES.has(item.name)) continue;

    const absolutePath = path.join(dirPath, item.name);
    const relative = relativeToRoot(root, absolutePath);
    if (relative === config.schemaDir || relative.startsWith(`${config.schemaDir}/`)) continue;
    if (ignores(relative, item.isDirectory())) continue;
    if (!item.isFile() && !item.isDirectory()) continue;

    const stat = await fs.stat(absolutePath);
    output.push({ name: item.name, type: item.isDirectory() ? 'dir' : 'file', stat });
  }
  return output;
}

async function walkDirectories(
  root: string,
  startDir: string,
  config: FilesenseConfig,
  ignores: IgnoreMatcher,
  onDirectory: (dirPath: string) => Promise<void>,
  onSkip: () => void,
  options: { maxDepth?: number; startDepth?: number; shouldStop?: () => boolean } = {},
): Promise<void> {
  if (options.shouldStop?.()) return;
  const currentDepth = options.startDepth ?? 0;
  await onDirectory(startDir);
  if (!config.recursive) return;
  if (options.maxDepth !== undefined && currentDepth >= options.maxDepth) return;
  if (options.shouldStop?.()) return;

  const items = await fs.readdir(startDir, { withFileTypes: true });
  for (const item of items) {
    if (options.shouldStop?.()) return;
    if (!item.isDirectory()) continue;
    const absolutePath = path.join(startDir, item.name);
    const relative = relativeToRoot(root, absolutePath);
    if (relative === config.schemaDir || relative.startsWith(`${config.schemaDir}/`)) {
      onSkip();
      continue;
    }
    if (ignores(relative, true)) {
      onSkip();
      continue;
    }
    await walkDirectories(root, absolutePath, config, ignores, onDirectory, onSkip, {
      ...options,
      startDepth: currentDepth + 1,
    });
  }
}

// ─── Inference Helpers ─────────────────────────────────────────────────────────

function inferSummary(name: string): string {
  const ext = path.extname(name).toLowerCase();
  if (ext === '.ts' || ext === '.tsx') return 'TypeScript source file';
  if (ext === '.js' || ext === '.jsx') return 'JavaScript source file';
  if (ext === '.json') return 'JSON data file';
  if (ext === '.md') return 'Markdown document';
  if (ext === '.sh') return 'Shell script';
  if (ext === '.yml' || ext === '.yaml') return 'YAML configuration file';
  if (ext === '.vue') return 'Vue single-file component';
  if (ext === '.css' || ext === '.scss' || ext === '.less') return 'Stylesheet';
  if (ext === '.html') return 'HTML document';
  if (!ext) return 'File without extension';
  return `${ext.slice(1).toUpperCase()} file`;
}

// ─── Core Operations ───────────────────────────────────────────────────────────

async function writeDirectoryIndex(
  root: string,
  dirPath: string,
  config: FilesenseConfig,
  ignores: IgnoreMatcher,
  forceFull: boolean,
) {
  const indexPath = path.join(dirPath, config.indexFile);
  const previous = (await exists(indexPath)) ? ((await readJson(indexPath)) as IndexFile) : null;
  const previousMap = new Map(previous?.children.map((c) => [c.name, c]) ?? []);
  const entries = await listTrackedEntries(root, dirPath, config, ignores);
  const children: ChildEntry[] = [];
  let filesHashed = 0;

  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);
    const entryMtimeMs = Number(entry.stat?.mtimeMs ?? 0);
    if (entry.type === 'dir') {
      children.push({
        name: entry.name,
        type: 'dir',
        path: relativeToRoot(root, absolutePath),
        ext: '',
        size: 0,
        mtimeMs: entryMtimeMs,
        hash: null,
        summary: 'Directory',
        importance: 'normal',
        status: 'active',
      });
      continue;
    }

    const entrySize = Number(entry.stat?.size ?? 0);
    const prev = previousMap.get(entry.name);
    let hash = prev?.hash ?? null;
    const unchanged =
      !forceFull &&
      prev?.size === entrySize &&
      prev?.mtimeMs === entryMtimeMs &&
      prev?.type === 'file';
    if (!unchanged) {
      hash = await hashFile(absolutePath, config.hashAlgorithm);
      filesHashed += 1;
    }

    children.push({
      name: entry.name,
      type: 'file',
      path: relativeToRoot(root, absolutePath),
      ext: path.extname(entry.name),
      size: entrySize,
      mtimeMs: entryMtimeMs,
      hash,
      summary: prev?.summary ?? inferSummary(entry.name),
      importance: inferImportance(entry.name),
      status: 'active',
    });
  }

  children.sort((a, b) => a.name.localeCompare(b.name));
  const relativePath = relativeToRoot(root, dirPath);
  const nextSchema = relativeSchemaRef(dirPath, schemaPathsForRoot(root, config).indexSchemaPath);
  const nextComparable: ComparableIndex = {
    $schema: nextSchema,
    schema_version: config.schemaVersion,
    root_relative_path: relativePath,
    directory: { name: path.basename(dirPath), path: relativePath },
    children,
    sync: {
      child_count: children.length,
      file_count: children.filter((c) => c.type === 'file').length,
      dir_count: children.filter((c) => c.type === 'dir').length,
    },
  };

  return persistDirectoryIndex({
    indexPath,
    previous,
    nextComparable,
    forceFull,
    filesHashed,
    stableStringify,
    writeJson,
  });
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialize filesense in a directory (creates .filesrc.json, .filesignore, schemas, initial index)
 */
export async function init(targetPath: string, boundary?: string): Promise<SyncSummary> {
  const root = await resolveContainedTarget(targetPath, boundary);
  const configPath = path.join(root, '.filesrc.json');
  if (!(await exists(configPath))) {
    await writeJson(configPath, DEFAULT_CONFIG);
  }
  const ignorePath = path.join(root, '.filesignore');
  if (!(await exists(ignorePath))) {
    await fs.writeFile(
      ignorePath,
      `${[
        '# One pattern per line',
        '.git',
        'node_modules',
        'dist',
        'build',
        '.next',
        'coverage',
      ].join('\n')}\n`,
      'utf8',
    );
  }
  const config = await loadConfig(root);
  await ensureSchemaFiles(root, config, schemaFileDeps);
  return syncIndexes(root, false, { boundary });
}

/**
 * Sync (write/update) FILES.json indexes recursively
 */
export async function syncIndexes(
  targetPath: string,
  forceFull = false,
  options: { depth?: number; maxEntries?: number; timeoutMs?: number; boundary?: string } = {},
): Promise<SyncSummary> {
  const { root, config, ignores } = await resolveRootAndConfig(targetPath, options.boundary);
  await ensureSchemaFiles(root, config, schemaFileDeps);
  const summary: SyncSummary = {
    root,
    directoriesScanned: 0,
    indexesWritten: 0,
    filesHashed: 0,
    directoriesSkipped: 0,
  };
  const startedAt = Date.now();

  await walkDirectories(
    root,
    root,
    config,
    ignores,
    async (dirPath) => {
      summary.directoriesScanned += 1;
      const result = await writeDirectoryIndex(root, dirPath, config, ignores, forceFull);
      summary.filesHashed += result.filesHashed;
      if (result.wroteIndex) summary.indexesWritten += 1;
    },
    () => {
      summary.directoriesSkipped += 1;
    },
    {
      maxDepth: options.depth,
      shouldStop: () =>
        (options.maxEntries !== undefined && summary.directoriesScanned >= options.maxEntries) ||
        (options.timeoutMs !== undefined && Date.now() - startedAt >= options.timeoutMs),
    },
  );

  return summary;
}

/**
 * Summarize directories with heuristic FILES.notes.json
 */
export async function summarize(
  targetPath: string,
  force = false,
  boundary?: string,
): Promise<SummarizeSummary> {
  const { root, config, ignores } = await resolveRootAndConfig(targetPath, boundary);
  await ensureSchemaFiles(root, config, schemaFileDeps);
  const summary: SummarizeSummary = {
    root,
    directoriesScanned: 0,
    notesWritten: 0,
    notesSkipped: 0,
  };

  await walkDirectories(
    root,
    root,
    config,
    ignores,
    async (dirPath) => {
      summary.directoriesScanned += 1;
      const indexPath = path.join(dirPath, config.indexFile);
      if (!(await exists(indexPath))) {
        summary.notesSkipped += 1;
        return;
      }

      const index = (await readJson(indexPath)) as IndexFile;
      const notesPath = path.join(dirPath, config.notesFile);
      const previous = (await exists(notesPath))
        ? ((await readJson(notesPath)) as NotesFile)
        : null;
      const next = buildNotesFile(
        dirPath,
        schemaPathsForRoot(root, config).notesSchemaPath,
        index,
        previous,
        force,
      );

      if (previous && stableStringify(previous) === stableStringify(next)) {
        summary.notesSkipped += 1;
        return;
      }
      await writeJson(notesPath, next);
      summary.notesWritten += 1;
    },
    () => undefined,
  );

  return summary;
}

/**
 * Check index coverage and freshness
 */
export async function check(targetPath: string, boundary?: string): Promise<CheckSummary> {
  const { root, config, ignores } = await resolveRootAndConfig(targetPath, boundary);
  const summary: CheckSummary = {
    root,
    checkedDirectories: 0,
    missingIndexes: [],
    staleIndexes: [],
    invalidIndexes: [],
    invalidNotes: [],
    missingSchemas: [],
  };

  const schemaPaths = schemaPathsForRoot(root, config);
  for (const sp of [schemaPaths.indexSchemaPath, schemaPaths.notesSchemaPath]) {
    if (!(await exists(sp))) {
      summary.missingSchemas.push(relativeToRoot(root, sp));
      continue;
    }
    try {
      await readJson(sp);
    } catch {
      summary.missingSchemas.push(relativeToRoot(root, sp));
    }
  }

  await walkDirectories(
    root,
    root,
    config,
    ignores,
    async (dirPath) => {
      summary.checkedDirectories += 1;
      const indexPath = path.join(dirPath, config.indexFile);
      if (!(await exists(indexPath))) {
        summary.missingIndexes.push(relativeToRoot(root, dirPath));
        return;
      }

      let index: IndexFile;
      try {
        index = (await readJson(indexPath)) as IndexFile;
      } catch {
        summary.invalidIndexes.push(relativeToRoot(root, indexPath));
        return;
      }

      const actualEntries = await listTrackedEntries(root, dirPath, config, ignores);
      const indexedNames = new Set(index.children.map((e) => e.name));
      const actualNames = new Set(actualEntries.map((e) => e.name));
      if (!sameSet(indexedNames, actualNames))
        summary.staleIndexes.push(relativeToRoot(root, dirPath));
    },
    () => undefined,
  );

  return summary;
}

/**
 * Query a directory's index and notes
 */
export async function query(targetPath: string, boundary?: string): Promise<QueryResult> {
  const target = await resolveContainedTarget(targetPath, boundary);
  const { root, config } = await resolveRootAndConfig(target, boundary);
  const indexPath = path.join(target, config.indexFile);
  if (!(await exists(indexPath)))
    throw new Error(`No ${config.indexFile} found in ${target}. Run sync first.`);

  const index = (await readJson(indexPath)) as IndexFile;
  const notesPath = path.join(target, config.notesFile);
  const notes = (await exists(notesPath)) ? ((await readJson(notesPath)) as NotesFile) : null;

  return buildQueryResult({ root, target, index, notes });
}

function detectPackageManager(indexes: IndexFile[]): string | undefined {
  const names = new Set(indexes.flatMap((index) => index.children.map((child) => child.name)));
  if (names.has('pnpm-lock.yaml')) return 'pnpm';
  if (names.has('yarn.lock')) return 'yarn';
  if (names.has('package-lock.json')) return 'npm';
  if (names.has('bun.lockb')) return 'bun';
  return names.has('package.json') ? 'node' : undefined;
}

function detectProjectType(indexes: IndexFile[]): string | undefined {
  const names = new Set(
    indexes.flatMap((index) => index.children.map((child) => child.name.toLowerCase())),
  );
  if (names.has('vite.config.ts') || names.has('vite.config.js')) return 'Vite frontend project';
  if (names.has('next.config.js') || names.has('next.config.mjs'))
    return 'Next.js frontend project';
  if (names.has('package.json')) return 'Node.js / frontend project';
  if (
    indexes.some((index) =>
      index.children.some((child) => ['.tsx', '.jsx', '.vue', '.svelte'].includes(child.ext)),
    )
  )
    return 'Frontend source project';
  return undefined;
}

export async function navigate(
  targetPath: string,
  options: NavigateOptions = {},
): Promise<NavigateResult> {
  const startedAt = Date.now();
  const depth = options.depth ?? 2;
  const maxEntries = options.maxEntries ?? 300;
  const timeoutMs = options.timeoutMs ?? 3000;
  const output = options.output ?? 'summary';
  const target = await resolveContainedTarget(targetPath, options.boundary);
  const { root, config, ignores } = await resolveRootAndConfig(target, options.boundary);
  const realBoundary =
    options.boundary === undefined ? undefined : await canonicalize(options.boundary);
  const requestedPaths = options.paths?.length ? options.paths : ['.'];
  const indexes: IndexFile[] = [];
  const warnings: string[] = [];
  let entries = 0;
  let truncated = false;

  const stop = () => {
    const shouldStop = entries >= maxEntries || Date.now() - startedAt >= timeoutMs;
    if (shouldStop) truncated = true;
    return shouldStop;
  };

  for (const requestedPath of requestedPaths) {
    if (stop()) break;
    let startDir = path.resolve(root, requestedPath);
    if (realBoundary !== undefined) {
      // Canonicalize each requested path so an in-boundary symlink cannot
      // route the scan to a real location outside the boundary.
      startDir = await canonicalize(startDir);
      if (!isWithinRoot(startDir, realBoundary)) {
        warnings.push(`Path resolves outside the allowed root: ${requestedPath}`);
        continue;
      }
    }
    if (!(await exists(startDir))) {
      warnings.push(`Path does not exist: ${requestedPath}`);
      continue;
    }
    const stat = await fs.stat(startDir);
    const dir = stat.isDirectory() ? startDir : path.dirname(startDir);

    await walkDirectories(
      root,
      dir,
      config,
      ignores,
      async (dirPath) => {
        if (stop()) return;
        const children = await listTrackedEntries(root, dirPath, config, ignores);
        const childEntries: ChildEntry[] = children
          .map((entry) => {
            const absolutePath = path.join(dirPath, entry.name);
            return {
              name: entry.name,
              type: entry.type,
              path: relativeToRoot(root, absolutePath),
              ext: entry.type === 'file' ? path.extname(entry.name) : '',
              size: entry.type === 'file' ? Number(entry.stat?.size ?? 0) : 0,
              mtimeMs: Number(entry.stat?.mtimeMs ?? 0),
              hash: null,
              summary: entry.type === 'dir' ? 'Directory' : inferSummary(entry.name),
              importance: entry.type === 'file' ? inferImportance(entry.name) : 'normal',
              status: 'active' as const,
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name));
        entries += childEntries.length;
        indexes.push({
          schema_version: config.schemaVersion,
          generated_at: new Date().toISOString(),
          root_relative_path: relativeToRoot(root, dirPath),
          directory: { name: path.basename(dirPath), path: relativeToRoot(root, dirPath) },
          children: childEntries,
          sync: {
            child_count: childEntries.length,
            file_count: childEntries.filter((child) => child.type === 'file').length,
            dir_count: childEntries.filter((child) => child.type === 'dir').length,
            last_full_sync: null,
            last_incremental_sync: null,
          },
        });
      },
      () => undefined,
      { maxDepth: depth, shouldStop: stop },
    );
  }

  const allChildren = indexes.flatMap((index) => index.children);
  const mainEntrypoints = allChildren
    .filter((child) => child.type === 'file' && child.importance === 'high')
    .map((child) => child.path)
    .slice(0, 8);
  const importantDirs = indexes
    .filter((index) => index.root_relative_path !== '.')
    .map((index) => ({
      path: index.root_relative_path,
      purpose: inferDirectoryPurpose(index),
      confidence: 0.75,
    }))
    .slice(0, 10);
  const conventions = Array.from(
    new Set(indexes.flatMap((index) => inferConventions(index))),
  ).slice(0, 8);
  const candidates = allChildren
    .map((child) => ({
      path: child.path,
      type: child.type,
      reason: child.importance === 'high' ? 'high-importance entrypoint/config' : child.summary,
      score: scoreCandidate(child, options.intent),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, output === 'verbose' ? 50 : 15);

  const result: NavigateResult = {
    root,
    scanned: {
      paths: requestedPaths,
      depth,
      entries,
      elapsedMs: Date.now() - startedAt,
      truncated,
    },
    summary: {
      projectType: detectProjectType(indexes),
      packageManager: detectPackageManager(indexes),
      mainEntrypoints,
      importantDirs,
      conventions,
      risks: truncated
        ? [
            'Filesense navigation was truncated by budget; expand depth/maxEntries if more coverage is needed.',
          ]
        : [],
    },
    candidates,
    factsDelta: {
      existingFiles: Array.from(
        new Set(allChildren.filter((child) => child.type === 'file').map((child) => child.path)),
      ).slice(0, 200),
      existingDirectories: Array.from(
        new Set(allChildren.filter((child) => child.type === 'dir').map((child) => child.path)),
      ).slice(0, 200),
    },
    warnings,
  };

  if (output === 'verbose') {
    result.indexes = indexes;
  }

  const maxBytes = options.maxBytes;
  if (maxBytes !== undefined && Buffer.byteLength(JSON.stringify(result), 'utf8') > maxBytes) {
    result.warnings.push(
      `Navigation result exceeded maxBytes=${maxBytes}; returning compact summary.`,
    );
    result.candidates = result.candidates.slice(0, 10);
    result.factsDelta.existingFiles = result.factsDelta.existingFiles.slice(0, 80);
    result.factsDelta.existingDirectories = result.factsDelta.existingDirectories.slice(0, 80);
    result.indexes = undefined;
  }

  return result;
}

/**
 * Sync + Summarize in one call (most common agent usage)
 */
export async function syncAndSummarize(
  targetPath: string,
  forceFull = false,
  boundary?: string,
): Promise<{ sync: SyncSummary; summarize: SummarizeSummary }> {
  const syncResult = await syncIndexes(targetPath, forceFull, { boundary });
  const summarizeResult = await summarize(targetPath, false, boundary);
  return { sync: syncResult, summarize: summarizeResult };
}
