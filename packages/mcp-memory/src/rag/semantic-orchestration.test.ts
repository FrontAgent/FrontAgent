import { describe, expect, it } from 'vitest';

import { normalizeConfig } from './config.js';
import { runSemanticSearchOrchestration } from './semantic-orchestration.js';
import type {
  EmbeddingStore,
  KnowledgeBaseConfig,
  RepositoryChunk,
  RepositoryDocument,
  RepositoryIndex,
  RequiredHybridConfig,
} from './types.js';
import { EMBEDDING_STORE_VERSION, INDEX_VERSION } from './types.js';

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

function makeIndex(): RepositoryIndex {
  const document = makeDocument();
  const chunk = makeChunk();
  return {
    version: INDEX_VERSION,
    source: {
      repoUrl: 'https://github.com/FrontAgent/FrontAgent.git',
      branch: 'develop',
      syncedAt: '2026-06-08T00:00:00.000Z',
      revision: 'test-revision',
      repoDir: '/tmp/frontagent-rag-test',
      indexedFiles: 1,
      indexedChunks: 1,
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
      documentCount: 1,
      averageDocumentLength: 10,
      documentFrequency: {
        hybrid: 1,
        repository: 1,
      },
    },
    documents: [document],
    chunks: [chunk],
  };
}

function makeConfig(
  index: RepositoryIndex,
  overrides: Partial<KnowledgeBaseConfig> = {},
): RequiredHybridConfig {
  const baseConfig: KnowledgeBaseConfig = {
    repoUrl: index.source.repoUrl,
    branch: index.source.branch,
    cacheDir: '/tmp/frontagent-rag-test-cache',
    embedding: {
      enabled: true,
      apiKey: 'test-api-key',
      baseURL: 'https://embedding.example/v1',
    },
    reranker: { enabled: false },
  };

  return normalizeConfig({ ...baseConfig, ...overrides });
}

function makeEmbeddingStore(index: RepositoryIndex, config: RequiredHybridConfig): EmbeddingStore {
  return {
    version: EMBEDDING_STORE_VERSION,
    model: config.embedding.model,
    baseURL: config.embedding.baseURL,
    dimensions: config.embedding.dimensions,
    updatedAt: '2026-06-08T00:00:00.000Z',
    vectors: {
      [index.chunks[0].id]: {
        contentHash: index.chunks[0].contentHash,
        vector: [1, 0],
      },
    },
  };
}

describe('runSemanticSearchOrchestration', () => {
  it('returns keyword-only warning when embedding API key is missing', async () => {
    const index = makeIndex();
    const config = makeConfig(index, {
      embedding: {
        enabled: true,
        apiKey: '',
      },
    });

    const result = await runSemanticSearchOrchestration({
      queryText: 'hybrid repository handler',
      index,
      config,
      ensureEmbeddings: async () => {
        throw new Error('ensureEmbeddings should not be called');
      },
      readEmbeddingStore: async () => {
        throw new Error('readEmbeddingStore should not be called');
      },
      ensureWeaviateSemanticIndex: async () => {
        throw new Error('ensureWeaviateSemanticIndex should not be called');
      },
      weaviateCollectionName: 'FrontAgentRagChunkTest',
    });

    expect(result).toEqual({
      semanticDocumentCandidates: [],
      searchMode: 'keyword_only',
      warnings: ['Embedding API key is not configured; keyword-only search was used.'],
    });
  });

  it('returns keyword-only warning when Weaviate base URL is missing', async () => {
    const index = makeIndex();
    const config = makeConfig(index, {
      vectorStore: {
        provider: 'weaviate',
        weaviate: {
          baseURL: '',
        },
      },
    });

    const result = await runSemanticSearchOrchestration({
      queryText: 'hybrid repository handler',
      index,
      config,
      ensureEmbeddings: async () => {
        throw new Error('ensureEmbeddings should not be called');
      },
      readEmbeddingStore: async () => {
        throw new Error('readEmbeddingStore should not be called');
      },
      ensureWeaviateSemanticIndex: async () => {
        throw new Error('ensureWeaviateSemanticIndex should not be called');
      },
      weaviateCollectionName: 'FrontAgentRagChunkTest',
    });

    expect(result).toEqual({
      semanticDocumentCandidates: [],
      searchMode: 'keyword_only',
      warnings: ['Weaviate base URL is not configured; keyword-only search was used.'],
    });
  });

  it('uses compatible partial embedding cache after local semantic index build failure', async () => {
    const index = makeIndex();
    const config = makeConfig(index);
    const cachedStore = makeEmbeddingStore(index, config);

    const result = await runSemanticSearchOrchestration({
      queryText: 'hybrid repository handler',
      index,
      filters: { topLevelDirs: ['src'] },
      config,
      ensureEmbeddings: async () => {
        throw new Error('embedding build failed');
      },
      readEmbeddingStore: async () => cachedStore,
      ensureWeaviateSemanticIndex: async () => {
        throw new Error('weaviate should not be used');
      },
      searchLocalSemantic: async () => [{ chunk: index.chunks[0], score: 0.9 }],
      searchWeaviateSemantic: async () => {
        throw new Error('weaviate should not be searched');
      },
      weaviateCollectionName: 'FrontAgentRagChunkTest',
    });

    expect(result.searchMode).toBe('hybrid');
    expect(result.semanticDocumentCandidates).toHaveLength(1);
    expect(result.semanticDocumentCandidates[0]).toMatchObject({
      document: { id: 'doc:knowledge-base' },
      chunk: { id: 'chunk:knowledge-base:0' },
      score: 0.9,
    });
    expect(result.warnings).toContain(
      'Semantic index build interrupted: embedding build failed Using cached semantic vectors built so far.',
    );
  });

  it('returns keyword-only warning when semantic search finds no candidates', async () => {
    const index = makeIndex();
    const config = makeConfig(index);

    const result = await runSemanticSearchOrchestration({
      queryText: 'hybrid repository handler',
      index,
      config,
      ensureEmbeddings: async () => makeEmbeddingStore(index, config),
      readEmbeddingStore: async () => null,
      ensureWeaviateSemanticIndex: async () => {
        throw new Error('weaviate should not be used');
      },
      searchLocalSemantic: async () => [],
      weaviateCollectionName: 'FrontAgentRagChunkTest',
    });

    expect(result).toEqual({
      semanticDocumentCandidates: [],
      searchMode: 'keyword_only',
      warnings: ['Semantic search returned no candidates; keyword results were used.'],
    });
  });

  it('returns keyword-only warning when local semantic search fails', async () => {
    const index = makeIndex();
    const config = makeConfig(index);

    const result = await runSemanticSearchOrchestration({
      queryText: 'hybrid repository handler',
      index,
      config,
      ensureEmbeddings: async () => makeEmbeddingStore(index, config),
      readEmbeddingStore: async () => null,
      ensureWeaviateSemanticIndex: async () => {
        throw new Error('weaviate should not be used');
      },
      searchLocalSemantic: async () => {
        throw new Error('semantic request failed');
      },
      weaviateCollectionName: 'FrontAgentRagChunkTest',
    });

    expect(result).toEqual({
      semanticDocumentCandidates: [],
      searchMode: 'keyword_only',
      warnings: ['Semantic search unavailable: semantic request failed'],
    });
  });
});
