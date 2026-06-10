import { existsSync, mkdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { aggregateChunkCandidates, buildSnippet, searchBm25 } from './bm25.js';
import { normalizeConfig, normalizeFiltersForCache, validateMetadataFilters } from './config.js';
import {
  buildEmbeddingInput,
  createEmbeddingBatches,
  estimateEmbeddingTokens,
  fetchEmbeddings,
  normalizeVector,
} from './embedding.js';
import {
  buildRepositoryIndex,
  canReuseIndex,
  ensureRepositoryCheckout,
  getRepositoryHead,
  getSubmodulePaths,
} from './repository.js';
import { fuseDocumentCandidates, rerankDocumentCandidates } from './reranker.js';
import { runSemanticSearchOrchestration } from './semantic-orchestration.js';
import type {
  DocumentCandidate,
  EmbeddingStore,
  KnowledgeBaseConfig,
  RagMetadataFilter,
  RagQueryParams,
  RagQueryResult,
  RagQueryTiming,
  RepositoryIndex,
  RequiredHybridConfig,
  WeaviateVectorStoreState,
} from './types.js';
import {
  DEFAULT_EMBEDDING_INTER_BATCH_DELAY_MS,
  DEFAULT_EMBEDDING_MAX_BATCH_TOKENS,
  DEFAULT_RAG_QUERY_CACHE_SIZE,
  EMBEDDING_STORE_VERSION,
  INDEX_VERSION,
  VECTOR_STORE_STATE_VERSION,
} from './types.js';
import { normalizeRepoPath, sleep } from './utils.js';
import {
  deleteWeaviateCollection,
  ensureWeaviateCollection,
  getWeaviateCollectionName,
  upsertWeaviateObjects,
} from './weaviate.js';

export class HybridRepositoryKnowledgeBase {
  private readonly config: RequiredHybridConfig;
  private readonly queryCache = new Map<string, RagQueryResult>();
  private cachedIndex: RepositoryIndex | null = null;

  constructor(config: KnowledgeBaseConfig) {
    this.config = normalizeConfig(config);
  }

  async query(params: RagQueryParams): Promise<RagQueryResult> {
    if (!params.query?.trim()) {
      return { success: false, error: 'query is required' };
    }

    try {
      const warnings: string[] = [];
      const timing: RagQueryTiming = {
        ensureIndexMs: 0,
        bm25Ms: 0,
        semanticMs: 0,
        fusionMs: 0,
        rerankMs: 0,
        totalMs: 0,
        cacheHit: false,
      };
      const queryStartedAt = performance.now();
      const queryText = params.query.trim();
      const maxResults = params.maxResults ?? this.config.maxResults;
      const filters = params.filters;
      const filterError = validateMetadataFilters(filters);
      if (filterError) {
        return { success: false, error: filterError };
      }
      const ensureIndexStartedAt = performance.now();
      const index = await this.ensureIndex(Boolean(params.refresh));
      timing.ensureIndexMs = performance.now() - ensureIndexStartedAt;

      const cacheKey = this.createQueryCacheKey(queryText, maxResults, filters, index);
      const cachedResult = params.refresh ? undefined : this.queryCache.get(cacheKey);
      if (cachedResult) {
        this.queryCache.delete(cacheKey);
        this.queryCache.set(cacheKey, cachedResult);
        const cachedTiming = cachedResult.timing;
        return {
          ...cachedResult,
          timing: {
            ensureIndexMs: timing.ensureIndexMs,
            bm25Ms: cachedTiming?.bm25Ms ?? 0,
            semanticMs: cachedTiming?.semanticMs ?? 0,
            fusionMs: cachedTiming?.fusionMs ?? 0,
            rerankMs: cachedTiming?.rerankMs ?? 0,
            totalMs: performance.now() - queryStartedAt,
            cacheHit: true,
          },
        };
      }

      const bm25StartedAt = performance.now();
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
      timing.bm25Ms = performance.now() - bm25StartedAt;

      let semanticDocumentCandidates: DocumentCandidate[] = [];
      let searchMode: RagQueryResult['searchMode'] = 'keyword_only';

      if (this.config.embedding.enabled) {
        const semanticStartedAt = performance.now();
        try {
          const semanticResult = await runSemanticSearchOrchestration({
            queryText,
            index,
            filters,
            config: this.config,
            ensureEmbeddings: (index) => this.ensureEmbeddings(index),
            readEmbeddingStore: () => this.readEmbeddingStore(),
            ensureWeaviateSemanticIndex: (index) => this.ensureWeaviateSemanticIndex(index),
            weaviateCollectionName: getWeaviateCollectionName(this.config),
          });
          semanticDocumentCandidates = semanticResult.semanticDocumentCandidates;
          searchMode = semanticResult.searchMode;
          warnings.push(...semanticResult.warnings);
        } finally {
          timing.semanticMs = performance.now() - semanticStartedAt;
        }
      }

      const fusionStartedAt = performance.now();
      const fusedResults = fuseDocumentCandidates({
        keywordCandidates: keywordDocumentCandidates,
        semanticCandidates: semanticDocumentCandidates,
        maxResults: Math.max(maxResults, this.config.reranker.candidateCount),
        keywordWeight: this.config.keywordWeight,
        semanticWeight: this.config.semanticWeight,
      });
      timing.fusionMs = performance.now() - fusionStartedAt;

      let reranked = false;
      let finalResults = fusedResults.slice(0, maxResults);
      if (this.config.reranker.enabled) {
        const rerankStartedAt = performance.now();
        try {
          if (
            this.config.reranker.model &&
            this.config.reranker.baseURL &&
            this.config.reranker.apiKey
          ) {
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
                `Reranking unavailable: ${error instanceof Error ? error.message : String(error)}`,
              );
            }
          }
        } finally {
          timing.rerankMs = performance.now() - rerankStartedAt;
        }
      }

      timing.totalMs = performance.now() - queryStartedAt;

      const result: RagQueryResult = {
        success: true,
        syncedAt: index.source.syncedAt,
        sourceRevision: index.source.revision,
        searchMode,
        reranked,
        timing,
        warnings: warnings.length > 0 ? warnings : undefined,
        results: finalResults.map((r) => ({
          id: r.document.id,
          type: 'file',
          title: r.document.title,
          sourceUrl: r.document.sourceUrl,
          path: r.document.path,
          score: r.score,
          keywordScore: r.keywordScore,
          semanticScore: r.semanticScore,
          rerankScore: r.rerankScore,
          snippet: buildSnippet(r.chunk.text, queryText),
          metadata: {
            topLevelDir: r.chunk.metadata.topLevelDir,
            extension: r.chunk.metadata.extension,
            chunkIndex: r.chunk.metadata.chunkIndex,
            lineStart: r.chunk.metadata.lineStart,
            lineEnd: r.chunk.metadata.lineEnd,
          },
        })),
      };

      this.setQueryCache(cacheKey, result);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private createQueryCacheKey(
    queryText: string,
    maxResults: number,
    filters: RagMetadataFilter | undefined,
    index: RepositoryIndex,
  ): string {
    return JSON.stringify({
      queryText,
      maxResults,
      filters: normalizeFiltersForCache(filters),
      revision: index.source.revision,
      indexVersion: index.version,
      embedding: {
        enabled: this.config.embedding.enabled,
        model: this.config.embedding.model,
        baseURL: this.config.embedding.baseURL,
        dimensions: this.config.embedding.dimensions,
      },
      vectorStoreProvider: this.config.vectorStore.provider,
      reranker: {
        enabled: this.config.reranker.enabled,
        model: this.config.reranker.model,
        candidateCount: this.config.reranker.candidateCount,
      },
      candidates: {
        keyword: this.config.keywordCandidateCount,
        semantic: this.config.semanticCandidateCount,
      },
      weights: {
        keyword: this.config.keywordWeight,
        semantic: this.config.semanticWeight,
      },
    });
  }

  private setQueryCache(key: string, result: RagQueryResult): void {
    this.queryCache.set(key, result);
    while (this.queryCache.size > DEFAULT_RAG_QUERY_CACHE_SIZE) {
      const oldestKey = this.queryCache.keys().next().value;
      if (!oldestKey) break;
      this.queryCache.delete(oldestKey);
    }
  }

  private async ensureIndex(forceRefresh: boolean): Promise<RepositoryIndex> {
    mkdirSync(this.config.cacheDir, { recursive: true });
    const targetRepoDir = this.getRepoDir();
    if (this.cachedIndex && this.canReuseWarmIndex(this.cachedIndex, targetRepoDir, forceRefresh)) {
      return this.cachedIndex;
    }

    this.cachedIndex = null;
    const existing = await this.readIndex();
    if (existing && this.canReuseWarmIndex(existing, targetRepoDir, forceRefresh)) {
      this.cachedIndex = existing;
      return existing;
    }

    const shouldSyncRepository =
      forceRefresh || this.config.syncOnQuery || !existing || !existsSync(targetRepoDir);
    const repoDir = await ensureRepositoryCheckout({
      repoUrl: this.config.repoUrl,
      branch: this.config.branch,
      repoDir: targetRepoDir,
      sync: shouldSyncRepository,
    });
    const revision = await getRepositoryHead(repoDir);
    const submodulePaths = await getSubmodulePaths(repoDir);
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
      this.cachedIndex = existing;
      return existing;
    }

    const index = await buildRepositoryIndex({
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
    await this.writeIndex(index);
    this.cachedIndex = index;
    return index;
  }

  private canReuseWarmIndex(
    index: RepositoryIndex,
    repoDir: string,
    forceRefresh: boolean,
  ): boolean {
    return (
      !forceRefresh &&
      !this.config.syncOnQuery &&
      existsSync(repoDir) &&
      index.source.repoUrl === this.config.repoUrl &&
      index.source.branch === this.config.branch &&
      index.source.repoDir === repoDir &&
      index.build.chunkSize === this.config.chunkSize &&
      index.build.chunkOverlap === this.config.chunkOverlap &&
      index.build.maxFileSizeBytes === this.config.maxFileSizeBytes &&
      index.build.chunkingStrategy === 'semantic-v2' &&
      this.config.excludedPathPrefixes.every((prefix) =>
        index.source.excludedPathPrefixes.includes(normalizeRepoPath(prefix)),
      )
    );
  }

  private async readIndex(): Promise<RepositoryIndex | null> {
    const indexPath = this.getIndexPath();
    if (!existsSync(indexPath)) {
      return null;
    }

    try {
      const parsed = JSON.parse(await readFile(indexPath, 'utf-8')) as RepositoryIndex;
      if (parsed.version !== INDEX_VERSION) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private async writeIndex(index: RepositoryIndex): Promise<void> {
    await writeFile(this.getIndexPath(), JSON.stringify(index, null, 2), 'utf-8');
  }

  private async ensureEmbeddings(index: RepositoryIndex): Promise<EmbeddingStore> {
    const current = await this.readEmbeddingStore();
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
      await this.writeEmbeddingStore(store);

      if (batches.length > 1) {
        await sleep(DEFAULT_EMBEDDING_INTER_BATCH_DELAY_MS);
      }
    }

    store.updatedAt = new Date().toISOString();
    await this.writeEmbeddingStore(store);
    return store;
  }

  private async readEmbeddingStore(): Promise<EmbeddingStore | null> {
    const path = this.getEmbeddingStorePath();
    if (!existsSync(path)) {
      return null;
    }

    try {
      const parsed = JSON.parse(await readFile(path, 'utf-8')) as EmbeddingStore;
      if (parsed.version !== EMBEDDING_STORE_VERSION) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private async writeEmbeddingStore(store: EmbeddingStore): Promise<void> {
    await writeFile(this.getEmbeddingStorePath(), JSON.stringify(store), 'utf-8');
  }

  private async ensureWeaviateSemanticIndex(
    index: RepositoryIndex,
  ): Promise<WeaviateVectorStoreState> {
    const collectionName = getWeaviateCollectionName(this.config);
    const current = await this.readWeaviateVectorStoreState();
    const collectionStatus = await ensureWeaviateCollection(
      this.config.vectorStore.weaviate,
      collectionName,
    );
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
      Math.max(
        1,
        Math.min(this.config.embedding.batchSize, this.config.vectorStore.weaviate.batchSize),
      ),
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
    await this.writeWeaviateVectorStoreState(state);
    return state;
  }

  private async readWeaviateVectorStoreState(): Promise<WeaviateVectorStoreState | null> {
    const path = this.getVectorStoreStatePath();
    if (!existsSync(path)) {
      return null;
    }

    try {
      const parsed = JSON.parse(await readFile(path, 'utf-8')) as WeaviateVectorStoreState;
      if (parsed.version !== VECTOR_STORE_STATE_VERSION) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private async writeWeaviateVectorStoreState(state: WeaviateVectorStoreState): Promise<void> {
    await writeFile(this.getVectorStoreStatePath(), JSON.stringify(state, null, 2), 'utf-8');
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
