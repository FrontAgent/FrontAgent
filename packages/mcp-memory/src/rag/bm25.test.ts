import { describe, expect, it } from 'vitest';
import {
  aggregateChunkCandidates,
  buildSnippet,
  matchesMetadataFilter,
  searchBm25,
  tokenize,
} from './bm25.js';
import type { RepositoryChunk, RepositoryDocument, RepositoryIndex } from './types.js';
import { INDEX_VERSION } from './types.js';

function makeChunk(overrides: Partial<RepositoryChunk> = {}): RepositoryChunk {
  return {
    id: 'chunk:test:0',
    documentId: 'doc:test',
    path: 'src/index.ts',
    sourceUrl: 'https://example.com/blob/main/src/index.ts',
    title: 'index.ts',
    text: 'function hello() { return "world"; }',
    keywordText: 'src/index.ts\nfunction hello() { return "world"; }',
    contentHash: 'abc123',
    tokenCount: 5,
    termFrequency: { hello: 1, function: 1, world: 1, return: 1, 'src/index.ts': 1 },
    metadata: {
      extension: '.ts',
      topLevelDir: 'src',
      chunkIndex: 0,
      totalChunks: 1,
      lineStart: 1,
      lineEnd: 1,
    },
    ...overrides,
  };
}

function makeDocument(overrides: Partial<RepositoryDocument> = {}): RepositoryDocument {
  return {
    id: 'doc:test',
    path: 'src/index.ts',
    title: 'index.ts',
    sourceUrl: 'https://example.com/blob/main/src/index.ts',
    extension: '.ts',
    topLevelDir: 'src',
    sizeBytes: 100,
    contentHash: 'abc123',
    chunkIds: ['chunk:test:0'],
    ...overrides,
  };
}

function makeIndex(chunks: RepositoryChunk[], documents: RepositoryDocument[]): RepositoryIndex {
  const documentFrequency: Record<string, number> = {};
  let totalLength = 0;
  for (const chunk of chunks) {
    for (const token of Object.keys(chunk.termFrequency)) {
      documentFrequency[token] = (documentFrequency[token] ?? 0) + 1;
    }
    totalLength += chunk.tokenCount;
  }
  return {
    version: INDEX_VERSION,
    source: {
      repoUrl: 'https://example.com/repo.git',
      branch: 'main',
      syncedAt: '2024-01-01T00:00:00Z',
      revision: 'abc123',
      repoDir: '/tmp/repo',
      indexedFiles: documents.length,
      indexedChunks: chunks.length,
      excludedPathPrefixes: [],
      excludedSubmodulePaths: [],
    },
    build: {
      chunkSize: 1200,
      chunkOverlap: 200,
      maxFileSizeBytes: 256 * 1024,
      chunkingStrategy: 'semantic-v2',
      chunkSignature: 'sig',
    },
    bm25: {
      documentCount: chunks.length,
      averageDocumentLength: chunks.length > 0 ? totalLength / chunks.length : 0,
      documentFrequency,
    },
    documents,
    chunks,
  };
}

describe('tokenize', () => {
  it('lowercases and splits on word boundaries', () => {
    const tokens = tokenize('Hello World');
    expect(tokens).toContain('hello');
    expect(tokens).toContain('world');
  });

  it('splits camelCase identifiers', () => {
    const tokens = tokenize('getUserName');
    expect(tokens).toContain('get');
    expect(tokens).toContain('user');
    expect(tokens).toContain('name');
  });

  it('splits snake_case identifiers', () => {
    const tokens = tokenize('get_user_name');
    expect(tokens).toContain('get');
    expect(tokens).toContain('user');
    expect(tokens).toContain('name');
  });

  it('deduplicates tokens', () => {
    const tokens = tokenize('hello hello hello');
    expect(tokens.filter((t) => t === 'hello')).toHaveLength(1);
  });

  it('skips single-character tokens', () => {
    const tokens = tokenize('a b c de fg');
    expect(tokens).not.toContain('a');
    expect(tokens).not.toContain('b');
    expect(tokens).toContain('de');
    expect(tokens).toContain('fg');
  });

  it('handles CJK bigrams', () => {
    const tokens = tokenize('知识库');
    expect(tokens).toContain('知识');
    expect(tokens).toContain('识库');
  });

  it('returns empty for empty input', () => {
    expect(tokenize('')).toEqual([]);
  });
});

describe('searchBm25', () => {
  it('returns matching chunks ranked by score', () => {
    const chunk1 = makeChunk({
      id: 'chunk:a:0',
      termFrequency: { hello: 3, world: 1 },
      tokenCount: 10,
    });
    const chunk2 = makeChunk({
      id: 'chunk:b:0',
      termFrequency: { hello: 1, foo: 2 },
      tokenCount: 10,
    });
    const doc = makeDocument();
    const index = makeIndex([chunk1, chunk2], [doc]);

    const results = searchBm25(index, 'hello', 10);
    expect(results.length).toBe(2);
    expect(results[0].chunk.id).toBe('chunk:a:0');
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it('returns empty for no matches', () => {
    const chunk = makeChunk({ termFrequency: { foo: 1 } });
    const doc = makeDocument();
    const index = makeIndex([chunk], [doc]);

    const results = searchBm25(index, 'nonexistent', 10);
    expect(results).toHaveLength(0);
  });

  it('returns empty for empty query', () => {
    const chunk = makeChunk();
    const doc = makeDocument();
    const index = makeIndex([chunk], [doc]);

    const results = searchBm25(index, '', 10);
    expect(results).toHaveLength(0);
  });

  it('respects limit', () => {
    const chunks = Array.from({ length: 5 }, (_, i) =>
      makeChunk({
        id: `chunk:${i}:0`,
        termFrequency: { hello: i + 1 },
        tokenCount: 10,
      }),
    );
    const doc = makeDocument();
    const index = makeIndex(chunks, [doc]);

    const results = searchBm25(index, 'hello', 2);
    expect(results).toHaveLength(2);
  });
});

describe('matchesMetadataFilter', () => {
  const chunk = makeChunk({
    path: 'src/utils/helper.ts',
    metadata: {
      extension: '.ts',
      topLevelDir: 'src',
      chunkIndex: 0,
      totalChunks: 1,
      lineStart: 1,
      lineEnd: 10,
    },
  });

  it('returns true when no filters', () => {
    expect(matchesMetadataFilter(chunk, undefined)).toBe(true);
    expect(matchesMetadataFilter(chunk, {})).toBe(true);
  });

  it('filters by topLevelDirs', () => {
    expect(matchesMetadataFilter(chunk, { topLevelDirs: ['src'] })).toBe(true);
    expect(matchesMetadataFilter(chunk, { topLevelDirs: ['docs'] })).toBe(false);
  });

  it('filters by extensions', () => {
    expect(matchesMetadataFilter(chunk, { extensions: ['.ts', '.js'] })).toBe(true);
    expect(matchesMetadataFilter(chunk, { extensions: ['.py'] })).toBe(false);
  });

  it('filters by pathPrefixes', () => {
    expect(matchesMetadataFilter(chunk, { pathPrefixes: ['src/utils'] })).toBe(true);
    expect(matchesMetadataFilter(chunk, { pathPrefixes: ['docs/'] })).toBe(false);
  });

  it('filters by excludePathPrefixes', () => {
    expect(matchesMetadataFilter(chunk, { excludePathPrefixes: ['src/utils'] })).toBe(false);
    expect(matchesMetadataFilter(chunk, { excludePathPrefixes: ['docs/'] })).toBe(true);
  });
});

describe('aggregateChunkCandidates', () => {
  it('picks best chunk per document', () => {
    const doc = makeDocument({ id: 'doc:file' });
    const chunk1 = makeChunk({ id: 'chunk:file:0', documentId: 'doc:file' });
    const chunk2 = makeChunk({ id: 'chunk:file:1', documentId: 'doc:file' });
    const index = makeIndex([chunk1, chunk2], [doc]);

    const candidates = aggregateChunkCandidates(
      [
        { chunk: chunk1, score: 5 },
        { chunk: chunk2, score: 10 },
      ],
      index,
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0].chunk.id).toBe('chunk:file:1');
    expect(candidates[0].score).toBe(10);
  });

  it('applies metadata filters', () => {
    const doc = makeDocument({ id: 'doc:file' });
    const chunk = makeChunk({
      id: 'chunk:file:0',
      documentId: 'doc:file',
      metadata: {
        extension: '.ts',
        topLevelDir: 'src',
        chunkIndex: 0,
        totalChunks: 1,
        lineStart: 1,
        lineEnd: 5,
      },
    });
    const index = makeIndex([chunk], [doc]);

    const withMatch = aggregateChunkCandidates([{ chunk, score: 5 }], index, {
      topLevelDirs: ['src'],
    });
    expect(withMatch).toHaveLength(1);

    const withoutMatch = aggregateChunkCandidates([{ chunk, score: 5 }], index, {
      topLevelDirs: ['docs'],
    });
    expect(withoutMatch).toHaveLength(0);
  });
});

describe('buildSnippet', () => {
  it('returns text around the first matching token', () => {
    const text = `${'a'.repeat(200)}targetWord${'b'.repeat(200)}`;
    const snippet = buildSnippet(text, 'targetWord');
    expect(snippet).toContain('targetWord');
    expect(snippet.length).toBeLessThan(text.length);
  });

  it('falls back to first 320 chars when no match', () => {
    const text = 'x'.repeat(500);
    const snippet = buildSnippet(text, 'nonexistent_query_xyz');
    expect(snippet).toHaveLength(320);
  });

  it('handles short text', () => {
    const text = 'short text';
    const snippet = buildSnippet(text, 'short');
    expect(snippet).toBe('short text');
  });
});
