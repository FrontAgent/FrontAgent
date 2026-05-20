import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AgentConfig, FilesenseConfig, RagConfig } from '@frontagent/core';
import type { SecurityMode, TaskType } from '@frontagent/shared';

export type LLMProvider = 'openai' | 'anthropic';

export interface RuntimeConfigInput {
  provider?: string;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  maxTokens?: string | number;
  temperature?: string | number;
  topP?: string | number;
  topK?: string | number;
  engine?: string;
  langgraphCheckpoint?: boolean;
  maxRecoveryAttempts?: string | number;
  securityMode?: string;
  disableRag?: boolean;
  ragSource?: string;
  ragSyncOnQuery?: boolean | string;
  ragRepo?: string;
  ragBranch?: string;
  ragMaxResults?: string | number;
  ragKeywordCandidates?: string | number;
  ragSemanticCandidates?: string | number;
  ragKeywordWeight?: string | number;
  ragSemanticWeight?: string | number;
  ragChunkSize?: string | number;
  ragChunkOverlap?: string | number;
  ragMaxFileSizeKb?: string | number;
  ragExcludePath?: string[];
  disableRagQueryRewrite?: boolean;
  ragQueryRewriteMaxTokens?: string | number;
  ragQueryRewriteTemperature?: string | number;
  disableRagReranker?: boolean;
  ragRerankerModel?: string;
  ragRerankerBaseUrl?: string;
  ragRerankerApiKey?: string;
  ragRerankerCandidateCount?: string | number;
  ragRerankerMaxDocumentChars?: string | number;
  ragRerankerTimeoutMs?: string | number;
  disableRagSemantic?: boolean;
  ragEmbeddingModel?: string;
  ragEmbeddingBaseUrl?: string;
  ragEmbeddingApiKey?: string;
  ragEmbeddingDimensions?: string | number;
  ragEmbeddingBatchSize?: string | number;
  ragEmbeddingTimeoutMs?: string | number;
  ragVectorStoreProvider?: string;
  ragWeaviateUrl?: string;
  ragWeaviateApiKey?: string;
  ragWeaviateCollectionPrefix?: string;
  ragWeaviateBatchSize?: string | number;
  ragWeaviateTimeoutMs?: string | number;
  openVikingEnabled?: boolean | string;
  openVikingEndpoint?: string;
  openVikingApiKey?: string;
  openVikingCorpus?: string;
  openVikingNamespace?: string;
  openVikingL1Entry?: string;
  openVikingTimeoutMs?: string | number;
  disableOpenVikingFallback?: boolean;
  filesenseEnabled?: boolean | string;
  filesenseOutput?: string;
  filesenseWriteMode?: string;
  filesenseMaxEntries?: string | number;
  filesenseMaxBytes?: string | number;
  filesenseTimeoutMs?: string | number;
}

export interface ResolvedRuntimeConfig {
  provider: LLMProvider;
  model: string;
  llm: AgentConfig['llm'];
  execution: AgentConfig['execution'];
  rag: RagConfig;
  filesense: FilesenseConfig;
  securityMode: SecurityMode;
}

const currentModuleDir = dirname(fileURLToPath(import.meta.url));

export function resolveBuiltInSkillRoots(extraRoots: string[] = []): string[] {
  const candidates = [
    ...extraRoots,
    resolve(currentModuleDir, '..', 'skills'),
    resolve(currentModuleDir, '..', '..', 'skills'),
    resolve(currentModuleDir, '..', '..', '..', 'skills'),
    resolve(currentModuleDir, '..', '..', '..', '..', 'skills'),
  ];

  return [...new Set(candidates.filter((candidate) => existsSync(candidate)))];
}

export function getDefaultModel(provider: LLMProvider): string {
  return provider === 'openai' ? 'gpt-4-turbo' : 'claude-3-5-sonnet-20241022';
}

export function parseOptionalInt(value: string | number | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseOptionalFloat(value: string | number | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
    return true;
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
    return false;
  }
  return undefined;
}

export function parsePathList(values: string[] | undefined, fallback?: string): string[] | undefined {
  if (values && values.length > 0) {
    return values.map((value) => value.trim()).filter(Boolean);
  }
  if (!fallback?.trim()) return undefined;
  return fallback
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeFilesenseOutput(value: string | undefined): FilesenseConfig['output'] | undefined {
  return value === 'summary' || value === 'candidates' || value === 'verbose' ? value : undefined;
}

function normalizeFilesenseWriteMode(value: string | undefined): FilesenseConfig['writeMode'] | undefined {
  return value === 'cache' || value === 'workspace' || value === 'none' ? value : undefined;
}

export function resolveProviderApiKey(
  provider: LLMProvider,
  explicitValue?: string,
): string | undefined {
  return explicitValue ?? process.env[`${provider.toUpperCase()}_API_KEY`] ?? process.env.API_KEY;
}

export function resolveProviderBaseURL(
  provider: LLMProvider,
  explicitValue?: string,
): string | undefined {
  const raw = explicitValue ?? process.env[`${provider.toUpperCase()}_BASE_URL`] ?? process.env.BASE_URL;
  if (!raw) return undefined;

  const normalized = raw.replace(/\/+$/, '');
  if (provider === 'openai') {
    return normalized.replace(/\/chat\/completions$/, '');
  }
  const anthropicBaseURL = normalized.replace(/\/messages$/, '');
  return anthropicBaseURL.endsWith('/v1') ? anthropicBaseURL : `${anthropicBaseURL}/v1`;
}

export function resolveEmbeddingBaseURL(baseURL?: string): string | undefined {
  if (!baseURL) return undefined;
  const normalized = baseURL
    .replace(/\/+$/, '')
    .replace(/\/chat\/completions$/, '');
  return normalized.endsWith('/embeddings') ? normalized : `${normalized}/embeddings`;
}

export function getDefaultRagCacheDir(cwd = process.cwd()): string {
  return resolve(cwd, '.frontagent', 'rag-cache');
}

export function parseTaskType(value?: string): TaskType {
  return value === 'create' ||
    value === 'modify' ||
    value === 'debug' ||
    value === 'refactor' ||
    value === 'test' ||
    value === 'query'
    ? value
    : 'query';
}

export function parseSecurityMode(value: unknown): SecurityMode {
  return value === 'strict' || value === 'developer' || value === 'balanced'
    ? value
    : 'balanced';
}

export function resolveRuntimeConfig(
  input: RuntimeConfigInput,
  projectRoot: string,
): ResolvedRuntimeConfig {
  const provider = (input.provider || process.env.PROVIDER || 'anthropic').toLowerCase() as LLMProvider;
  const safeProvider: LLMProvider = provider === 'openai' ? 'openai' : 'anthropic';
  const model = input.model || process.env.MODEL || getDefaultModel(safeProvider);
  const resolvedLlmApiKey = resolveProviderApiKey(safeProvider, input.apiKey);
  const resolvedLlmBaseURL = resolveProviderBaseURL(safeProvider, input.baseUrl);
  const ragCacheDir = getDefaultRagCacheDir(projectRoot);
  const ragExcludedPathPrefixes = parsePathList(
    input.ragExcludePath,
    process.env.FRONTAGENT_RAG_EXCLUDE_PATHS,
  );

  const ragEnabled = !input.disableRag;
  const ragSyncOnQuery =
    parseOptionalBoolean(input.ragSyncOnQuery) ??
    parseOptionalBoolean(process.env.FRONTAGENT_RAG_SYNC_ON_QUERY) ??
    false;
  const openVikingEndpoint = input.openVikingEndpoint ?? process.env.FRONTAGENT_OPENVIKING_ENDPOINT;
  const ragSource = input.ragSource ?? process.env.FRONTAGENT_RAG_SOURCE;
  const rag: RagConfig = {
    enabled: ragEnabled,
    source: ragSource === 'git' || ragSource === 'openviking' || ragSource === 'composite'
      ? ragSource
      : openVikingEndpoint
        ? 'composite'
        : 'git',
    openViking: {
      enabled:
        parseOptionalBoolean(input.openVikingEnabled) ??
        parseOptionalBoolean(process.env.FRONTAGENT_OPENVIKING_ENABLED) ??
        Boolean(openVikingEndpoint),
      endpoint: openVikingEndpoint,
      apiKey: input.openVikingApiKey ?? process.env.FRONTAGENT_OPENVIKING_API_KEY,
      corpus: input.openVikingCorpus ?? process.env.FRONTAGENT_OPENVIKING_CORPUS,
      namespace: input.openVikingNamespace ?? process.env.FRONTAGENT_OPENVIKING_NAMESPACE,
      l1Entry:
        input.openVikingL1Entry ??
        process.env.FRONTAGENT_OPENVIKING_L1_ENTRY ??
        'docs/openviking/frontagent-l1.md',
      timeoutMs: parseOptionalInt(input.openVikingTimeoutMs) ?? parseOptionalInt(process.env.FRONTAGENT_OPENVIKING_TIMEOUT_MS),
      fallbackToGit: !input.disableOpenVikingFallback,
    },
    repoUrl: input.ragRepo ?? process.env.FRONTAGENT_RAG_REPO ?? 'https://github.com/ceilf6/Lab.git',
    branch: input.ragBranch ?? process.env.FRONTAGENT_RAG_BRANCH ?? 'main',
    maxResults: parseOptionalInt(input.ragMaxResults) || 5,
    cacheDir: ragCacheDir,
    syncOnQuery: ragSyncOnQuery,
    excludedPathPrefixes: ragExcludedPathPrefixes,
    keywordCandidateCount: parseOptionalInt(input.ragKeywordCandidates),
    semanticCandidateCount: parseOptionalInt(input.ragSemanticCandidates),
    keywordWeight: parseOptionalFloat(input.ragKeywordWeight),
    semanticWeight: parseOptionalFloat(input.ragSemanticWeight),
    chunkSize: parseOptionalInt(input.ragChunkSize),
    chunkOverlap: parseOptionalInt(input.ragChunkOverlap),
    maxFileSizeBytes: (() => {
      const sizeKb = parseOptionalInt(input.ragMaxFileSizeKb);
      return sizeKb ? sizeKb * 1024 : undefined;
    })(),
    queryRewrite: {
      enabled: !input.disableRagQueryRewrite,
      maxTokens: parseOptionalInt(input.ragQueryRewriteMaxTokens),
      temperature: parseOptionalFloat(input.ragQueryRewriteTemperature),
    },
    reranker: {
      enabled: !(
        input.disableRagReranker ||
        process.env.FRONTAGENT_RAG_RERANKER_ENABLED === '0' ||
        process.env.FRONTAGENT_RAG_RERANKER_ENABLED === 'false'
      ),
      model: input.ragRerankerModel ?? process.env.FRONTAGENT_RAG_RERANKER_MODEL,
      baseURL:
        input.ragRerankerBaseUrl ??
        process.env.FRONTAGENT_RAG_RERANKER_BASE_URL ??
        resolvedLlmBaseURL,
      apiKey:
        input.ragRerankerApiKey ??
        process.env.FRONTAGENT_RAG_RERANKER_API_KEY ??
        resolvedLlmApiKey,
      candidateCount: parseOptionalInt(input.ragRerankerCandidateCount),
      maxDocumentChars: parseOptionalInt(input.ragRerankerMaxDocumentChars),
      requestTimeoutMs: parseOptionalInt(input.ragRerankerTimeoutMs),
    },
    embedding: {
      enabled: !input.disableRagSemantic,
      model: input.ragEmbeddingModel,
      baseURL:
        input.ragEmbeddingBaseUrl ??
        process.env.FRONTAGENT_RAG_EMBEDDING_BASE_URL ??
        (safeProvider === 'openai' ? resolveEmbeddingBaseURL(resolvedLlmBaseURL) : undefined),
      apiKey:
        input.ragEmbeddingApiKey ??
        process.env.FRONTAGENT_RAG_EMBEDDING_API_KEY ??
        (safeProvider === 'openai' ? resolvedLlmApiKey : undefined),
      dimensions: parseOptionalInt(input.ragEmbeddingDimensions),
      batchSize: parseOptionalInt(input.ragEmbeddingBatchSize),
      requestTimeoutMs: parseOptionalInt(input.ragEmbeddingTimeoutMs),
    },
    vectorStore: {
      provider:
        (input.ragVectorStoreProvider as 'local' | 'weaviate' | undefined) ??
        (process.env.FRONTAGENT_RAG_VECTOR_STORE_PROVIDER as 'local' | 'weaviate' | undefined) ??
        ((input.ragWeaviateUrl ?? process.env.FRONTAGENT_RAG_WEAVIATE_URL)
          ? 'weaviate'
          : undefined),
      weaviate: {
        baseURL: input.ragWeaviateUrl ?? process.env.FRONTAGENT_RAG_WEAVIATE_URL,
        apiKey: input.ragWeaviateApiKey ?? process.env.FRONTAGENT_RAG_WEAVIATE_API_KEY,
        collectionPrefix:
          input.ragWeaviateCollectionPrefix ??
          process.env.FRONTAGENT_RAG_WEAVIATE_COLLECTION_PREFIX,
        batchSize: parseOptionalInt(input.ragWeaviateBatchSize),
        requestTimeoutMs: parseOptionalInt(input.ragWeaviateTimeoutMs),
      },
    },
  };

  const executionEngineRaw = (
    input.engine ||
    process.env.EXECUTION_ENGINE ||
    'native'
  ).toLowerCase();
  const executionEngine = executionEngineRaw === 'langgraph' ? 'langgraph' : 'native';
  const useLangGraphCheckpoint = Boolean(
    input.langgraphCheckpoint ||
      process.env.LANGGRAPH_CHECKPOINT === '1' ||
      process.env.LANGGRAPH_CHECKPOINT === 'true',
  );

  const filesense: FilesenseConfig = {
    enabled:
      parseOptionalBoolean(input.filesenseEnabled) ??
      parseOptionalBoolean(process.env.FRONTAGENT_FILESENSE_ENABLED) ??
      true,
    output: normalizeFilesenseOutput(input.filesenseOutput ?? process.env.FRONTAGENT_FILESENSE_OUTPUT),
    writeMode: normalizeFilesenseWriteMode(input.filesenseWriteMode ?? process.env.FRONTAGENT_FILESENSE_WRITE_MODE),
    maxEntries: parseOptionalInt(input.filesenseMaxEntries) ?? parseOptionalInt(process.env.FRONTAGENT_FILESENSE_MAX_ENTRIES),
    maxBytes: parseOptionalInt(input.filesenseMaxBytes) ?? parseOptionalInt(process.env.FRONTAGENT_FILESENSE_MAX_BYTES),
    timeoutMs: parseOptionalInt(input.filesenseTimeoutMs) ?? parseOptionalInt(process.env.FRONTAGENT_FILESENSE_TIMEOUT_MS),
  };

  return {
    provider: safeProvider,
    model,
    llm: {
      provider: safeProvider,
      model,
      baseURL: resolvedLlmBaseURL,
      apiKey: resolvedLlmApiKey,
      maxTokens: parseOptionalInt(input.maxTokens) ?? 4096,
      temperature: parseOptionalFloat(input.temperature) ?? 0.7,
      topP: parseOptionalFloat(input.topP) ?? parseOptionalFloat(process.env.TOP_P),
      topK: parseOptionalInt(input.topK) ?? parseOptionalInt(process.env.TOP_K),
    },
    execution: {
      engine: executionEngine,
      langGraph: {
        useCheckpoint: useLangGraphCheckpoint,
        maxRecoveryAttempts: parseOptionalInt(input.maxRecoveryAttempts) || 3,
        threadIdPrefix: 'frontagent',
      },
    },
    rag,
    filesense,
    securityMode: parseSecurityMode(input.securityMode ?? process.env.FRONTAGENT_SECURITY_MODE),
  };
}
