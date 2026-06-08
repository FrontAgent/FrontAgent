import { describe, expect, it } from 'vitest';
import { canReuseIndex } from './repository.js';
import type { RepositoryIndex } from './types.js';
import { INDEX_VERSION } from './types.js';

function makeIndex(overrides: Partial<RepositoryIndex> = {}): RepositoryIndex {
  return {
    version: INDEX_VERSION,
    source: {
      repoUrl: 'https://github.com/user/repo.git',
      branch: 'main',
      syncedAt: '2024-01-01T00:00:00Z',
      revision: 'abc123',
      repoDir: '/tmp/cache/repo',
      indexedFiles: 10,
      indexedChunks: 50,
      excludedPathPrefixes: ['vendor'],
      excludedSubmodulePaths: ['lib/external'],
    },
    build: {
      chunkSize: 1200,
      chunkOverlap: 200,
      maxFileSizeBytes: 256 * 1024,
      chunkingStrategy: 'semantic-v2',
      chunkSignature: 'sig123',
    },
    bm25: {
      documentCount: 50,
      averageDocumentLength: 100,
      documentFrequency: {},
    },
    documents: [],
    chunks: [],
    ...overrides,
  };
}

const baseExpected = {
  repoUrl: 'https://github.com/user/repo.git',
  branch: 'main',
  revision: 'abc123',
  repoDir: '/tmp/cache/repo',
  excludedPathPrefixes: ['vendor'],
  excludedSubmodulePaths: ['lib/external'],
  chunkSize: 1200,
  chunkOverlap: 200,
  maxFileSizeBytes: 256 * 1024,
};

describe('canReuseIndex', () => {
  it('returns true when all fields match', () => {
    expect(canReuseIndex(makeIndex(), baseExpected)).toBe(true);
  });

  it('returns false when version differs', () => {
    const index = makeIndex();
    (index as { version: number }).version = INDEX_VERSION - 1;
    expect(canReuseIndex(index, baseExpected)).toBe(false);
  });

  it('returns false when repoUrl differs', () => {
    expect(
      canReuseIndex(makeIndex(), { ...baseExpected, repoUrl: 'https://other.com/repo.git' }),
    ).toBe(false);
  });

  it('returns false when branch differs', () => {
    expect(canReuseIndex(makeIndex(), { ...baseExpected, branch: 'develop' })).toBe(false);
  });

  it('returns false when revision differs', () => {
    expect(canReuseIndex(makeIndex(), { ...baseExpected, revision: 'def456' })).toBe(false);
  });

  it('returns false when repoDir differs', () => {
    expect(canReuseIndex(makeIndex(), { ...baseExpected, repoDir: '/other/path' })).toBe(false);
  });

  it('returns false when excludedPathPrefixes differ', () => {
    expect(
      canReuseIndex(makeIndex(), { ...baseExpected, excludedPathPrefixes: ['vendor', 'extra'] }),
    ).toBe(false);
  });

  it('returns false when chunkSize differs', () => {
    expect(canReuseIndex(makeIndex(), { ...baseExpected, chunkSize: 800 })).toBe(false);
  });

  it('returns false when chunkOverlap differs', () => {
    expect(canReuseIndex(makeIndex(), { ...baseExpected, chunkOverlap: 100 })).toBe(false);
  });

  it('returns false when maxFileSizeBytes differs', () => {
    expect(canReuseIndex(makeIndex(), { ...baseExpected, maxFileSizeBytes: 512 * 1024 })).toBe(
      false,
    );
  });

  it('returns false when chunkingStrategy is not semantic-v2', () => {
    const index = makeIndex();
    index.build.chunkingStrategy = 'naive';
    expect(canReuseIndex(index, baseExpected)).toBe(false);
  });
});
