import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve, extname, basename } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const INDEX_VERSION = 5;
const EMBEDDING_STORE_VERSION = 3;
const VECTOR_STORE_STATE_VERSION = 2;
const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_KEYWORD_CANDIDATES = 40;
const DEFAULT_SEMANTIC_CANDIDATES = 40;
const DEFAULT_CHUNK_SIZE = 1200;
const DEFAULT_CHUNK_OVERLAP = 200;
const DEFAULT_MAX_FILE_SIZE_BYTES = 256 * 1024;
const DEFAULT_FETCH_TIMEOUT_MS = 30000;
const DEFAULT_EMBEDDING_BATCH_SIZE = 4;
const DEFAULT_EMBEDDING_MAX_BATCH_TOKENS = 6000;
const DEFAULT_EMBEDDING_MAX_INPUT_CHARS = 4000;
const DEFAULT_RERANKER_CANDIDATE_COUNT = 20;
const DEFAULT_RERANKER_MAX_DOCUMENT_CHARS = 1800;
const DEFAULT_EMBEDDING_MAX_RETRIES = 6;
const DEFAULT_EMBEDDING_RETRY_BASE_DELAY_MS = 1500;
const DEFAULT_EMBEDDING_INTER_BATCH_DELAY_MS = 250;
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
const DEFAULT_EMBEDDING_DIMENSIONS = 512;
const DEFAULT_VECTOR_STORE_PROVIDER = 'local';
const DEFAULT_WEAVIATE_COLLECTION_PREFIX = 'FrontAgentRagChunk';
const DEFAULT_WEAVIATE_BATCH_SIZE = 64;
const DEFAULT_EXCLUDED_PATH_PREFIXES: string[] = [];
const IGNORED_DIR_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
]);
const BINARY_EXTENSIONS = new Set([
  // Images
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.tiff', '.svg',
  // Documents / archives
  '.pdf', '.zip', '.gz', '.tgz', '.7z', '.rar',
  // Audio / video
  '.mp3', '.mp4', '.mov', '.avi', '.mkv', '.wav', '.ogg', '.flac',
  // Fonts
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  // Compiled / binary
  '.class', '.jar', '.exe', '.dll', '.so', '.dylib', '.bin', '.wasm', '.psd',
  // Data / config with no search value
  '.drawio', '.sqlite', '.db', '.lock',
  // Source maps: large JSON blobs that describe minified code, not useful to index
  '.map',
]);

export interface KnowledgeBaseConfig {
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
  type: 'file';
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
  };
}

export interface RagQueryResult {
  success: boolean;
  syncedAt?: string;
  sourceRevision?: string;
  results?: RagQueryMatch[];
  warnings?: string[];
  searchMode?: 'hybrid' | 'keyword_only';
  reranked?: boolean;
  error?: string;
}

class EmbeddingRequestError extends Error {
  readonly status: number;
  readonly retryAfterMs?: number;

  constructor(message: string, status: number, retryAfterMs?: number) {
    super(message);
    this.name = 'EmbeddingRequestError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

interface RepositoryIndex {
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

interface RepositoryDocument {
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

interface RepositoryChunk {
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

interface EmbeddingStore {
  version: typeof EMBEDDING_STORE_VERSION;
  model: string;
  baseURL: string;
  dimensions?: number;
  updatedAt: string;
  vectors: Record<string, {
    contentHash: string;
    vector: number[];
  }>;
}

interface WeaviateVectorStoreState {
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

interface ChunkCandidate {
  chunk: RepositoryChunk;
  score: number;
}

interface DocumentCandidate {
  document: RepositoryDocument;
  chunk: RepositoryChunk;
  score: number;
  rank: number;
  keywordScore?: number;
  semanticScore?: number;
  rerankScore?: number;
}

export function createKnowledgeBase(config: KnowledgeBaseConfig) {
  return new HybridRepositoryKnowledgeBase(config);
}

export async function ragQuery(
  params: RagQueryParams,
  config: KnowledgeBaseConfig
): Promise<RagQueryResult> {
  const knowledgeBase = createKnowledgeBase(config);
  return knowledgeBase.query(params);
}

export const ragQuerySchema = {
  name: 'rag_query',
  description: 'Query the full repository knowledge base using BM25 + semantic hybrid search with metadata filters.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Natural-language query for the knowledge base',
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of matches to return',
        default: DEFAULT_MAX_RESULTS,
      },
      refresh: {
        type: 'boolean',
        description: 'Force a repository sync and re-index before querying',
        default: false,
      },
      filters: {
        type: 'object',
        description: 'Optional metadata filters applied after keyword and semantic candidate retrieval',
        properties: {
          topLevelDirs: {
            type: 'array',
            items: { type: 'string' },
          },
          extensions: {
            type: 'array',
            items: { type: 'string' },
          },
          pathPrefixes: {
            type: 'array',
            items: { type: 'string' },
          },
          excludePathPrefixes: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
    required: ['query'],
  },
};

class HybridRepositoryKnowledgeBase {
  private readonly config: RequiredHybridConfig;

  constructor(config: KnowledgeBaseConfig) {
    this.config = normalizeConfig(config);
  }

  async query(params: RagQueryParams): Promise<RagQueryResult> {
    if (!params.query?.trim()) {
      return {
        success: false,
        error: 'query is required',
      };
    }

    try {
      const warnings: string[] = [];
      const index = await this.ensureIndex(Boolean(params.refresh));
      const queryText = params.query.trim();
      const maxResults = params.maxResults ?? this.config.maxResults;
      const filters = params.filters;

      const keywordChunkCandidates = searchBm25(
        index,
        queryText,
        this.config.keywordCandidateCount,
      );
      const keywordDocumentCandidates = aggregateChunkCandidates(
        keywordChunkCandidates,
        index,
        filters,
      );

      let semanticDocumentCandidates: DocumentCandidate[] = [];
      let searchMode: RagQueryResult['searchMode'] = 'keyword_only';

      if (this.config.embedding.enabled) {
        if (this.config.embedding.apiKey) {
          if (this.config.vectorStore.provider === 'weaviate') {
            if (!this.config.vectorStore.weaviate.baseURL) {
              warnings.push('Weaviate base URL is not configured; keyword-only search was used.');
            } else {
              try {
                await this.ensureWeaviateSemanticIndex(index);
                const semanticChunkCandidates = await searchSemanticWithWeaviate(
                  queryText,
                  index,
                  this.config.embedding,
                  this.config.vectorStore.weaviate,
                  getWeaviateCollectionName(this.config),
                  this.config.semanticCandidateCount,
                );
                semanticDocumentCandidates = aggregateChunkCandidates(
                  semanticChunkCandidates,
                  index,
                  filters,
                );
                if (semanticDocumentCandidates.length > 0) {
                  searchMode = 'hybrid';
                } else {
                  warnings.push('Semantic search returned no candidates; keyword results were used.');
                }
              } catch (error) {
                warnings.push(
                  `Semantic search unavailable: ${error instanceof Error ? error.message : String(error)}`
                );
              }
            }
          } else {
            let embeddingStore: EmbeddingStore | null = null;
            let usedPartialEmbeddingCache = false;

            try {
              embeddingStore = await this.ensureEmbeddings(index);
            } catch (error) {
              const cachedStore = this.readEmbeddingStore();
              if (cachedStore && isCompatibleEmbeddingStore(cachedStore, this.config.embedding)) {
                embeddingStore = cachedStore;
                usedPartialEmbeddingCache = Object.keys(cachedStore.vectors).length > 0;
              }

              if (!embeddingStore || !usedPartialEmbeddingCache) {
                warnings.push(
                  `Semantic search unavailable: ${error instanceof Error ? error.message : String(error)}`
                );
              } else {
                warnings.push(
                  `Semantic index build interrupted: ${error instanceof Error ? error.message : String(error)} Using cached semantic vectors built so far.`
                );
              }
            }

            if (embeddingStore) {
              try {
                const semanticChunkCandidates = await searchSemantic(
                  queryText,
                  index,
                  embeddingStore,
                  this.config.embedding,
                  this.config.semanticCandidateCount,
                );
                semanticDocumentCandidates = aggregateChunkCandidates(
                  semanticChunkCandidates,
                  index,
                  filters,
                );
                if (semanticDocumentCandidates.length > 0) {
                  searchMode = 'hybrid';
                } else {
                  warnings.push('Semantic search returned no candidates; keyword results were used.');
                }
              } catch (error) {
                warnings.push(
                  `Semantic search unavailable: ${error instanceof Error ? error.message : String(error)}`
                );
              }
            }
          }
        } else {
          warnings.push('Embedding API key is not configured; keyword-only search was used.');
        }
      }

      const fusedResults = fuseDocumentCandidates({
        keywordCandidates: keywordDocumentCandidates,
        semanticCandidates: semanticDocumentCandidates,
        maxResults: Math.max(maxResults, this.config.reranker.candidateCount),
        keywordWeight: this.config.keywordWeight,
        semanticWeight: this.config.semanticWeight,
      });

      let reranked = false;
      let finalResults = fusedResults.slice(0, maxResults);
      if (this.config.reranker.enabled) {
        if (this.config.reranker.model && this.config.reranker.baseURL && this.config.reranker.apiKey) {
          try {
            finalResults = await rerankDocumentCandidates({
              query: queryText,
              candidates: fusedResults,
              maxResults,
              config: this.config.reranker,
            });
            reranked = true;
          } catch (error) {
            warnings.push(
              `Reranking unavailable: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      }

      return {
        success: true,
        syncedAt: index.source.syncedAt,
        sourceRevision: index.source.revision,
        searchMode,
        reranked,
        warnings: warnings.length > 0 ? warnings : undefined,
        results: finalResults.map((result) => ({
          id: result.document.id,
          type: 'file',
          title: result.document.title,
          sourceUrl: result.document.sourceUrl,
          path: result.document.path,
          score: result.score,
          keywordScore: result.keywordScore,
          semanticScore: result.semanticScore,
          rerankScore: result.rerankScore,
          snippet: buildSnippet(result.chunk.text, queryText),
          metadata: {
            topLevelDir: result.chunk.metadata.topLevelDir,
            extension: result.chunk.metadata.extension,
            chunkIndex: result.chunk.metadata.chunkIndex,
            lineStart: result.chunk.metadata.lineStart,
            lineEnd: result.chunk.metadata.lineEnd,
          },
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async ensureIndex(forceRefresh: boolean): Promise<RepositoryIndex> {
    mkdirSync(this.config.cacheDir, { recursive: true });
    const existing = this.readIndex();
    const targetRepoDir = this.getRepoDir();
    const shouldSyncRepository =
      forceRefresh || this.config.syncOnQuery || !existing || !existsSync(targetRepoDir);
    const repoDir = await ensureRepositoryCheckout({
      repoUrl: this.config.repoUrl,
      branch: this.config.branch,
      repoDir: targetRepoDir,
      sync: shouldSyncRepository,
    });
    const revision = await getRepositoryHead(repoDir);
    const submodulePaths = getSubmodulePaths(repoDir);
    const excludedPathPrefixes = [
      ...new Set([...this.config.excludedPathPrefixes, ...submodulePaths].map(normalizeRepoPath)),
    ];

    if (
      existing &&
      canReuseIndex(existing, {
        repoUrl: this.config.repoUrl,
        branch: this.config.branch,
        revision,
        repoDir,
        excludedPathPrefixes,
        excludedSubmodulePaths: submodulePaths,
        chunkSize: this.config.chunkSize,
        chunkOverlap: this.config.chunkOverlap,
        maxFileSizeBytes: this.config.maxFileSizeBytes,
      })
    ) {
      return existing;
    }

    const index = buildRepositoryIndex({
      repoDir,
      repoUrl: this.config.repoUrl,
      branch: this.config.branch,
      revision,
      excludedPathPrefixes,
      excludedSubmodulePaths: submodulePaths,
      chunkSize: this.config.chunkSize,
      chunkOverlap: this.config.chunkOverlap,
      maxFileSizeBytes: this.config.maxFileSizeBytes,
    });
    this.writeIndex(index);
    return index;
  }

  private readIndex(): RepositoryIndex | null {
    const indexPath = this.getIndexPath();
    if (!existsSync(indexPath)) {
      return null;
    }

    try {
      const parsed = JSON.parse(readFileSync(indexPath, 'utf-8')) as RepositoryIndex;
      if (parsed.version !== INDEX_VERSION) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private writeIndex(index: RepositoryIndex): void {
    writeFileSync(this.getIndexPath(), JSON.stringify(index, null, 2), 'utf-8');
  }

  private async ensureEmbeddings(index: RepositoryIndex): Promise<EmbeddingStore> {
    const current = this.readEmbeddingStore();
    const compatible =
      current &&
      current.model === this.config.embedding.model &&
      current.baseURL === this.config.embedding.baseURL &&
      current.dimensions === this.config.embedding.dimensions;

    const store: EmbeddingStore = compatible
      ? current
      : {
          version: EMBEDDING_STORE_VERSION,
          model: this.config.embedding.model,
          baseURL: this.config.embedding.baseURL,
          dimensions: this.config.embedding.dimensions,
          updatedAt: new Date().toISOString(),
          vectors: {},
        };

    const validChunkIds = new Set(index.chunks.map((chunk) => chunk.id));
    for (const chunkId of Object.keys(store.vectors)) {
      if (!validChunkIds.has(chunkId)) {
        delete store.vectors[chunkId];
      }
    }

    const missingChunks = index.chunks.filter((chunk) => {
      const existingVector = store.vectors[chunk.id];
      return !existingVector || existingVector.contentHash !== chunk.contentHash;
    });
    if (missingChunks.length === 0) {
      return store;
    }

    const embeddingInputs = missingChunks.map((chunk) => ({
      chunk,
      inputText: buildEmbeddingInput(chunk),
      estimatedTokens: estimateEmbeddingTokens(buildEmbeddingInput(chunk)),
    }));
    const batches = createEmbeddingBatches(
      embeddingInputs,
      this.config.embedding.batchSize,
      DEFAULT_EMBEDDING_MAX_BATCH_TOKENS,
    );

    for (const batch of batches) {
      const vectors = await fetchEmbeddings({
        texts: batch.map((item) => item.inputText),
        config: this.config.embedding,
      });
      for (let i = 0; i < batch.length; i++) {
        store.vectors[batch[i].chunk.id] = {
          contentHash: batch[i].chunk.contentHash,
          vector: normalizeVector(vectors[i]),
        };
      }

      store.updatedAt = new Date().toISOString();
      this.writeEmbeddingStore(store);

      if (batches.length > 1) {
        await sleep(DEFAULT_EMBEDDING_INTER_BATCH_DELAY_MS);
      }
    }

    store.updatedAt = new Date().toISOString();
    this.writeEmbeddingStore(store);
    return store;
  }

  private readEmbeddingStore(): EmbeddingStore | null {
    const path = this.getEmbeddingStorePath();
    if (!existsSync(path)) {
      return null;
    }

    try {
      const parsed = JSON.parse(readFileSync(path, 'utf-8')) as EmbeddingStore;
      if (parsed.version !== EMBEDDING_STORE_VERSION) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private writeEmbeddingStore(store: EmbeddingStore): void {
    writeFileSync(this.getEmbeddingStorePath(), JSON.stringify(store), 'utf-8');
  }

  private async ensureWeaviateSemanticIndex(index: RepositoryIndex): Promise<WeaviateVectorStoreState> {
    const collectionName = getWeaviateCollectionName(this.config);
    const current = this.readWeaviateVectorStoreState();
    const collectionStatus = await ensureWeaviateCollection(this.config.vectorStore.weaviate, collectionName);
    const compatible =
      current &&
      current.collectionName === collectionName &&
      current.repoUrl === this.config.repoUrl &&
      current.branch === this.config.branch &&
      current.revision === index.source.revision &&
      current.embeddingModel === this.config.embedding.model &&
      current.embeddingBaseURL === this.config.embedding.baseURL &&
      current.dimensions === this.config.embedding.dimensions &&
      current.indexedChunks === index.chunks.length &&
      current.chunkSignature === index.build.chunkSignature;

    if (compatible && collectionStatus === 'exists') {
      return current;
    }

    await deleteWeaviateCollection(this.config.vectorStore.weaviate, collectionName);
    await ensureWeaviateCollection(this.config.vectorStore.weaviate, collectionName);

    const embeddingInputs = index.chunks.map((chunk) => ({
      chunk,
      inputText: buildEmbeddingInput(chunk),
      estimatedTokens: estimateEmbeddingTokens(buildEmbeddingInput(chunk)),
    }));
    const batches = createEmbeddingBatches(
      embeddingInputs,
      Math.max(1, Math.min(this.config.embedding.batchSize, this.config.vectorStore.weaviate.batchSize)),
      DEFAULT_EMBEDDING_MAX_BATCH_TOKENS,
    );

    for (const batch of batches) {
      const vectors = await fetchEmbeddings({
        texts: batch.map((item) => item.inputText),
        config: this.config.embedding,
      });
      await upsertWeaviateObjects({
        config: this.config.vectorStore.weaviate,
        collectionName,
        objects: batch.map((item, indexInBatch) => ({
          chunk: item.chunk,
          vector: normalizeVector(vectors[indexInBatch]),
        })),
      });
      if (batches.length > 1) {
        await sleep(DEFAULT_EMBEDDING_INTER_BATCH_DELAY_MS);
      }
    }

    const state: WeaviateVectorStoreState = {
      version: VECTOR_STORE_STATE_VERSION,
      provider: 'weaviate',
      collectionName,
      repoUrl: this.config.repoUrl,
      branch: this.config.branch,
      revision: index.source.revision,
      embeddingModel: this.config.embedding.model,
      embeddingBaseURL: this.config.embedding.baseURL,
      dimensions: this.config.embedding.dimensions,
      indexedChunks: index.chunks.length,
      chunkSignature: index.build.chunkSignature,
      updatedAt: new Date().toISOString(),
    };
    this.writeWeaviateVectorStoreState(state);
    return state;
  }

  private readWeaviateVectorStoreState(): WeaviateVectorStoreState | null {
    const path = this.getVectorStoreStatePath();
    if (!existsSync(path)) {
      return null;
    }

    try {
      const parsed = JSON.parse(readFileSync(path, 'utf-8')) as WeaviateVectorStoreState;
      if (parsed.version !== VECTOR_STORE_STATE_VERSION) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private writeWeaviateVectorStoreState(state: WeaviateVectorStoreState): void {
    writeFileSync(this.getVectorStoreStatePath(), JSON.stringify(state, null, 2), 'utf-8');
  }

  private getRepoDir(): string {
    return join(this.config.cacheDir, 'repo');
  }

  private getIndexPath(): string {
    return join(this.config.cacheDir, 'index.json');
  }

  private getEmbeddingStorePath(): string {
    return join(this.config.cacheDir, 'embeddings.json');
  }

  private getVectorStoreStatePath(): string {
    return join(this.config.cacheDir, 'vector-store-state.json');
  }
}

type RequiredHybridConfig = {
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

function normalizeConfig(config: KnowledgeBaseConfig): RequiredHybridConfig {
  const embeddingProvider = config.embedding?.provider ?? 'openai-compatible';
  const embeddingBaseURL = normalizeEmbeddingBaseUrl(
    config.embedding?.baseURL ??
      process.env.FRONTAGENT_RAG_EMBEDDING_BASE_URL ??
      process.env.OPENAI_BASE_URL ??
      process.env.BASE_URL ??
      'https://api.openai.com/v1'
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
    config.vectorStore?.weaviate?.baseURL ??
    process.env.FRONTAGENT_RAG_WEAVIATE_URL ??
    '';
  const weaviateApiKey =
    config.vectorStore?.weaviate?.apiKey ??
    process.env.FRONTAGENT_RAG_WEAVIATE_API_KEY ??
    '';
  const rerankerBaseURL =
    config.reranker?.baseURL ??
    process.env.FRONTAGENT_RAG_RERANKER_BASE_URL ??
    '';
  const rerankerApiKey =
    config.reranker?.apiKey ??
    process.env.FRONTAGENT_RAG_RERANKER_API_KEY ??
    '';

  return {
    repoUrl: config.repoUrl,
    branch: config.branch,
    cacheDir: resolve(config.cacheDir),
    syncOnQuery: config.syncOnQuery ?? true,
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
      model: config.embedding?.model ?? process.env.FRONTAGENT_RAG_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL,
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

async function ensureRepositoryCheckout(input: {
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

async function getRepositoryHead(repoDir: string): Promise<string> {
  const result = await runGit(['rev-parse', 'HEAD'], repoDir);
  return result.stdout.trim();
}

function getSubmodulePaths(repoDir: string): string[] {
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

function canReuseIndex(
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

function buildRepositoryIndex(input: {
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
  const files = listRepositoryFiles(input.repoDir, input.excludedPathPrefixes, input.maxFileSizeBytes);
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
  return excludedPathPrefixes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

function looksBinary(buffer: Buffer, path: string): boolean {
  const extension = extname(path).toLowerCase();
  if (BINARY_EXTENSIONS.has(extension)) {
    return true;
  }

  // Skip minified files – they're unreadable single-line blobs that waste
  // index space and pollute search results (e.g. foo.min.js, bar.min.css).
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

function chunkText(
  content: string,
  path: string,
  chunkSize: number,
  chunkOverlap: number,
): Array<{ text: string; lineStart: number; lineEnd: number }> {
  if (!content.trim()) {
    return [];
  }

  const semanticBlocks = createSemanticBlocks(content, path)
    .flatMap((block) => splitOversizedBlock(block, chunkSize))
    .filter((block) => block.text.trim().length > 0);

  if (semanticBlocks.length === 0) {
    return [];
  }

  const chunks: Array<{ text: string; lineStart: number; lineEnd: number }> = [];
  let startIndex = 0;

  while (startIndex < semanticBlocks.length) {
    let endIndex = startIndex;
    let currentLength = 0;

    while (endIndex < semanticBlocks.length) {
      const separatorLength = endIndex > startIndex ? 2 : 0;
      const candidateLength = currentLength + separatorLength + semanticBlocks[endIndex].text.length;
      if (candidateLength > chunkSize && endIndex > startIndex) {
        break;
      }
      currentLength = candidateLength;
      endIndex++;
    }

    const selectedBlocks = semanticBlocks.slice(startIndex, endIndex);
    const text = selectedBlocks.map((block) => block.text).join('\n\n').trim();
    if (text) {
      chunks.push({
        text,
        lineStart: selectedBlocks[0].lineStart,
        lineEnd: selectedBlocks[selectedBlocks.length - 1].lineEnd,
      });
    }

    if (endIndex >= semanticBlocks.length) {
      break;
    }

    let overlapChars = 0;
    let nextStart = endIndex;
    while (nextStart > startIndex + 1 && overlapChars < chunkOverlap) {
      nextStart--;
      overlapChars += semanticBlocks[nextStart].text.length + 2;
    }

    startIndex = Math.max(nextStart, startIndex + 1);
  }

  return chunks;
}

function createSemanticBlocks(
  content: string,
  path: string,
): Array<{ text: string; lineStart: number; lineEnd: number }> {
  const lines = content.split(/\r?\n/);
  const blocks: Array<{ text: string; lineStart: number; lineEnd: number }> = [];
  const extension = extname(path).toLowerCase();
  let currentLines: string[] = [];
  let currentStartLine = 1;
  let inFence = false;
  // Track whether we are currently accumulating list items so that
  // continuation items don't each trigger a new block boundary.
  let inList = false;

  const flush = (endLine: number) => {
    const text = currentLines.join('\n').trim();
    if (!text) {
      currentLines = [];
      return;
    }

    blocks.push({
      text,
      lineStart: currentStartLine,
      lineEnd: endLine,
    });
    currentLines = [];
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const lineNumber = index + 1;
    const trimmed = line.trim();

    if (!inFence && trimmed === '') {
      if (currentLines.length > 0) {
        flush(lineNumber - 1);
      }
      currentStartLine = lineNumber + 1;
      // A blank line always ends any active list.
      inList = false;
      continue;
    }

    const isFenceBoundary = /^(```|~~~)/.test(trimmed);
    if (isFenceBoundary && !inFence) {
      if (currentLines.length > 0) {
        flush(lineNumber - 1);
      }
      currentStartLine = lineNumber;
      inList = false;
    }

    const isListItem = /^[-*+]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed);

    if (!inFence && currentLines.length > 0) {
      // Start of a new list (transition from non-list content) is a boundary.
      const isNewListStart = isListItem && !inList;
      if (isNewListStart || isSemanticBoundaryLine(trimmed, extension)) {
        flush(lineNumber - 1);
        currentStartLine = lineNumber;
      }
    }

    // Update list state after the boundary check so the first item can
    // correctly trigger a boundary against the preceding prose block.
    inList = isListItem;

    if (currentLines.length === 0) {
      currentStartLine = lineNumber;
    }
    currentLines.push(line);

    if (isFenceBoundary) {
      inFence = !inFence;
      if (!inFence) {
        flush(lineNumber);
        currentStartLine = lineNumber + 1;
        inList = false;
      }
    }
  }

  if (currentLines.length > 0) {
    flush(lines.length);
  }

  return blocks;
}

function isSemanticBoundaryLine(trimmedLine: string, extension: string): boolean {
  if (!trimmedLine) {
    return false;
  }

  if (/^#{1,6}\s+/.test(trimmedLine)) {
    return true;
  }

  if (/^<\/?(template|script|style|main|section|article|header|footer|aside|nav)\b/i.test(trimmedLine)) {
    return true;
  }

  if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(extension)) {
    return (
      /^(export\s+)?(default\s+)?(async\s+)?function\s+[A-Za-z0-9_$]+/.test(trimmedLine) ||
      /^(export\s+)?class\s+[A-Za-z0-9_$]+/.test(trimmedLine) ||
      /^(export\s+)?(interface|type|enum)\s+[A-Za-z0-9_$]+/.test(trimmedLine) ||
      /^(export\s+)?(const|let|var)\s+[A-Za-z0-9_$]+\s*=/.test(trimmedLine)
    );
  }

  if (['.css', '.scss', '.sass', '.less'].includes(extension)) {
    return /^(@media|@supports|@keyframes|:root\b|[.#a-zA-Z\[\]][^{}]*\{)\s*$/.test(trimmedLine);
  }

  if (['.html', '.vue', '.md'].includes(extension)) {
    return /^<[^/!][^>]*>$/.test(trimmedLine);
  }

  if (extension === '.py') {
    return (
      /^(async\s+)?def\s+[A-Za-z0-9_]+/.test(trimmedLine) ||
      /^class\s+[A-Za-z0-9_]+/.test(trimmedLine) ||
      /^@[A-Za-z0-9_]+/.test(trimmedLine)
    );
  }

  if (extension === '.go') {
    return (
      /^func\s+/.test(trimmedLine) ||
      /^type\s+[A-Za-z0-9_]+\s+(struct|interface)\b/.test(trimmedLine) ||
      /^var\s+[A-Za-z0-9_]+/.test(trimmedLine) ||
      /^const\s+[A-Za-z0-9_]/.test(trimmedLine)
    );
  }

  if (extension === '.rs') {
    return (
      /^(pub(\(crate\))?\s+)?(async\s+)?fn\s+[A-Za-z0-9_]+/.test(trimmedLine) ||
      /^(pub(\(crate\))?\s+)?struct\s+[A-Za-z0-9_]+/.test(trimmedLine) ||
      /^(pub(\(crate\))?\s+)?enum\s+[A-Za-z0-9_]+/.test(trimmedLine) ||
      /^(pub(\(crate\))?\s+)?impl(\s+[A-Za-z0-9_<>]+)?\b/.test(trimmedLine) ||
      /^(pub(\(crate\))?\s+)?trait\s+[A-Za-z0-9_]+/.test(trimmedLine) ||
      /^#\[/.test(trimmedLine)
    );
  }

  if (['.java', '.kt', '.scala'].includes(extension)) {
    return (
      /^(public|private|protected|package|internal)\s+/.test(trimmedLine) ||
      /^(abstract|sealed|data|open|override|static|final)\s+class\s+/.test(trimmedLine) ||
      /^class\s+[A-Za-z0-9_]+/.test(trimmedLine) ||
      /^interface\s+[A-Za-z0-9_]+/.test(trimmedLine) ||
      /^object\s+[A-Za-z0-9_]+/.test(trimmedLine) ||
      /^@[A-Za-z0-9_]+/.test(trimmedLine)
    );
  }

  if (['.rb', '.rake'].includes(extension)) {
    return (
      /^def\s+[A-Za-z0-9_?!]+/.test(trimmedLine) ||
      /^class\s+[A-Za-z0-9_:]+/.test(trimmedLine) ||
      /^module\s+[A-Za-z0-9_:]+/.test(trimmedLine)
    );
  }

  if (extension === '.php') {
    return (
      /^(public|private|protected|static|abstract|final|readonly)\s+/.test(trimmedLine) ||
      /^function\s+[A-Za-z0-9_]+/.test(trimmedLine) ||
      /^class\s+[A-Za-z0-9_]+/.test(trimmedLine) ||
      /^interface\s+[A-Za-z0-9_]+/.test(trimmedLine) ||
      /^trait\s+[A-Za-z0-9_]+/.test(trimmedLine)
    );
  }

  if (['.c', '.cpp', '.cc', '.h', '.hpp'].includes(extension)) {
    return (
      /^[A-Za-z_][A-Za-z0-9_\s*&:<>]+\s+[A-Za-z0-9_:~]+\s*\(/.test(trimmedLine) ||
      /^(class|struct|enum|namespace|template)\s+[A-Za-z0-9_]+/.test(trimmedLine) ||
      /^#(pragma|ifndef|define|endif)\b/.test(trimmedLine)
    );
  }

  return false;
}

function splitOversizedBlock(
  block: { text: string; lineStart: number; lineEnd: number },
  maxLength: number,
): Array<{ text: string; lineStart: number; lineEnd: number }> {
  if (block.text.length <= maxLength) {
    return [block];
  }

  const pieces: Array<{ text: string; lineStart: number; lineEnd: number }> = [];
  let startOffset = 0;

  while (startOffset < block.text.length) {
    while (startOffset < block.text.length && /\s/.test(block.text[startOffset])) {
      startOffset++;
    }
    if (startOffset >= block.text.length) {
      break;
    }

    const endOffset = findPreferredSplitOffset(block.text, startOffset, maxLength);
    const raw = block.text.slice(startOffset, endOffset);
    const text = raw.trim();
    if (text) {
      pieces.push({
        text,
        lineStart: getLineNumberAtOffset(block.text, block.lineStart, startOffset),
        lineEnd: getLineNumberAtOffset(block.text, block.lineStart, Math.max(startOffset, endOffset - 1)),
      });
    }

    startOffset = endOffset;
  }

  return pieces.length > 0 ? pieces : [block];
}

function findPreferredSplitOffset(text: string, startOffset: number, maxLength: number): number {
  const remaining = text.length - startOffset;
  if (remaining <= maxLength) {
    return text.length;
  }

  const window = text.slice(startOffset, startOffset + maxLength);
  const minimumPreferredOffset = Math.floor(maxLength * 0.45);
  const boundaryPatterns = [
    /\n\s*\n/g,
    /\n/g,
    /[。！？!?；;]\s+/g,
    /[{};>]\s*/g,
    /[,，]\s+/g,
  ];

  for (const pattern of boundaryPatterns) {
    const relative = findLastBoundary(window, pattern);
    if (relative >= minimumPreferredOffset) {
      return startOffset + relative;
    }
  }

  return startOffset + maxLength;
}

function findLastBoundary(window: string, pattern: RegExp): number {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const matcher = new RegExp(pattern.source, flags);
  let match: RegExpExecArray | null;
  let lastIndex = -1;

  while ((match = matcher.exec(window)) !== null) {
    lastIndex = match.index + match[0].length;
  }

  return lastIndex;
}

function getLineNumberAtOffset(text: string, baseLine: number, offset: number): number {
  if (offset <= 0) {
    return baseLine;
  }

  let line = baseLine;
  for (let i = 0; i < Math.min(offset, text.length); i++) {
    if (text[i] === '\n') {
      line++;
    }
  }
  return line;
}

function searchBm25(
  index: RepositoryIndex,
  query: string,
  limit: number,
): ChunkCandidate[] {
  const queryTerms = countTerms(tokenize(query));
  if (Object.keys(queryTerms).length === 0) {
    return [];
  }

  const scores: ChunkCandidate[] = [];
  for (const chunk of index.chunks) {
    const score = computeBm25Score(chunk, queryTerms, index.bm25);
    if (score > 0) {
      scores.push({ chunk, score });
    }
  }

  scores.sort((left, right) => right.score - left.score);
  return scores.slice(0, limit);
}

function computeBm25Score(
  chunk: RepositoryChunk,
  queryTerms: Record<string, number>,
  bm25: RepositoryIndex['bm25'],
): number {
  const k1 = 1.5;
  const b = 0.75;
  const averageDocLength = bm25.averageDocumentLength || 1;
  let score = 0;

  for (const [term, queryFrequency] of Object.entries(queryTerms)) {
    const termFrequency = chunk.termFrequency[term] ?? 0;
    if (termFrequency === 0) {
      continue;
    }
    const documentFrequency = bm25.documentFrequency[term] ?? 0;
    const idf = Math.log(1 + (bm25.documentCount - documentFrequency + 0.5) / (documentFrequency + 0.5));
    const numerator = termFrequency * (k1 + 1);
    const denominator =
      termFrequency +
      k1 * (1 - b + b * (chunk.tokenCount / averageDocLength));
    score += idf * (numerator / denominator) * queryFrequency;
  }

  return score;
}

function aggregateChunkCandidates(
  chunkCandidates: ChunkCandidate[],
  index: RepositoryIndex,
  filters?: RagMetadataFilter,
): DocumentCandidate[] {
  const documentsById = new Map(index.documents.map((document) => [document.id, document]));
  const bestByDocument = new Map<string, DocumentCandidate>();

  for (let rank = 0; rank < chunkCandidates.length; rank++) {
    const candidate = chunkCandidates[rank];
    if (!matchesMetadataFilter(candidate.chunk, filters)) {
      continue;
    }
    const document = documentsById.get(candidate.chunk.documentId);
    if (!document) {
      continue;
    }
    const existing = bestByDocument.get(document.id);
    if (!existing || candidate.score > existing.score) {
      bestByDocument.set(document.id, {
        document,
        chunk: candidate.chunk,
        score: candidate.score,
        rank: rank + 1,
      });
    }
  }

  return Array.from(bestByDocument.values()).sort((left, right) => right.score - left.score);
}

async function searchSemantic(
  query: string,
  index: RepositoryIndex,
  embeddingStore: EmbeddingStore,
  config: Required<EmbeddingConfig>,
  limit: number,
): Promise<ChunkCandidate[]> {
  const [queryVector] = await fetchEmbeddings({
    texts: [query],
    config,
  });
  const normalizedQuery = normalizeVector(queryVector);
  const scores: ChunkCandidate[] = [];

  for (const chunk of index.chunks) {
    const entry = embeddingStore.vectors[chunk.id];
    if (!entry || entry.contentHash !== chunk.contentHash) {
      continue;
    }
    const score = dotProduct(normalizedQuery, entry.vector);
    if (score > 0) {
      scores.push({ chunk, score });
    }
  }

  scores.sort((left, right) => right.score - left.score);
  return scores.slice(0, limit);
}

async function searchSemanticWithWeaviate(
  query: string,
  index: RepositoryIndex,
  embeddingConfig: Required<EmbeddingConfig>,
  weaviateConfig: Required<WeaviateVectorStoreConfig>,
  collectionName: string,
  limit: number,
): Promise<ChunkCandidate[]> {
  const [queryVector] = await fetchEmbeddings({
    texts: [query],
    config: embeddingConfig,
  });
  const normalizedQuery = normalizeVector(queryVector);
  const vectorLiteral = JSON.stringify(Array.from(normalizedQuery));
  const graphqlQuery = `{
    Get {
      ${collectionName}(nearVector: { vector: ${vectorLiteral} }, limit: ${Math.max(limit, 1)}) {
        chunkId
        contentHash
        _additional {
          id
          distance
          certainty
        }
      }
    }
  }`;
  const payload = await requestWeaviateGraphQL<{
    Get?: Record<string, Array<{
      chunkId?: string;
      contentHash?: string;
      _additional?: {
        id?: string;
        distance?: number;
        certainty?: number;
      };
    }>>;
  }>(weaviateConfig, graphqlQuery);

  const results = payload.Get?.[collectionName] ?? [];
  const chunksById = new Map(index.chunks.map((chunk) => [chunk.id, chunk]));
  const candidates: ChunkCandidate[] = [];
  const seenChunkIds = new Set<string>();

  for (const item of results) {
    if (!item.chunkId || seenChunkIds.has(item.chunkId)) {
      continue;
    }
    const chunk = chunksById.get(item.chunkId);
    if (!chunk) {
      continue;
    }
    if (item.contentHash && item.contentHash !== chunk.contentHash) {
      continue;
    }

    const certainty = item._additional?.certainty;
    const distance = item._additional?.distance;
    const score =
      typeof certainty === 'number'
        ? certainty
        : typeof distance === 'number'
          ? Math.max(0, 1 - distance)
          : 0;

    seenChunkIds.add(item.chunkId);
    candidates.push({ chunk, score });
  }

  candidates.sort((left, right) => right.score - left.score);
  return candidates.slice(0, limit);
}

async function ensureWeaviateCollection(
  config: Required<WeaviateVectorStoreConfig>,
  collectionName: string,
): Promise<'exists' | 'created'> {
  const baseURL = normalizeBaseUrl(config.baseURL);
  const getResponse = await fetch(`${baseURL}/v1/schema/${collectionName}`, {
    method: 'GET',
    headers: buildWeaviateHeaders(config),
    signal: AbortSignal.timeout(config.requestTimeoutMs),
  });

  if (getResponse.ok) {
    return 'exists';
  }

  if (getResponse.status !== 404) {
    const errorText = await getResponse.text();
    throw new Error(`weaviate schema check failed: ${getResponse.status} ${getResponse.statusText} ${errorText}`.trim());
  }

  const response = await fetch(`${baseURL}/v1/schema`, {
    method: 'POST',
    headers: buildWeaviateHeaders(config),
    body: JSON.stringify({
      class: collectionName,
      vectorizer: 'none',
      vectorIndexConfig: {
        distance: 'cosine',
      },
      properties: [
        { name: 'chunkId', dataType: ['text'] },
        { name: 'documentId', dataType: ['text'] },
        { name: 'path', dataType: ['text'] },
        { name: 'title', dataType: ['text'] },
        { name: 'sourceUrl', dataType: ['text'] },
        { name: 'contentHash', dataType: ['text'] },
        { name: 'topLevelDir', dataType: ['text'] },
        { name: 'extension', dataType: ['text'] },
        { name: 'chunkIndex', dataType: ['int'] },
        { name: 'totalChunks', dataType: ['int'] },
        { name: 'lineStart', dataType: ['int'] },
        { name: 'lineEnd', dataType: ['int'] },
        { name: 'text', dataType: ['text'] },
      ],
    }),
    signal: AbortSignal.timeout(config.requestTimeoutMs),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`weaviate schema create failed: ${response.status} ${response.statusText} ${errorText}`.trim());
  }

  return 'created';
}

async function deleteWeaviateCollection(
  config: Required<WeaviateVectorStoreConfig>,
  collectionName: string,
): Promise<void> {
  const baseURL = normalizeBaseUrl(config.baseURL);
  const response = await fetch(`${baseURL}/v1/schema/${collectionName}`, {
    method: 'DELETE',
    headers: buildWeaviateHeaders(config),
    signal: AbortSignal.timeout(config.requestTimeoutMs),
  });

  if (response.ok || response.status === 404) {
    return;
  }

  const errorText = await response.text();
  throw new Error(`weaviate schema delete failed: ${response.status} ${response.statusText} ${errorText}`.trim());
}

async function upsertWeaviateObjects(input: {
  config: Required<WeaviateVectorStoreConfig>;
  collectionName: string;
  objects: Array<{ chunk: RepositoryChunk; vector: number[] }>;
}): Promise<void> {
  if (input.objects.length === 0) {
    return;
  }

  const baseURL = normalizeBaseUrl(input.config.baseURL);
  const response = await fetch(`${baseURL}/v1/batch/objects`, {
    method: 'POST',
    headers: buildWeaviateHeaders(input.config),
    body: JSON.stringify({
      objects: input.objects.map((item) => ({
        class: input.collectionName,
        id: buildWeaviateObjectId(item.chunk.id),
        properties: {
          chunkId: item.chunk.id,
          documentId: item.chunk.documentId,
          path: item.chunk.path,
          title: item.chunk.title,
          sourceUrl: item.chunk.sourceUrl,
          contentHash: item.chunk.contentHash,
          topLevelDir: item.chunk.metadata.topLevelDir,
          extension: item.chunk.metadata.extension,
          chunkIndex: item.chunk.metadata.chunkIndex,
          totalChunks: item.chunk.metadata.totalChunks,
          lineStart: item.chunk.metadata.lineStart,
          lineEnd: item.chunk.metadata.lineEnd,
          text: item.chunk.text,
        },
        vector: item.vector,
      })),
    }),
    signal: AbortSignal.timeout(input.config.requestTimeoutMs),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`weaviate batch import failed: ${response.status} ${response.statusText} ${errorText}`.trim());
  }

  const payload = await response.json() as Array<{
    result?: {
      errors?: {
        error?: Array<{ message?: string }>;
      };
    };
  }> | { errors?: Array<{ message?: string }> };

  const topLevelErrors =
    !Array.isArray(payload) && payload.errors?.map((item) => item.message).filter(Boolean);
  if (topLevelErrors && topLevelErrors.length > 0) {
    throw new Error(`weaviate batch import failed: ${topLevelErrors.join('; ')}`);
  }

  if (Array.isArray(payload)) {
    const itemErrors = payload
      .flatMap((item) => item.result?.errors?.error ?? [])
      .map((item) => item.message)
      .filter((message): message is string => Boolean(message));
    if (itemErrors.length > 0) {
      throw new Error(`weaviate batch import failed: ${itemErrors.join('; ')}`);
    }
  }
}

async function requestWeaviateGraphQL<T>(
  config: Required<WeaviateVectorStoreConfig>,
  query: string,
): Promise<T> {
  const baseURL = normalizeBaseUrl(config.baseURL);
  const response = await fetch(`${baseURL}/v1/graphql`, {
    method: 'POST',
    headers: buildWeaviateHeaders(config),
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(config.requestTimeoutMs),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`weaviate graphql request failed: ${response.status} ${response.statusText} ${errorText}`.trim());
  }

  const payload = await response.json() as {
    data?: T;
    errors?: Array<{ message?: string }>;
  };
  if (payload.errors && payload.errors.length > 0) {
    throw new Error(
      `weaviate graphql request failed: ${payload.errors.map((item) => item.message).filter(Boolean).join('; ')}`
    );
  }
  if (!payload.data) {
    throw new Error('weaviate graphql response did not contain data');
  }

  return payload.data;
}

function buildWeaviateHeaders(config: Required<WeaviateVectorStoreConfig>): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (config.apiKey) {
    headers.authorization = `Bearer ${config.apiKey}`;
  }
  return headers;
}

async function fetchEmbeddings(input: {
  texts: string[];
  config: Required<EmbeddingConfig>;
}): Promise<number[][]> {
  if (input.texts.length === 0) {
    return [];
  }

  let attempt = 0;

  while (true) {
    try {
      return await requestEmbeddings(input);
    } catch (error) {
      if (shouldSplitEmbeddingBatch(error) && input.texts.length > 1) {
        const midpoint = Math.ceil(input.texts.length / 2);
        const left = await fetchEmbeddings({
          texts: input.texts.slice(0, midpoint),
          config: input.config,
        });
        const right = await fetchEmbeddings({
          texts: input.texts.slice(midpoint),
          config: input.config,
        });
        return [...left, ...right];
      }

      if (shouldRetryEmbeddingRequest(error) && attempt < DEFAULT_EMBEDDING_MAX_RETRIES) {
        const delayMs = getEmbeddingRetryDelayMs(error, attempt);
        await sleep(delayMs);
        attempt += 1;
        continue;
      }

      throw error;
    }
  }
}

async function requestEmbeddings(input: {
  texts: string[];
  config: Required<EmbeddingConfig>;
}): Promise<number[][]> {
  if (!input.config.apiKey) {
    throw new Error('missing embedding api key');
  }

  const endpoint = normalizeEmbeddingBaseUrl(input.config.baseURL);
  const body: Record<string, unknown> = {
    model: input.config.model,
    input: input.texts,
    encoding_format: 'float',
  };
  if (input.config.dimensions) {
    body.dimensions = input.config.dimensions;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${input.config.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(input.config.requestTimeoutMs),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new EmbeddingRequestError(
      `embedding request failed: ${response.status} ${response.statusText} ${errorText}`.trim(),
      response.status,
      parseRetryAfterHeader(response.headers.get('retry-after')),
    );
  }

  const payload = await response.json() as {
    data?: Array<{ embedding?: number[] }>;
  };
  const vectors = payload.data?.map((item) => item.embedding ?? []);
  if (!vectors || vectors.length !== input.texts.length) {
    throw new Error('embedding response did not contain the expected number of vectors');
  }

  return vectors;
}

function shouldSplitEmbeddingBatch(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('maximum context length') ||
    message.includes('please reduce your prompt') ||
    message.includes('too many tokens') ||
    message.includes('context length') ||
    message.includes('maximum input length')
  );
}

function shouldRetryEmbeddingRequest(error: unknown): boolean {
  if (error instanceof EmbeddingRequestError) {
    return error.status === 429 || error.status >= 500;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('429') ||
    message.includes('too many requests') ||
    message.includes('rate limit') ||
    message.includes('etimedout') ||
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('socket hang up')
  );
}

function getEmbeddingRetryDelayMs(error: unknown, attempt: number): number {
  if (error instanceof EmbeddingRequestError && error.retryAfterMs) {
    return error.retryAfterMs;
  }

  const multiplier = 2 ** attempt;
  return DEFAULT_EMBEDDING_RETRY_BASE_DELAY_MS * multiplier;
}

function parseRetryAfterHeader(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const seconds = Number(value);
  if (!Number.isNaN(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const date = Date.parse(value);
  if (Number.isNaN(date)) {
    return undefined;
  }

  return Math.max(0, date - Date.now());
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function fuseDocumentCandidates(input: {
  keywordCandidates: DocumentCandidate[];
  semanticCandidates: DocumentCandidate[];
  maxResults: number;
  keywordWeight: number;
  semanticWeight: number;
}): DocumentCandidate[] {
  const keywordMax = input.keywordCandidates[0]?.score ?? 0;
  const semanticMax = input.semanticCandidates[0]?.score ?? 0;
  const fused = new Map<string, DocumentCandidate>();

  const effectiveKeywordWeight =
    input.semanticCandidates.length > 0 ? input.keywordWeight : 1;
  const effectiveSemanticWeight =
    input.semanticCandidates.length > 0 ? input.semanticWeight : 0;

  for (const candidate of input.keywordCandidates) {
    fused.set(candidate.document.id, {
      ...candidate,
      score: 0,
      keywordScore: candidate.score,
      semanticScore: undefined,
    });
  }

  for (const candidate of input.semanticCandidates) {
    const existing = fused.get(candidate.document.id);
    if (existing) {
      if (candidate.score > (existing.semanticScore ?? 0)) {
        existing.semanticScore = candidate.score;
        if (candidate.score > (existing.keywordScore ?? 0)) {
          existing.chunk = candidate.chunk;
        }
      }
    } else {
      fused.set(candidate.document.id, {
        ...candidate,
        score: 0,
        keywordScore: undefined,
        semanticScore: candidate.score,
      });
    }
  }

  const ranked = Array.from(fused.values()).map((candidate) => {
    const keywordScore = candidate.keywordScore ?? 0;
    const semanticScore = candidate.semanticScore ?? 0;
    const keywordNormalized = keywordMax > 0 ? keywordScore / keywordMax : 0;
    const semanticNormalized = semanticMax > 0 ? semanticScore / semanticMax : 0;
    const keywordRank = reciprocalRank(findRank(input.keywordCandidates, candidate.document.id));
    const semanticRank = reciprocalRank(findRank(input.semanticCandidates, candidate.document.id));

    candidate.score =
      effectiveKeywordWeight * keywordNormalized +
      effectiveSemanticWeight * semanticNormalized +
      0.1 * keywordRank +
      0.1 * semanticRank;
    return candidate;
  });

  ranked.sort((left, right) => right.score - left.score);
  return ranked.slice(0, input.maxResults);
}

async function rerankDocumentCandidates(input: {
  query: string;
  candidates: DocumentCandidate[];
  maxResults: number;
  config: Required<RerankerConfig>;
}): Promise<DocumentCandidate[]> {
  const rerankPool = input.candidates.slice(0, Math.max(input.maxResults, input.config.candidateCount));
  if (rerankPool.length === 0) {
    return [];
  }

  if (input.config.provider !== 'jina-compatible') {
    throw new Error(`unsupported reranker provider: ${input.config.provider}`);
  }

  const documents = rerankPool.map((candidate) =>
    buildRerankerDocument(candidate, input.config.maxDocumentChars)
  );
  const rerankedItems = await requestJinaCompatibleRerank({
    config: input.config,
    query: input.query,
    documents,
    topN: Math.min(Math.max(input.maxResults, 1), rerankPool.length),
  });

  const byIndex = new Map(rerankedItems.map((item) => [item.index, item.score]));
  const reranked = rerankPool
    .flatMap((candidate, index) => {
      const score = byIndex.get(index);
      if (score === undefined) {
        return [];
      }
      return [{
        ...candidate,
        rerankScore: score,
        score,
      }];
    })
    .sort((left, right) => (right.rerankScore ?? 0) - (left.rerankScore ?? 0));

  if (reranked.length >= input.maxResults) {
    return reranked.slice(0, input.maxResults);
  }

  const rerankedDocIds = new Set(reranked.map((candidate) => candidate.document.id));
  const fallback = rerankPool.filter((candidate) => !rerankedDocIds.has(candidate.document.id));
  return [...reranked, ...fallback].slice(0, input.maxResults);
}

function buildRerankerDocument(candidate: DocumentCandidate, maxChars: number): string {
  return truncateRerankerDocument(
    [
      `path: ${candidate.document.path}`,
      `title: ${candidate.document.title}`,
      candidate.chunk.text,
    ].join('\n'),
    maxChars,
  );
}

function truncateRerankerDocument(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }

  const marker = '\n...[truncated for rerank]...\n';
  if (maxChars <= marker.length + 32) {
    return text.slice(0, maxChars);
  }

  const remaining = maxChars - marker.length;
  const headChars = Math.ceil(remaining * 0.8);
  const tailChars = remaining - headChars;
  return `${text.slice(0, headChars)}${marker}${text.slice(-tailChars)}`;
}

async function requestJinaCompatibleRerank(input: {
  config: Required<RerankerConfig>;
  query: string;
  documents: string[];
  topN: number;
}): Promise<Array<{ index: number; score: number }>> {
  const endpoint = normalizeRerankerBaseUrl(input.config.baseURL);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${input.config.apiKey}`,
    },
    body: JSON.stringify({
      model: input.config.model,
      query: input.query,
      documents: input.documents,
      top_n: input.topN,
      return_documents: false,
    }),
    signal: AbortSignal.timeout(input.config.requestTimeoutMs),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`rerank request failed: ${response.status} ${response.statusText} ${errorText}`.trim());
  }

  const payload = await response.json() as {
    results?: Array<{ index?: number; relevance_score?: number; score?: number }>;
    data?: Array<{ index?: number; relevance_score?: number; score?: number }>;
  };
  const items = payload.results ?? payload.data ?? [];

  return items
    .map((item) => ({
      index: item.index ?? -1,
      score: item.relevance_score ?? item.score ?? 0,
    }))
    .filter((item) => item.index >= 0)
    .sort((left, right) => right.score - left.score);
}

function findRank(candidates: DocumentCandidate[], documentId: string): number | undefined {
  const candidate = candidates.find((item) => item.document.id === documentId);
  return candidate?.rank;
}

function reciprocalRank(rank?: number): number {
  if (!rank) {
    return 0;
  }
  return 1 / (rank + 50);
}

function matchesMetadataFilter(
  chunk: RepositoryChunk,
  filters?: RagMetadataFilter,
): boolean {
  if (!filters) {
    return true;
  }

  if (
    filters.topLevelDirs &&
    filters.topLevelDirs.length > 0 &&
    !filters.topLevelDirs.includes(chunk.metadata.topLevelDir)
  ) {
    return false;
  }

  if (
    filters.extensions &&
    filters.extensions.length > 0 &&
    !filters.extensions.includes(chunk.metadata.extension)
  ) {
    return false;
  }

  if (
    filters.pathPrefixes &&
    filters.pathPrefixes.length > 0 &&
    !filters.pathPrefixes.some((prefix) => chunk.path.startsWith(prefix))
  ) {
    return false;
  }

  if (
    filters.excludePathPrefixes &&
    filters.excludePathPrefixes.some((prefix) => chunk.path.startsWith(prefix))
  ) {
    return false;
  }

  return true;
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

  // Primary pass: standard latin + punctuation tokens (lowercased).
  const normalized = input.toLowerCase();
  for (const match of normalized.match(/[a-z0-9_@./:-]+/g) ?? []) {
    emit(match);
    // Also emit individual underscore-separated sub-words so that
    // "get_user_profile" matches queries for "user" or "profile".
    if (match.includes('_')) {
      for (const part of match.split('_')) {
        emit(part);
      }
    }
  }

  // Secondary pass: split camelCase / PascalCase identifiers in the
  // original (pre-lowercase) text so that "getUserProfile" also emits
  // "get", "user", "profile" as independent search tokens.
  for (const identifier of input.match(/[A-Za-z][a-zA-Z0-9]*/g) ?? []) {
    // Only worth splitting mixed-case identifiers – pure lower/upper are
    // already fully covered by the primary pass above.
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

  // CJK bigram tokenisation (unchanged).
  for (const match of normalized.match(/[\u4e00-\u9fff]+/g) ?? []) {
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

function buildSnippet(text: string, query: string): string {
  const normalizedText = text.toLowerCase();
  const queryTokens = tokenize(query);
  for (const token of [query.toLowerCase(), ...queryTokens]) {
    if (!token) {
      continue;
    }
    const index = normalizedText.indexOf(token);
    if (index >= 0) {
      const start = Math.max(0, index - 120);
      const end = Math.min(text.length, index + 220);
      return text.slice(start, end).trim();
    }
  }
  return text.slice(0, 320).trim();
}

function buildEmbeddingInput(chunk: RepositoryChunk): string {
  return [
    `path: ${chunk.path}`,
    `top-level: ${chunk.metadata.topLevelDir}`,
    truncateEmbeddingText(chunk.text, DEFAULT_EMBEDDING_MAX_INPUT_CHARS),
  ].join('\n');
}

function truncateEmbeddingText(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }

  const marker = '\n...[truncated for embedding]...\n';
  if (maxChars <= marker.length + 32) {
    return text.slice(0, maxChars);
  }

  const remaining = maxChars - marker.length;
  const headChars = Math.ceil(remaining * 0.75);
  const tailChars = remaining - headChars;
  return `${text.slice(0, headChars)}${marker}${text.slice(-tailChars)}`;
}

function normalizeVector(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(norm) || norm === 0) {
    return vector;
  }
  return vector.map((value) => value / norm);
}

function dotProduct(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  let sum = 0;
  for (let i = 0; i < length; i++) {
    sum += left[i] * right[i];
  }
  return sum;
}

function createEmbeddingBatches<T extends { estimatedTokens: number }>(
  items: T[],
  maxItems: number,
  maxEstimatedTokens: number,
): T[][] {
  if (items.length === 0) {
    return [];
  }

  const batches: T[][] = [];
  let currentBatch: T[] = [];
  let currentTokens = 0;

  for (const item of items) {
    const wouldOverflowByCount = currentBatch.length >= maxItems;
    const wouldOverflowByTokens =
      currentBatch.length > 0 &&
      currentTokens + item.estimatedTokens > maxEstimatedTokens;

    if (wouldOverflowByCount || wouldOverflowByTokens) {
      batches.push(currentBatch);
      currentBatch = [];
      currentTokens = 0;
    }

    currentBatch.push(item);
    currentTokens += item.estimatedTokens;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

function estimateEmbeddingTokens(input: string): number {
  // Use a conservative heuristic: ~3 chars/token is a safe under-estimate for
  // mixed code + prose, while still being far more accurate than raw char count.
  // Some gateways enforce a strict total-token budget across the entire batch, so
  // we keep a safety margin rather than using a tighter 4-char/token ratio.
  return Math.max(1, Math.ceil(input.length / 3));
}

function getTopLevelDir(path: string): string {
  const firstSegment = normalizeRepoPath(path).split('/')[0];
  return firstSegment || 'root';
}

function getWeaviateCollectionName(config: RequiredHybridConfig): string {
  const prefix = sanitizeWeaviateCollectionPrefix(config.vectorStore.weaviate.collectionPrefix);
  const identity = hashText(
    `${config.repoUrl}:${config.branch}:${config.embedding.model}:${config.embedding.dimensions ?? 'default'}`
  ).slice(0, 12);
  return `${prefix}${identity}`;
}

function sanitizeWeaviateCollectionPrefix(prefix: string): string {
  const normalized = prefix.replace(/[^a-z0-9]/gi, '');
  const fallback = DEFAULT_WEAVIATE_COLLECTION_PREFIX;
  const candidate = normalized.length > 0 ? normalized : fallback;
  const capitalized = `${candidate.charAt(0).toUpperCase()}${candidate.slice(1)}`;
  return /^[A-Z]/.test(capitalized) ? capitalized : fallback;
}

function buildWeaviateObjectId(chunkId: string): string {
  const hash = hashText(chunkId);
  const segment4 = ((Number.parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80)
    .toString(16)
    .padStart(2, '0');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    `${segment4}${hash.slice(18, 20)}`,
    hash.slice(20, 32),
  ].join('-');
}

function normalizeRepoPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.?\//, '').replace(/^\/+/, '');
}

function normalizeBaseUrl(baseURL: string): string {
  return baseURL.replace(/\/+$/, '');
}

function normalizeOptionalBaseUrl(baseURL: string | undefined): string | undefined {
  if (!baseURL?.trim()) {
    return undefined;
  }
  return normalizeBaseUrl(baseURL.trim());
}

function normalizeEmbeddingBaseUrl(baseURL: string): string {
  const normalized = normalizeBaseUrl(baseURL);
  return normalized.endsWith('/embeddings') ? normalized : `${normalized}/embeddings`;
}

function normalizeRerankerBaseUrl(baseURL: string): string {
  const normalized = normalizeBaseUrl(baseURL);
  return normalized.endsWith('/rerank') ? normalized : `${normalized}/rerank`;
}

function isCompatibleEmbeddingStore(
  store: EmbeddingStore | null,
  config: Required<EmbeddingConfig>,
): store is EmbeddingStore {
  return Boolean(
    store &&
      store.model === config.model &&
      store.baseURL === config.baseURL &&
      store.dimensions === config.dimensions
  );
}

function toBlobUrl(repoUrl: string, branch: string, path: string): string {
  const repoBase = repoUrl.replace(/\.git$/, '');
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `${repoBase}/blob/${encodeURIComponent(branch)}/${encodedPath}`;
}

function hashText(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function parseOptionalInt(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseStringList(value: string | undefined): string[] | undefined {
  if (!value?.trim()) {
    return undefined;
  }
  const items = value
    .split(',')
    .map((item) => normalizeRepoPath(item.trim()))
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const normalizedLeft = [...left].sort();
  const normalizedRight = [...right].sort();
  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
}
