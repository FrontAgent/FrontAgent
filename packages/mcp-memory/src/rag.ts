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

const INDEX_VERSION = 4;
const EMBEDDING_STORE_VERSION = 2;
const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_KEYWORD_CANDIDATES = 40;
const DEFAULT_SEMANTIC_CANDIDATES = 40;
const DEFAULT_CHUNK_SIZE = 1200;
const DEFAULT_CHUNK_OVERLAP = 200;
const DEFAULT_MAX_FILE_SIZE_BYTES = 256 * 1024;
const DEFAULT_FETCH_TIMEOUT_MS = 30000;
const DEFAULT_EMBEDDING_BATCH_SIZE = 4;
const DEFAULT_EMBEDDING_MAX_BATCH_TOKENS = 6000;
const DEFAULT_EMBEDDING_MAX_RETRIES = 6;
const DEFAULT_EMBEDDING_RETRY_BASE_DELAY_MS = 1500;
const DEFAULT_EMBEDDING_INTER_BATCH_DELAY_MS = 250;
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
const DEFAULT_EMBEDDING_DIMENSIONS = 512;
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
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.tiff',
  '.pdf', '.zip', '.gz', '.tgz', '.7z', '.rar', '.mp3', '.mp4', '.mov',
  '.avi', '.mkv', '.woff', '.woff2', '.ttf', '.eot', '.otf', '.class',
  '.jar', '.exe', '.dll', '.so', '.dylib', '.bin', '.wasm', '.psd',
  '.drawio', '.sqlite', '.db', '.lock',
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
  embedding?: EmbeddingConfig;
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

interface ChunkCandidate {
  chunk: RepositoryChunk;
  score: number;
}

interface DocumentCandidate {
  document: RepositoryDocument;
  chunk: RepositoryChunk;
  score: number;
  rank: number;
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
        } else {
          warnings.push('Embedding API key is not configured; keyword-only search was used.');
        }
      }

      const fusedResults = fuseDocumentCandidates({
        keywordCandidates: keywordDocumentCandidates,
        semanticCandidates: semanticDocumentCandidates,
        maxResults,
        keywordWeight: this.config.keywordWeight,
        semanticWeight: this.config.semanticWeight,
      });

      return {
        success: true,
        syncedAt: index.source.syncedAt,
        sourceRevision: index.source.revision,
        searchMode,
        warnings: warnings.length > 0 ? warnings : undefined,
        results: fusedResults.map((result) => ({
          id: result.document.id,
          type: 'file',
          title: result.document.title,
          sourceUrl: result.document.sourceUrl,
          path: result.document.path,
          score: result.score,
          keywordScore: result.keywordScore,
          semanticScore: result.semanticScore,
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

  private getRepoDir(): string {
    return join(this.config.cacheDir, 'repo');
  }

  private getIndexPath(): string {
    return join(this.config.cacheDir, 'index.json');
  }

  private getEmbeddingStorePath(): string {
    return join(this.config.cacheDir, 'embeddings.json');
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
  embedding: Required<EmbeddingConfig>;
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
    index.build.maxFileSizeBytes === expected.maxFileSizeBytes
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
    const documentChunks = chunkText(content, input.chunkSize, input.chunkOverlap);
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
  chunkSize: number,
  chunkOverlap: number,
): Array<{ text: string; lineStart: number; lineEnd: number }> {
  const lines = content.split(/\r?\n/);
  if (lines.length === 0) {
    return [];
  }

  const chunks: Array<{ text: string; lineStart: number; lineEnd: number }> = [];
  let startLine = 0;

  while (startLine < lines.length) {
    let endLine = startLine;
    let currentLength = 0;

    while (endLine < lines.length) {
      const candidateLength = currentLength + lines[endLine].length + 1;
      if (candidateLength > chunkSize && endLine > startLine) {
        break;
      }
      currentLength = candidateLength;
      endLine++;
    }

    const text = lines.slice(startLine, endLine).join('\n').trim();
    if (text) {
      chunks.push({
        text,
        lineStart: startLine + 1,
        lineEnd: endLine,
      });
    }

    if (endLine >= lines.length) {
      break;
    }

    let overlapChars = 0;
    let nextStart = endLine;
    while (nextStart > startLine + 1 && overlapChars < chunkOverlap) {
      nextStart--;
      overlapChars += lines[nextStart].length + 1;
    }

    startLine = Math.max(nextStart, startLine + 1);
  }

  return chunks;
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
}): Array<DocumentCandidate & { keywordScore?: number; semanticScore?: number }> {
  const keywordMax = input.keywordCandidates[0]?.score ?? 0;
  const semanticMax = input.semanticCandidates[0]?.score ?? 0;
  const fused = new Map<string, DocumentCandidate & { keywordScore?: number; semanticScore?: number }>();

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
  const normalized = input.toLowerCase();
  const latinMatches = normalized.match(/[a-z0-9_@./:-]+/g) ?? [];
  for (const match of latinMatches) {
    if (match.length >= 2) {
      tokens.push(match);
    }
  }

  const cjkMatches = normalized.match(/[\u4e00-\u9fff]+/g) ?? [];
  for (const match of cjkMatches) {
    if (match.length === 1) {
      tokens.push(match);
      continue;
    }
    for (let i = 0; i < match.length - 1; i++) {
      tokens.push(match.slice(i, i + 2));
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
    chunk.text,
  ].join('\n');
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
  // Use a conservative heuristic because some gateways enforce a strict total-token
  // budget across the entire embedding batch, not per individual input.
  return Math.max(1, input.length);
}

function getTopLevelDir(path: string): string {
  const firstSegment = normalizeRepoPath(path).split('/')[0];
  return firstSegment || 'root';
}

function normalizeRepoPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.?\//, '').replace(/^\/+/, '');
}

function normalizeBaseUrl(baseURL: string): string {
  return baseURL.replace(/\/+$/, '');
}

function normalizeEmbeddingBaseUrl(baseURL: string): string {
  const normalized = normalizeBaseUrl(baseURL);
  return normalized.endsWith('/embeddings') ? normalized : `${normalized}/embeddings`;
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
