import { aggregateChunkCandidates } from './bm25.js';
import { isCompatibleEmbeddingStore } from './embedding.js';
import { searchSemantic } from './semantic.js';
import type {
  ChunkCandidate,
  DocumentCandidate,
  EmbeddingStore,
  RagMetadataFilter,
  RagQueryResult,
  RepositoryIndex,
  RequiredHybridConfig,
  WeaviateVectorStoreState,
} from './types.js';
import { searchSemanticWithWeaviate } from './weaviate.js';

type SearchLocalSemantic = (
  query: string,
  index: RepositoryIndex,
  embeddingStore: EmbeddingStore,
  config: RequiredHybridConfig['embedding'],
  limit: number,
) => Promise<ChunkCandidate[]>;

type SearchWeaviateSemantic = (
  query: string,
  index: RepositoryIndex,
  embeddingConfig: RequiredHybridConfig['embedding'],
  weaviateConfig: RequiredHybridConfig['vectorStore']['weaviate'],
  collectionName: string,
  limit: number,
) => Promise<ChunkCandidate[]>;

export interface SemanticSearchOrchestrationInput {
  queryText: string;
  index: RepositoryIndex;
  filters?: RagMetadataFilter;
  config: RequiredHybridConfig;
  ensureEmbeddings: (index: RepositoryIndex) => Promise<EmbeddingStore>;
  readEmbeddingStore: () => Promise<EmbeddingStore | null>;
  ensureWeaviateSemanticIndex: (index: RepositoryIndex) => Promise<WeaviateVectorStoreState>;
  weaviateCollectionName: string;
  searchLocalSemantic?: SearchLocalSemantic;
  searchWeaviateSemantic?: SearchWeaviateSemantic;
}

export interface SemanticSearchOrchestrationResult {
  semanticDocumentCandidates: DocumentCandidate[];
  searchMode: RagQueryResult['searchMode'];
  warnings: string[];
}

export async function runSemanticSearchOrchestration(
  input: SemanticSearchOrchestrationInput,
): Promise<SemanticSearchOrchestrationResult> {
  const semanticDocumentCandidates: DocumentCandidate[] = [];
  const warnings: string[] = [];
  const searchMode: RagQueryResult['searchMode'] = 'keyword_only';

  if (!input.config.embedding.enabled) {
    return { semanticDocumentCandidates, searchMode, warnings };
  }

  if (!input.config.embedding.apiKey) {
    warnings.push('Embedding API key is not configured; keyword-only search was used.');
    return { semanticDocumentCandidates, searchMode, warnings };
  }

  if (input.config.vectorStore.provider === 'weaviate') {
    return runWeaviateSemanticSearch(input);
  }

  return runLocalSemanticSearch(input);
}

async function runWeaviateSemanticSearch(
  input: SemanticSearchOrchestrationInput,
): Promise<SemanticSearchOrchestrationResult> {
  const warnings: string[] = [];

  if (!input.config.vectorStore.weaviate.baseURL) {
    warnings.push('Weaviate base URL is not configured; keyword-only search was used.');
    return {
      semanticDocumentCandidates: [],
      searchMode: 'keyword_only',
      warnings,
    };
  }

  try {
    await input.ensureWeaviateSemanticIndex(input.index);
    const semanticChunkCandidates = await (
      input.searchWeaviateSemantic ?? searchSemanticWithWeaviate
    )(
      input.queryText,
      input.index,
      input.config.embedding,
      input.config.vectorStore.weaviate,
      input.weaviateCollectionName,
      input.config.semanticCandidateCount,
    );
    return buildSemanticResult(semanticChunkCandidates, input, warnings);
  } catch (error) {
    warnings.push(
      `Semantic search unavailable: ${error instanceof Error ? error.message : String(error)}`,
    );
    return {
      semanticDocumentCandidates: [],
      searchMode: 'keyword_only',
      warnings,
    };
  }
}

async function runLocalSemanticSearch(
  input: SemanticSearchOrchestrationInput,
): Promise<SemanticSearchOrchestrationResult> {
  const warnings: string[] = [];
  let embeddingStore: EmbeddingStore | null = null;

  try {
    embeddingStore = await input.ensureEmbeddings(input.index);
  } catch (error) {
    const cachedStore = await input.readEmbeddingStore();
    const usedPartialEmbeddingCache =
      Boolean(cachedStore && isCompatibleEmbeddingStore(cachedStore, input.config.embedding)) &&
      Object.keys(cachedStore?.vectors ?? {}).length > 0;

    if (cachedStore && usedPartialEmbeddingCache) {
      embeddingStore = cachedStore;
      warnings.push(
        `Semantic index build interrupted: ${error instanceof Error ? error.message : String(error)} Using cached semantic vectors built so far.`,
      );
    } else {
      warnings.push(
        `Semantic search unavailable: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (!embeddingStore) {
    return {
      semanticDocumentCandidates: [],
      searchMode: 'keyword_only',
      warnings,
    };
  }

  try {
    const semanticChunkCandidates = await (input.searchLocalSemantic ?? searchSemantic)(
      input.queryText,
      input.index,
      embeddingStore,
      input.config.embedding,
      input.config.semanticCandidateCount,
    );
    return buildSemanticResult(semanticChunkCandidates, input, warnings);
  } catch (error) {
    warnings.push(
      `Semantic search unavailable: ${error instanceof Error ? error.message : String(error)}`,
    );
    return {
      semanticDocumentCandidates: [],
      searchMode: 'keyword_only',
      warnings,
    };
  }
}

function buildSemanticResult(
  semanticChunkCandidates: ChunkCandidate[],
  input: SemanticSearchOrchestrationInput,
  warnings: string[],
): SemanticSearchOrchestrationResult {
  const semanticDocumentCandidates = aggregateChunkCandidates(
    semanticChunkCandidates,
    input.index,
    input.filters,
  );

  if (semanticDocumentCandidates.length > 0) {
    return {
      semanticDocumentCandidates,
      searchMode: 'hybrid',
      warnings,
    };
  }

  warnings.push('Semantic search returned no candidates; keyword results were used.');
  return {
    semanticDocumentCandidates,
    searchMode: 'keyword_only',
    warnings,
  };
}
