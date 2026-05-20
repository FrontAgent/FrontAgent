import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

import { chunkText } from './chunking.js';
import {
  BINARY_EXTENSIONS,
  IGNORED_DIR_NAMES,
  INDEX_VERSION,
  type RepositoryChunk,
  type RepositoryDocument,
  type RepositoryIndex,
} from './types.js';
import { hashText, normalizeRepoPath, sameStringSet, toBlobUrl } from './utils.js';

const execFileAsync = promisify(execFile);

export async function ensureRepositoryCheckout(input: {
  repoUrl: string;
  branch: string;
  repoDir: string;
  sync: boolean;
}): Promise<string> {
  const parentDir = resolve(input.repoDir, '..');
  mkdirSync(parentDir, { recursive: true });

  if (!existsSync(input.repoDir)) {
    await runGit(
      [
        'clone',
        '--depth',
        '1',
        '--single-branch',
        '--branch',
        input.branch,
        input.repoUrl,
        input.repoDir,
      ],
      parentDir,
    );
    return input.repoDir;
  }

  if (!input.sync) {
    return input.repoDir;
  }

  try {
    await runGit(['pull', '--ff-only', 'origin', input.branch], input.repoDir);
    return input.repoDir;
  } catch {
    rmSync(input.repoDir, { recursive: true, force: true });
    await runGit(
      [
        'clone',
        '--depth',
        '1',
        '--single-branch',
        '--branch',
        input.branch,
        input.repoUrl,
        input.repoDir,
      ],
      parentDir,
    );
    return input.repoDir;
  }
}

export async function getRepositoryHead(repoDir: string): Promise<string> {
  const result = await runGit(['rev-parse', 'HEAD'], repoDir);
  return result.stdout.trim();
}

export function getSubmodulePaths(repoDir: string): string[] {
  const gitmodulesPath = join(repoDir, '.gitmodules');
  if (!existsSync(gitmodulesPath)) {
    return [];
  }

  const content = readFileSync(gitmodulesPath, 'utf-8');
  const pattern = /^\s*path\s*=\s*(.+)\s*$/gm;
  const paths: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    paths.push(normalizeRepoPath(match[1]));
  }
  return paths;
}

async function runGit(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync('git', args, {
    cwd,
    maxBuffer: 1024 * 1024 * 64,
  });
}

export function canReuseIndex(
  index: RepositoryIndex,
  expected: {
    repoUrl: string;
    branch: string;
    revision: string;
    repoDir: string;
    excludedPathPrefixes: string[];
    excludedSubmodulePaths: string[];
    chunkSize: number;
    chunkOverlap: number;
    maxFileSizeBytes: number;
  },
): boolean {
  return (
    index.version === INDEX_VERSION &&
    index.source.repoUrl === expected.repoUrl &&
    index.source.branch === expected.branch &&
    index.source.revision === expected.revision &&
    index.source.repoDir === expected.repoDir &&
    sameStringSet(index.source.excludedPathPrefixes, expected.excludedPathPrefixes) &&
    sameStringSet(index.source.excludedSubmodulePaths, expected.excludedSubmodulePaths) &&
    index.build.chunkSize === expected.chunkSize &&
    index.build.chunkOverlap === expected.chunkOverlap &&
    index.build.maxFileSizeBytes === expected.maxFileSizeBytes &&
    index.build.chunkingStrategy === 'semantic-v2'
  );
}

export function buildRepositoryIndex(input: {
  repoDir: string;
  repoUrl: string;
  branch: string;
  revision: string;
  excludedPathPrefixes: string[];
  excludedSubmodulePaths: string[];
  chunkSize: number;
  chunkOverlap: number;
  maxFileSizeBytes: number;
}): RepositoryIndex {
  const files = listRepositoryFiles(
    input.repoDir,
    input.excludedPathPrefixes,
    input.maxFileSizeBytes,
  );
  const documents: RepositoryDocument[] = [];
  const chunks: RepositoryChunk[] = [];
  const documentFrequency: Record<string, number> = {};
  let totalDocumentLength = 0;

  for (const file of files) {
    const fileBuffer = readFileSync(join(input.repoDir, file.path));
    if (looksBinary(fileBuffer, file.path)) {
      continue;
    }

    const content = fileBuffer.toString('utf-8');
    if (!content.trim()) {
      continue;
    }

    const documentId = `doc:${file.path}`;
    const documentChunks = chunkText(content, file.path, input.chunkSize, input.chunkOverlap);
    if (documentChunks.length === 0) {
      continue;
    }

    const topLevelDir = getTopLevelDir(file.path);
    const extension = extname(file.path).toLowerCase();
    const sourceUrl = toBlobUrl(input.repoUrl, input.branch, file.path);
    const contentHash = hashText(content);
    const documentChunkIds: string[] = [];

    const processedChunks: RepositoryChunk[] = documentChunks.map((chunk, index) => {
      const keywordText = `${file.path}\n${chunk.text}`;
      const tokens = tokenize(keywordText);
      const termFrequency = countTerms(tokens);
      const tokenCount = tokens.length;
      const uniqueTokens = Object.keys(termFrequency);
      for (const token of uniqueTokens) {
        documentFrequency[token] = (documentFrequency[token] ?? 0) + 1;
      }
      totalDocumentLength += tokenCount;

      const chunkId = `chunk:${file.path}:${index}`;
      documentChunkIds.push(chunkId);
      return {
        id: chunkId,
        documentId,
        path: file.path,
        sourceUrl,
        title: basename(file.path),
        text: chunk.text,
        keywordText,
        contentHash: hashText(`${file.path}:${index}:${chunk.text}`),
        tokenCount,
        termFrequency,
        metadata: {
          extension,
          topLevelDir,
          chunkIndex: index,
          totalChunks: documentChunks.length,
          lineStart: chunk.lineStart,
          lineEnd: chunk.lineEnd,
        },
      };
    });

    documents.push({
      id: documentId,
      path: file.path,
      title: basename(file.path),
      sourceUrl,
      extension,
      topLevelDir,
      sizeBytes: file.sizeBytes,
      contentHash,
      chunkIds: documentChunkIds,
    });
    chunks.push(...processedChunks);
  }

  return {
    version: INDEX_VERSION,
    source: {
      repoUrl: input.repoUrl,
      branch: input.branch,
      syncedAt: new Date().toISOString(),
      revision: input.revision,
      repoDir: input.repoDir,
      indexedFiles: documents.length,
      indexedChunks: chunks.length,
      excludedPathPrefixes: input.excludedPathPrefixes,
      excludedSubmodulePaths: input.excludedSubmodulePaths,
    },
    build: {
      chunkSize: input.chunkSize,
      chunkOverlap: input.chunkOverlap,
      maxFileSizeBytes: input.maxFileSizeBytes,
      chunkingStrategy: 'semantic-v2',
      chunkSignature: buildChunkSignature(chunks),
    },
    bm25: {
      documentCount: chunks.length,
      averageDocumentLength: chunks.length > 0 ? totalDocumentLength / chunks.length : 0,
      documentFrequency,
    },
    documents,
    chunks,
  };
}

function listRepositoryFiles(
  repoDir: string,
  excludedPathPrefixes: string[],
  maxFileSizeBytes: number,
): Array<{ path: string; sizeBytes: number }> {
  const results: Array<{ path: string; sizeBytes: number }> = [];
  const stack = [''];

  while (stack.length > 0) {
    const relativeDir = stack.pop()!;
    const absoluteDir = join(repoDir, relativeDir);
    const entries = readdirSync(absoluteDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.gitmodules') {
        if (entry.isDirectory()) {
          continue;
        }
      }

      const relativePath = relativeDir ? join(relativeDir, entry.name) : entry.name;
      const normalizedPath = normalizeRepoPath(relativePath);

      if (isExcludedPath(normalizedPath, excludedPathPrefixes)) {
        continue;
      }

      if (entry.isDirectory()) {
        if (IGNORED_DIR_NAMES.has(entry.name)) {
          continue;
        }
        stack.push(normalizedPath);
        continue;
      }

      const stats = statSync(join(repoDir, normalizedPath));
      if (!stats.isFile() || stats.size > maxFileSizeBytes) {
        continue;
      }

      results.push({
        path: normalizedPath,
        sizeBytes: stats.size,
      });
    }
  }

  results.sort((left, right) => left.path.localeCompare(right.path));
  return results;
}

function isExcludedPath(path: string, excludedPathPrefixes: string[]): boolean {
  return excludedPathPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function looksBinary(buffer: Buffer, path: string): boolean {
  const extension = extname(path).toLowerCase();
  if (BINARY_EXTENSIONS.has(extension)) {
    return true;
  }

  const fileName = basename(path).toLowerCase();
  if (/\.min\.(js|css|mjs|cjs)$/.test(fileName)) {
    return true;
  }

  const sample = buffer.subarray(0, Math.min(buffer.length, 1024));
  let suspicious = 0;
  for (const byte of sample) {
    if (byte === 0) {
      return true;
    }
    if (byte < 7 || (byte > 14 && byte < 32)) {
      suspicious++;
    }
  }
  return sample.length > 0 && suspicious / sample.length > 0.2;
}

function getTopLevelDir(path: string): string {
  const firstSegment = normalizeRepoPath(path).split('/')[0];
  return firstSegment || 'root';
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  const seen = new Set<string>();

  const emit = (token: string) => {
    if (token.length >= 2 && !seen.has(token)) {
      seen.add(token);
      tokens.push(token);
    }
  };

  const normalized = input.toLowerCase();
  for (const match of normalized.match(/[a-z0-9_@./:-]+/g) ?? []) {
    emit(match);
    if (match.includes('_')) {
      for (const part of match.split('_')) {
        emit(part);
      }
    }
  }

  for (const identifier of input.match(/[A-Za-z][a-zA-Z0-9]*/g) ?? []) {
    if (!/[a-z]/.test(identifier) || !/[A-Z]/.test(identifier)) {
      continue;
    }
    const parts = identifier
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .split(/\s+/);
    for (const part of parts) {
      emit(part.toLowerCase());
    }
  }

  for (const match of normalized.match(/[一-鿿]+/g) ?? []) {
    if (match.length === 1) {
      emit(match);
      continue;
    }
    for (let i = 0; i < match.length - 1; i++) {
      emit(match.slice(i, i + 2));
    }
  }

  return tokens;
}

function countTerms(tokens: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const token of tokens) {
    counts[token] = (counts[token] ?? 0) + 1;
  }
  return counts;
}

function buildChunkSignature(chunks: RepositoryChunk[]): string {
  const hash = createHash('sha256');
  for (const chunk of chunks) {
    hash.update(chunk.id);
    hash.update(':');
    hash.update(chunk.contentHash);
    hash.update('\n');
  }
  return hash.digest('hex');
}
