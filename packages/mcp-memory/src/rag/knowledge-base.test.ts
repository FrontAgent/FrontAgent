import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { HybridRepositoryKnowledgeBase } from './knowledge-base.js';
import type {
  KnowledgeBaseConfig,
  RepositoryChunk,
  RepositoryDocument,
  RepositoryIndex,
} from './types.js';
import { INDEX_VERSION } from './types.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function makeDocument(overrides: Partial<RepositoryDocument> = {}): RepositoryDocument {
  return {
    id: 'doc:knowledge-base',
    path: 'src/rag/knowledge-base.ts',
    title: 'knowledge-base.ts',
    sourceUrl: 'https://github.com/FrontAgent/FrontAgent/blob/develop/src/rag/knowledge-base.ts',
    extension: '.ts',
    topLevelDir: 'src',
    sizeBytes: 256,
    contentHash: 'doc-hash',
    chunkIds: ['chunk:knowledge-base:0'],
    ...overrides,
  };
}

function makeChunk(overrides: Partial<RepositoryChunk> = {}): RepositoryChunk {
  return {
    id: 'chunk:knowledge-base:0',
    documentId: 'doc:knowledge-base',
    path: 'src/rag/knowledge-base.ts',
    sourceUrl: 'https://github.com/FrontAgent/FrontAgent/blob/develop/src/rag/knowledge-base.ts',
    title: 'knowledge-base.ts',
    text: 'HybridRepositoryKnowledgeBase validates query input and returns repository handler results.',
    keywordText:
      'src/rag/knowledge-base.ts HybridRepositoryKnowledgeBase validates query input repository handler',
    contentHash: 'chunk-hash',
    tokenCount: 10,
    termFrequency: {
      hybrid: 2,
      repository: 2,
      handler: 1,
      query: 1,
      validates: 1,
    },
    metadata: {
      extension: '.ts',
      topLevelDir: 'src',
      chunkIndex: 0,
      totalChunks: 1,
      lineStart: 1,
      lineEnd: 3,
    },
    ...overrides,
  };
}

function makeIndex(repoDir: string): RepositoryIndex {
  const primaryDocument = makeDocument();
  const docsDocument = makeDocument({
    id: 'doc:readme',
    path: 'docs/readme.md',
    title: 'readme.md',
    sourceUrl: 'https://github.com/FrontAgent/FrontAgent/blob/develop/docs/readme.md',
    extension: '.md',
    topLevelDir: 'docs',
    contentHash: 'docs-hash',
    chunkIds: ['chunk:readme:0'],
  });
  const primaryChunk = makeChunk();
  const docsChunk = makeChunk({
    id: 'chunk:readme:0',
    documentId: 'doc:readme',
    path: 'docs/readme.md',
    sourceUrl: 'https://github.com/FrontAgent/FrontAgent/blob/develop/docs/readme.md',
    title: 'readme.md',
    text: 'Hybrid docs mention repository concepts but not the handler implementation.',
    keywordText: 'docs/readme.md hybrid repository concepts',
    contentHash: 'docs-chunk-hash',
    tokenCount: 7,
    termFrequency: {
      hybrid: 1,
      repository: 1,
      concepts: 1,
    },
    metadata: {
      extension: '.md',
      topLevelDir: 'docs',
      chunkIndex: 0,
      totalChunks: 1,
      lineStart: 1,
      lineEnd: 1,
    },
  });

  return {
    version: INDEX_VERSION,
    source: {
      repoUrl: 'https://github.com/FrontAgent/FrontAgent.git',
      branch: 'develop',
      syncedAt: '2026-06-08T00:00:00.000Z',
      revision: 'test-revision',
      repoDir,
      indexedFiles: 2,
      indexedChunks: 2,
      excludedPathPrefixes: [],
      excludedSubmodulePaths: [],
    },
    build: {
      chunkSize: 1200,
      chunkOverlap: 200,
      maxFileSizeBytes: 256 * 1024,
      chunkingStrategy: 'semantic-v2',
      chunkSignature: 'test-signature',
    },
    bm25: {
      documentCount: 2,
      averageDocumentLength: 8.5,
      documentFrequency: {
        hybrid: 2,
        repository: 2,
        handler: 1,
        query: 1,
        validates: 1,
        concepts: 1,
      },
    },
    documents: [primaryDocument, docsDocument],
    chunks: [primaryChunk, docsChunk],
  };
}

async function createFixture(overrides: Partial<KnowledgeBaseConfig> = {}) {
  const cacheDir = await mkdtemp(join(tmpdir(), 'frontagent-rag-kb-'));
  tempDirs.push(cacheDir);
  const repoDir = join(cacheDir, 'repo');
  await mkdir(repoDir, { recursive: true });
  const index = makeIndex(repoDir);
  await writeFile(join(cacheDir, 'index.json'), JSON.stringify(index), 'utf-8');

  const kb = new HybridRepositoryKnowledgeBase({
    repoUrl: index.source.repoUrl,
    branch: index.source.branch,
    cacheDir,
    embedding: { enabled: false },
    reranker: { enabled: false },
    ...overrides,
  });

  return { cacheDir, index, kb };
}

describe('HybridRepositoryKnowledgeBase', () => {
  it('rejects blank queries before reading the index', async () => {
    const { kb } = await createFixture();

    await expect(kb.query({ query: '   ' })).resolves.toEqual({
      success: false,
      error: 'query is required',
    });
  });

  it('rejects unsafe metadata filter paths', async () => {
    const { kb } = await createFixture();

    await expect(
      kb.query({ query: 'handler', filters: { pathPrefixes: ['../src'] } }),
    ).resolves.toEqual({
      success: false,
      error: 'Unsafe RAG metadata filter path: ../src',
    });
  });

  it('returns keyword-only results from a warm repository index', async () => {
    const { kb } = await createFixture();

    const result = await kb.query({
      query: 'hybrid repository handler',
      maxResults: 2,
      filters: { topLevelDirs: ['src'], extensions: ['.ts'] },
    });

    expect(result.success).toBe(true);
    expect(result.searchMode).toBe('keyword_only');
    expect(result.reranked).toBe(false);
    expect(result.warnings).toBeUndefined();
    expect(result.results).toHaveLength(1);
    expect(result.results?.[0]).toMatchObject({
      path: 'src/rag/knowledge-base.ts',
      title: 'knowledge-base.ts',
      metadata: {
        topLevelDir: 'src',
        extension: '.ts',
        chunkIndex: 0,
        lineStart: 1,
        lineEnd: 3,
      },
    });
    expect(result.timing?.cacheHit).toBe(false);
  });

  it('marks repeated equivalent queries as cache hits', async () => {
    const { kb } = await createFixture();

    const first = await kb.query({ query: 'hybrid repository handler', maxResults: 1 });
    const second = await kb.query({ query: 'hybrid repository handler', maxResults: 1 });

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(first.timing?.cacheHit).toBe(false);
    expect(second.timing?.cacheHit).toBe(true);
    expect(second.results).toEqual(first.results);
    expect(second.sourceRevision).toBe(first.sourceRevision);
  });

  it('falls back to keyword-only search with a warning when embeddings lack an API key', async () => {
    const { index, kb } = await createFixture({
      embedding: { enabled: true, apiKey: '' },
    });

    const result = await kb.query({ query: 'hybrid repository handler' });

    expect(result.success).toBe(true);
    expect(result.sourceRevision).toBe(index.source.revision);
    expect(result.searchMode).toBe('keyword_only');
    expect(result.results?.[0]?.path).toBe('src/rag/knowledge-base.ts');
    expect(result.warnings).toContain(
      'Embedding API key is not configured; keyword-only search was used.',
    );
  });
});
