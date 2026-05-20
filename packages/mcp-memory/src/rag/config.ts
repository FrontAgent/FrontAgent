import { resolve } from 'node:path';

import type { KnowledgeBaseConfig, RagMetadataFilter, RequiredHybridConfig } from './types.js';
import {
  DEFAULT_CHUNK_OVERLAP,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_EMBEDDING_BATCH_SIZE,
  DEFAULT_EMBEDDING_DIMENSIONS,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_EXCLUDED_PATH_PREFIXES,
  DEFAULT_FETCH_TIMEOUT_MS,
  DEFAULT_KEYWORD_CANDIDATES,
  DEFAULT_MAX_FILE_SIZE_BYTES,
  DEFAULT_MAX_RESULTS,
  DEFAULT_RERANKER_CANDIDATE_COUNT,
  DEFAULT_RERANKER_MAX_DOCUMENT_CHARS,
  DEFAULT_SEMANTIC_CANDIDATES,
  DEFAULT_VECTOR_STORE_PROVIDER,
  DEFAULT_WEAVIATE_BATCH_SIZE,
  DEFAULT_WEAVIATE_COLLECTION_PREFIX,
} from './types.js';
import {
  normalizeEmbeddingBaseUrl,
  normalizeOptionalBaseUrl,
  parseOptionalBoolean,
  parseOptionalInt,
  parseStringList,
} from './utils.js';

export function normalizeConfig(config: KnowledgeBaseConfig): RequiredHybridConfig {
  const embeddingProvider = config.embedding?.provider ?? 'openai-compatible';
  const embeddingBaseURL = normalizeEmbeddingBaseUrl(
    config.embedding?.baseURL ??
      process.env.FRONTAGENT_RAG_EMBEDDING_BASE_URL ??
      process.env.OPENAI_BASE_URL ??
      process.env.BASE_URL ??
      'https://api.openai.com/v1',
  );
  const embeddingApiKey =
    config.embedding?.apiKey ??
    process.env.FRONTAGENT_RAG_EMBEDDING_API_KEY ??
    process.env.OPENAI_API_KEY ??
    process.env.API_KEY ??
    '';
  const vectorStoreProvider =
    config.vectorStore?.provider ??
    (process.env.FRONTAGENT_RAG_VECTOR_STORE_PROVIDER as 'local' | 'weaviate' | undefined) ??
    (process.env.FRONTAGENT_RAG_WEAVIATE_URL ? 'weaviate' : undefined) ??
    DEFAULT_VECTOR_STORE_PROVIDER;
  const weaviateBaseURL =
    config.vectorStore?.weaviate?.baseURL ?? process.env.FRONTAGENT_RAG_WEAVIATE_URL ?? '';
  const weaviateApiKey =
    config.vectorStore?.weaviate?.apiKey ?? process.env.FRONTAGENT_RAG_WEAVIATE_API_KEY ?? '';
  const rerankerBaseURL =
    config.reranker?.baseURL ?? process.env.FRONTAGENT_RAG_RERANKER_BASE_URL ?? '';
  const rerankerApiKey =
    config.reranker?.apiKey ?? process.env.FRONTAGENT_RAG_RERANKER_API_KEY ?? '';

  return {
    repoUrl: config.repoUrl,
    branch: config.branch,
    cacheDir: resolve(config.cacheDir),
    syncOnQuery:
      config.syncOnQuery ?? parseOptionalBoolean(process.env.FRONTAGENT_RAG_SYNC_ON_QUERY) ?? false,
    maxResults: config.maxResults ?? DEFAULT_MAX_RESULTS,
    excludedPathPrefixes:
      config.excludedPathPrefixes ??
      parseStringList(process.env.FRONTAGENT_RAG_EXCLUDE_PATHS) ??
      DEFAULT_EXCLUDED_PATH_PREFIXES,
    keywordCandidateCount: config.keywordCandidateCount ?? DEFAULT_KEYWORD_CANDIDATES,
    semanticCandidateCount: config.semanticCandidateCount ?? DEFAULT_SEMANTIC_CANDIDATES,
    keywordWeight: config.keywordWeight ?? 0.45,
    semanticWeight: config.semanticWeight ?? 0.55,
    chunkSize: config.chunkSize ?? DEFAULT_CHUNK_SIZE,
    chunkOverlap: config.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP,
    maxFileSizeBytes: config.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES,
    reranker: {
      enabled: config.reranker?.enabled ?? false,
      provider: config.reranker?.provider ?? 'jina-compatible',
      model: config.reranker?.model ?? process.env.FRONTAGENT_RAG_RERANKER_MODEL ?? '',
      baseURL: normalizeOptionalBaseUrl(rerankerBaseURL) ?? '',
      apiKey: rerankerApiKey,
      candidateCount:
        config.reranker?.candidateCount ??
        parseOptionalInt(process.env.FRONTAGENT_RAG_RERANKER_CANDIDATE_COUNT) ??
        DEFAULT_RERANKER_CANDIDATE_COUNT,
      maxDocumentChars:
        config.reranker?.maxDocumentChars ??
        parseOptionalInt(process.env.FRONTAGENT_RAG_RERANKER_MAX_DOCUMENT_CHARS) ??
        DEFAULT_RERANKER_MAX_DOCUMENT_CHARS,
      requestTimeoutMs:
        config.reranker?.requestTimeoutMs ??
        parseOptionalInt(process.env.FRONTAGENT_RAG_RERANKER_TIMEOUT_MS) ??
        DEFAULT_FETCH_TIMEOUT_MS,
    },
    embedding: {
      enabled: config.embedding?.enabled ?? true,
      provider: embeddingProvider,
      model:
        config.embedding?.model ??
        process.env.FRONTAGENT_RAG_EMBEDDING_MODEL ??
        DEFAULT_EMBEDDING_MODEL,
      baseURL: embeddingBaseURL,
      apiKey: embeddingApiKey,
      dimensions:
        config.embedding?.dimensions ??
        parseOptionalInt(process.env.FRONTAGENT_RAG_EMBEDDING_DIMENSIONS) ??
        DEFAULT_EMBEDDING_DIMENSIONS,
      batchSize:
        config.embedding?.batchSize ??
        parseOptionalInt(process.env.FRONTAGENT_RAG_EMBEDDING_BATCH_SIZE) ??
        DEFAULT_EMBEDDING_BATCH_SIZE,
      requestTimeoutMs:
        config.embedding?.requestTimeoutMs ??
        parseOptionalInt(process.env.FRONTAGENT_RAG_EMBEDDING_TIMEOUT_MS) ??
        DEFAULT_FETCH_TIMEOUT_MS,
    },
    vectorStore: {
      provider: vectorStoreProvider,
      weaviate: {
        baseURL: normalizeOptionalBaseUrl(weaviateBaseURL) ?? '',
        apiKey: weaviateApiKey,
        collectionPrefix:
          config.vectorStore?.weaviate?.collectionPrefix ??
          process.env.FRONTAGENT_RAG_WEAVIATE_COLLECTION_PREFIX ??
          DEFAULT_WEAVIATE_COLLECTION_PREFIX,
        batchSize:
          config.vectorStore?.weaviate?.batchSize ??
          parseOptionalInt(process.env.FRONTAGENT_RAG_WEAVIATE_BATCH_SIZE) ??
          DEFAULT_WEAVIATE_BATCH_SIZE,
        requestTimeoutMs:
          config.vectorStore?.weaviate?.requestTimeoutMs ??
          parseOptionalInt(process.env.FRONTAGENT_RAG_WEAVIATE_TIMEOUT_MS) ??
          DEFAULT_FETCH_TIMEOUT_MS,
      },
    },
  };
}

export function normalizeFiltersForCache(
  filters?: RagMetadataFilter,
): RagMetadataFilter | undefined {
  if (!filters) return undefined;
  const normalizeList = (values?: string[]) => (values ? [...values].sort() : undefined);
  return {
    topLevelDirs: normalizeList(filters.topLevelDirs),
    extensions: normalizeList(filters.extensions),
    pathPrefixes: normalizeList(filters.pathPrefixes),
    excludePathPrefixes: normalizeList(filters.excludePathPrefixes),
  };
}

export function validateMetadataFilters(filters?: RagMetadataFilter): string | undefined {
  if (!filters) return undefined;

  const pathValues = [
    ...(filters.pathPrefixes ?? []),
    ...(filters.excludePathPrefixes ?? []),
    ...(filters.topLevelDirs ?? []),
  ];

  for (const value of pathValues) {
    if (value.startsWith('/') || value.split(/[\\/]+/).includes('..')) {
      return `Unsafe RAG metadata filter path: ${value}`;
    }
  }

  return undefined;
}
