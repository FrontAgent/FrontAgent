/**
 * `frontagent run` command — Ink TUI version.
 *
 * Agent execution is driven by core events that flow through the event
 * bridge into the external store. The Ink component tree reads from the
 * store via useSyncExternalStore, keeping renders proportional to state
 * changes rather than raw event volume.
 *
 * Streaming tokens bypass the store entirely (Tier 2) and are flushed
 * to the StreamView component on a timer.
 */

import { render } from 'ink';
import chalk from 'chalk';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createAgent, type AgentConfig } from '@frontagent/core';
import { FileMCPClient, MemoryMCPClient, WebMCPClient } from '../mcp-client.js';
import { createShellMCPClient } from '@frontagent/mcp-shell';
import {
  resolveBuiltInSkillRoots,
  resolveProviderApiKey,
  resolveProviderBaseURL,
  resolveEmbeddingBaseURL,
  getDefaultModel,
  parseOptionalInt,
  parseOptionalFloat,
  parsePathList,
} from '../bootstrap.js';
import { createStore } from '../ui/store.js';
import { createEventBridge } from '../ui/bridge.js';
import { App } from '../ui/components/App.js';

type TokenListener = (token: string) => void;

function createStreamTokenEmitter() {
  const listeners = new Set<TokenListener>();
  return {
    emit(token: string) {
      for (const l of listeners) l(token);
    },
    subscribe(cb: TokenListener) {
      listeners.add(cb);
      return () => { listeners.delete(cb); };
    },
  };
}

function buildRagConfig(
  options: Record<string, any>,
  ragEnabled: boolean,
  ragCacheDir: string,
  ragExcludedPathPrefixes: string[] | undefined,
  resolvedLlmBaseURL: string | undefined,
  resolvedLlmApiKey: string | undefined,
  provider: 'openai' | 'anthropic',
): NonNullable<AgentConfig['rag']> {
  return {
    enabled: ragEnabled,
    repoUrl: options.ragRepo,
    branch: options.ragBranch,
    maxResults: parseOptionalInt(options.ragMaxResults) || 5,
    cacheDir: ragCacheDir,
    syncOnQuery: true,
    excludedPathPrefixes: ragExcludedPathPrefixes,
    keywordCandidateCount: parseOptionalInt(options.ragKeywordCandidates),
    semanticCandidateCount: parseOptionalInt(options.ragSemanticCandidates),
    keywordWeight: parseOptionalFloat(options.ragKeywordWeight),
    semanticWeight: parseOptionalFloat(options.ragSemanticWeight),
    chunkSize: parseOptionalInt(options.ragChunkSize),
    chunkOverlap: parseOptionalInt(options.ragChunkOverlap),
    maxFileSizeBytes: (() => {
      const sizeKb = parseOptionalInt(options.ragMaxFileSizeKb);
      return sizeKb ? sizeKb * 1024 : undefined;
    })(),
    queryRewrite: {
      enabled: !options.disableRagQueryRewrite,
      maxTokens: parseOptionalInt(options.ragQueryRewriteMaxTokens),
      temperature: parseOptionalFloat(options.ragQueryRewriteTemperature),
    },
    reranker: {
      enabled: !(
        options.disableRagReranker ||
        process.env.FRONTAGENT_RAG_RERANKER_ENABLED === '0' ||
        process.env.FRONTAGENT_RAG_RERANKER_ENABLED === 'false'
      ),
      model: options.ragRerankerModel ?? process.env.FRONTAGENT_RAG_RERANKER_MODEL,
      baseURL:
        options.ragRerankerBaseUrl ??
        process.env.FRONTAGENT_RAG_RERANKER_BASE_URL ??
        resolvedLlmBaseURL,
      apiKey:
        options.ragRerankerApiKey ??
        process.env.FRONTAGENT_RAG_RERANKER_API_KEY ??
        resolvedLlmApiKey,
      candidateCount: parseOptionalInt(options.ragRerankerCandidateCount),
      maxDocumentChars: parseOptionalInt(options.ragRerankerMaxDocumentChars),
      requestTimeoutMs: parseOptionalInt(options.ragRerankerTimeoutMs),
    },
    embedding: {
      enabled: !options.disableRagSemantic,
      model: options.ragEmbeddingModel,
      baseURL:
        options.ragEmbeddingBaseUrl ??
        process.env.FRONTAGENT_RAG_EMBEDDING_BASE_URL ??
        (provider === 'openai' ? resolveEmbeddingBaseURL(resolvedLlmBaseURL) : undefined),
      apiKey:
        options.ragEmbeddingApiKey ??
        process.env.FRONTAGENT_RAG_EMBEDDING_API_KEY ??
        (provider === 'openai' ? resolvedLlmApiKey : undefined),
      dimensions: parseOptionalInt(options.ragEmbeddingDimensions),
      batchSize: parseOptionalInt(options.ragEmbeddingBatchSize),
      requestTimeoutMs: parseOptionalInt(options.ragEmbeddingTimeoutMs),
    },
    vectorStore: {
      provider:
        options.ragVectorStoreProvider ??
        process.env.FRONTAGENT_RAG_VECTOR_STORE_PROVIDER ??
        ((options.ragWeaviateUrl ?? process.env.FRONTAGENT_RAG_WEAVIATE_URL)
          ? 'weaviate'
          : undefined),
      weaviate: {
        baseURL: options.ragWeaviateUrl ?? process.env.FRONTAGENT_RAG_WEAVIATE_URL,
        apiKey: options.ragWeaviateApiKey ?? process.env.FRONTAGENT_RAG_WEAVIATE_API_KEY,
        collectionPrefix:
          options.ragWeaviateCollectionPrefix ??
          process.env.FRONTAGENT_RAG_WEAVIATE_COLLECTION_PREFIX,
        batchSize: parseOptionalInt(options.ragWeaviateBatchSize),
        requestTimeoutMs: parseOptionalInt(options.ragWeaviateTimeoutMs),
      },
    },
  };
}

export default async function runCommand(
  task: string,
  options: Record<string, any>,
) {
  const projectRoot = process.cwd();
  const sddPath = resolve(projectRoot, options.sdd);

  if (!existsSync(sddPath)) {
    console.log(
      chalk.yellow(`⚠️ SDD 配置文件不存在: ${sddPath}`),
    );
    console.log(chalk.gray('   运行 frontagent init 创建配置文件'));
    console.log(chalk.gray('   将在无约束模式下运行\n'));
  }

  const provider = (
    options.provider ||
    process.env.PROVIDER ||
    'anthropic'
  ).toLowerCase() as 'openai' | 'anthropic';

  const model =
    options.model || process.env.MODEL || getDefaultModel(provider);
  const resolvedLlmApiKey = resolveProviderApiKey(provider, options.apiKey);
  const resolvedLlmBaseURL = resolveProviderBaseURL(provider, options.baseUrl);
  const executionEngineRaw = (
    options.engine ||
    process.env.EXECUTION_ENGINE ||
    'native'
  ).toLowerCase();
  const executionEngine =
    executionEngineRaw === 'langgraph' ? 'langgraph' : 'native';
  const useLangGraphCheckpoint = Boolean(
    options.langgraphCheckpoint ||
      process.env.LANGGRAPH_CHECKPOINT === '1' ||
      process.env.LANGGRAPH_CHECKPOINT === 'true',
  );
  const maxRecoveryAttempts =
    Number.parseInt(options.maxRecoveryAttempts, 10) || 3;
  const ragEnabled = !options.disableRag;
  const ragCacheDir = resolve(projectRoot, '.frontagent', 'rag-cache');
  const ragExcludedPathPrefixes = parsePathList(
    options.ragExcludePath,
    process.env.FRONTAGENT_RAG_EXCLUDE_PATHS,
  );

  const ragConfig = buildRagConfig(
    options,
    ragEnabled,
    ragCacheDir,
    ragExcludedPathPrefixes,
    resolvedLlmBaseURL,
    resolvedLlmApiKey,
    provider,
  );

  // ── Store + Ink ──────────────────────────────────────────────────
  const store = createStore();
  store.setState({ debug: options.debug ?? false });

  const streamTokenEmitter = createStreamTokenEmitter();
  const eventBridge = createEventBridge(store);

  const inkInstance = render(
    <App store={store} streamTokenEmitter={streamTokenEmitter} />,
  );

  // ── Agent setup ─────────────────────────────────────────────────
  const config: AgentConfig = {
    projectRoot,
    sddPath: existsSync(sddPath) ? sddPath : undefined,
    llm: {
      provider,
      model,
      baseURL: resolvedLlmBaseURL,
      apiKey: resolvedLlmApiKey,
      maxTokens: parseInt(options.maxTokens, 10),
      temperature: parseFloat(options.temperature),
      topP:
        parseOptionalFloat(options.topP) ??
        parseOptionalFloat(process.env.TOP_P),
      topK:
        parseOptionalInt(options.topK) ??
        parseOptionalInt(process.env.TOP_K),
    },
    execution: {
      engine: executionEngine,
      langGraph: {
        useCheckpoint: useLangGraphCheckpoint,
        maxRecoveryAttempts,
        threadIdPrefix: 'frontagent',
      },
    },
    rag: ragConfig,
    skillContent: {
      builtInSkillRoots: resolveBuiltInSkillRoots(),
    },
    debug: options.debug,
  };

  const agent = createAgent(config);

  // ── MCP clients ─────────────────────────────────────────────────
  const fileClient = new FileMCPClient(projectRoot);
  agent.registerMCPClient('file', fileClient);
  agent.registerFileTools();

  if (ragEnabled) {
    const memoryClient = new MemoryMCPClient({
      repoUrl: ragConfig.repoUrl,
      branch: ragConfig.branch ?? 'main',
      cacheDir: ragConfig.cacheDir ?? ragCacheDir,
      syncOnQuery: ragConfig.syncOnQuery,
      maxResults: ragConfig.maxResults,
      excludedPathPrefixes: ragConfig.excludedPathPrefixes,
      keywordCandidateCount: ragConfig.keywordCandidateCount,
      semanticCandidateCount: ragConfig.semanticCandidateCount,
      keywordWeight: ragConfig.keywordWeight,
      semanticWeight: ragConfig.semanticWeight,
      chunkSize: ragConfig.chunkSize,
      chunkOverlap: ragConfig.chunkOverlap,
      maxFileSizeBytes: ragConfig.maxFileSizeBytes,
      embedding: ragConfig.embedding,
      vectorStore: ragConfig.vectorStore,
    });
    agent.registerMCPClient('memory', memoryClient);
    agent.registerMemoryTools();
  }

  // Approval via store instead of readline — Tier 3 bridge state
  const shellClient = createShellMCPClient(
    projectRoot,
    (command: string) =>
      new Promise<boolean>((resolveApproval) => {
        store.setState({
          approval: { command, resolve: resolveApproval },
        });
      }),
  );
  agent.registerMCPClient('shell', shellClient);
  agent.registerShellTools();

  const webClient = new WebMCPClient();
  agent.registerMCPClient('web', webClient);
  agent.registerWebTools();

  // ── Event wiring ────────────────────────────────────────────────
  agent.addEventListener((event) => {
    eventBridge(event);

    // Tier 2: stream tokens bypass the store
    if (event.type === 'stream_token') {
      streamTokenEmitter.emit(event.token);
    }
  });

  // ── Execute ─────────────────────────────────────────────────────
  try {
    const result = await agent.execute(task, {
      type: options.type,
      relevantFiles: options.files,
      browserUrl: options.url,
    });

    store.setState({
      status: result.success ? 'done' : 'error',
      result,
    });
  } catch (error) {
    store.setState({
      status: 'error',
      result: {
        success: false,
        taskId: '',
        executedSteps: [],
        error: error instanceof Error ? error.message : String(error),
      } as any,
    });
  } finally {
    await webClient.close();
    // Give Ink one last render cycle before unmounting
    await new Promise((r) => setTimeout(r, 100));
    inkInstance.unmount();
  }
}
