export const INDEX_VERSION = 5;
export const EMBEDDING_STORE_VERSION = 3;
export const VECTOR_STORE_STATE_VERSION = 2;
export const DEFAULT_MAX_RESULTS = 5;
export const DEFAULT_KEYWORD_CANDIDATES = 40;
export const DEFAULT_SEMANTIC_CANDIDATES = 40;
export const DEFAULT_CHUNK_SIZE = 1200;
export const DEFAULT_CHUNK_OVERLAP = 200;
export const DEFAULT_MAX_FILE_SIZE_BYTES = 256 * 1024;
export const DEFAULT_FETCH_TIMEOUT_MS = 30000;
export const DEFAULT_EMBEDDING_BATCH_SIZE = 4;
export const DEFAULT_EMBEDDING_MAX_BATCH_TOKENS = 6000;
export const DEFAULT_EMBEDDING_MAX_INPUT_CHARS = 4000;
export const DEFAULT_RERANKER_CANDIDATE_COUNT = 20;
export const DEFAULT_RERANKER_MAX_DOCUMENT_CHARS = 1800;
export const DEFAULT_EMBEDDING_MAX_RETRIES = 6;
export const DEFAULT_EMBEDDING_RETRY_BASE_DELAY_MS = 1500;
export const DEFAULT_EMBEDDING_INTER_BATCH_DELAY_MS = 250;
export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
export const DEFAULT_EMBEDDING_DIMENSIONS = 512;
export const DEFAULT_VECTOR_STORE_PROVIDER = 'local';
export const DEFAULT_WEAVIATE_COLLECTION_PREFIX = 'FrontAgentRagChunk';
export const DEFAULT_WEAVIATE_BATCH_SIZE = 64;
export const DEFAULT_RAG_QUERY_CACHE_SIZE = 100;
export const DEFAULT_EXCLUDED_PATH_PREFIXES: string[] = [];

export const IGNORED_DIR_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
]);

export const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.bmp',
  '.tiff',
  '.svg',
  '.pdf',
  '.zip',
  '.gz',
  '.tgz',
  '.7z',
  '.rar',
  '.mp3',
  '.mp4',
  '.mov',
  '.avi',
  '.mkv',
  '.wav',
  '.ogg',
  '.flac',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.otf',
  '.class',
  '.jar',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.bin',
  '.wasm',
  '.psd',
  '.drawio',
  '.sqlite',
  '.db',
  '.lock',
  '.map',
]);

export type KnowledgeBaseSource = 'git' | 'openviking' | 'composite';

export interface OpenVikingConfig {
  enabled?: boolean;
  endpoint?: string;
  apiKey?: string;
  corpus?: string;
  namespace?: string;
  l1Entry?: string;
  timeoutMs?: number;
  fallbackToGit?: boolean;
}

export interface KnowledgeBaseConfig {
  source?: KnowledgeBaseSource;
  repoUrl: string;
  branch: string;
  cacheDir: string;
  syncOnQuery?: boolean;
  maxResults?: number;
  excludedPathPrefixes?: string[];
  keywordCandidateCount?: number;
  semanticCandidateCount?: number;
  keywordWeight?: number;
  semanticWeight?: number;
  chunkSize?: number;
  chunkOverlap?: number;
  maxFileSizeBytes?: number;
  openViking?: OpenVikingConfig;
  reranker?: RerankerConfig;
  embedding?: EmbeddingConfig;
  vectorStore?: VectorStoreConfig;
}

export interface EmbeddingConfig {
  enabled?: boolean;
  provider?: 'openai-compatible';
  model?: string;
  baseURL?: string;
  apiKey?: string;
  dimensions?: number;
  batchSize?: number;
  requestTimeoutMs?: number;
}

export interface RerankerConfig {
  enabled?: boolean;
  provider?: 'jina-compatible';
  model?: string;
  baseURL?: string;
  apiKey?: string;
  candidateCount?: number;
  maxDocumentChars?: number;
  requestTimeoutMs?: number;
}

export interface VectorStoreConfig {
  provider?: 'local' | 'weaviate';
  weaviate?: WeaviateVectorStoreConfig;
}

export interface WeaviateVectorStoreConfig {
  baseURL?: string;
  apiKey?: string;
  collectionPrefix?: string;
  batchSize?: number;
  requestTimeoutMs?: number;
}

export interface RagMetadataFilter {
  topLevelDirs?: string[];
  extensions?: string[];
  pathPrefixes?: string[];
  excludePathPrefixes?: string[];
}

export interface RagQueryParams {
  query: string;
  maxResults?: number;
  refresh?: boolean;
  filters?: RagMetadataFilter;
}

export interface RagQueryMatch {
  id: string;
  type: 'file' | 'wiki' | 'doc';
  title: string;
  sourceUrl: string;
  snippet: string;
  score: number;
  path: string;
  keywordScore?: number;
  semanticScore?: number;
  rerankScore?: number;
  metadata: {
    topLevelDir: string;
    extension: string;
    chunkIndex: number;
    lineStart: number;
    lineEnd: number;
    provider?: 'git' | 'openviking';
    corpus?: string;
    namespace?: string;
    l1Entry?: string;
    [key: string]: unknown;
  };
}

export interface RagQueryTiming {
  ensureIndexMs: number;
  bm25Ms: number;
  semanticMs: number;
  fusionMs: number;
  rerankMs: number;
  totalMs: number;
  cacheHit: boolean;
}

export interface RagQueryResult {
  success: boolean;
  syncedAt?: string;
  sourceRevision?: string;
  results?: RagQueryMatch[];
  warnings?: string[];
  searchMode?: 'hybrid' | 'keyword_only' | 'openviking' | 'composite';
  reranked?: boolean;
  timing?: RagQueryTiming;
  error?: string;
}

export interface KnowledgeProvider {
  query(params: RagQueryParams): Promise<RagQueryResult>;
}

export interface RepositoryIndex {
  version: typeof INDEX_VERSION;
  source: {
    repoUrl: string;
    branch: string;
    syncedAt: string;
    revision: string;
    repoDir: string;
    indexedFiles: number;
    indexedChunks: number;
    excludedPathPrefixes: string[];
    excludedSubmodulePaths: string[];
  };
  build: {
    chunkSize: number;
    chunkOverlap: number;
    maxFileSizeBytes: number;
    chunkingStrategy: string;
    chunkSignature: string;
  };
  bm25: {
    documentCount: number;
    averageDocumentLength: number;
    documentFrequency: Record<string, number>;
  };
  documents: RepositoryDocument[];
  chunks: RepositoryChunk[];
}

export interface RepositoryDocument {
  id: string;
  path: string;
  title: string;
  sourceUrl: string;
  extension: string;
  topLevelDir: string;
  sizeBytes: number;
  contentHash: string;
  chunkIds: string[];
}

export interface RepositoryChunk {
  id: string;
  documentId: string;
  path: string;
  sourceUrl: string;
  title: string;
  text: string;
  keywordText: string;
  contentHash: string;
  tokenCount: number;
  termFrequency: Record<string, number>;
  metadata: {
    extension: string;
    topLevelDir: string;
    chunkIndex: number;
    totalChunks: number;
    lineStart: number;
    lineEnd: number;
  };
}

export interface EmbeddingStore {
  version: typeof EMBEDDING_STORE_VERSION;
  model: string;
  baseURL: string;
  dimensions?: number;
  updatedAt: string;
  vectors: Record<
    string,
    {
      contentHash: string;
      vector: number[];
    }
  >;
}

export interface WeaviateVectorStoreState {
  version: typeof VECTOR_STORE_STATE_VERSION;
  provider: 'weaviate';
  collectionName: string;
  repoUrl: string;
  branch: string;
  revision: string;
  embeddingModel: string;
  embeddingBaseURL: string;
  dimensions?: number;
  indexedChunks: number;
  chunkSignature: string;
  updatedAt: string;
}

export interface ChunkCandidate {
  chunk: RepositoryChunk;
  score: number;
}

export interface DocumentCandidate {
  document: RepositoryDocument;
  chunk: RepositoryChunk;
  score: number;
  rank: number;
  keywordScore?: number;
  semanticScore?: number;
  rerankScore?: number;
}

export interface RequiredOpenVikingConfig {
  enabled: boolean;
  endpoint: string;
  apiKey: string;
  corpus: string;
  namespace: string;
  l1Entry: string;
  timeoutMs: number;
}

export type RequiredHybridConfig = {
  repoUrl: string;
  branch: string;
  cacheDir: string;
  syncOnQuery: boolean;
  maxResults: number;
  excludedPathPrefixes: string[];
  keywordCandidateCount: number;
  semanticCandidateCount: number;
  keywordWeight: number;
  semanticWeight: number;
  chunkSize: number;
  chunkOverlap: number;
  maxFileSizeBytes: number;
  reranker: Required<RerankerConfig>;
  embedding: Required<EmbeddingConfig>;
  vectorStore: {
    provider: 'local' | 'weaviate';
    weaviate: Required<WeaviateVectorStoreConfig>;
  };
};
