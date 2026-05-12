import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createAgent,
  type AgentConfig,
  type AgentEvent,
  type AgentExecutionResult,
  type AgentPlanResult,
  type LLMBackend,
} from '@frontagent/core';
import type { ApprovalRequest, TaskType } from '@frontagent/shared';
import { createShellMCPClient } from '@frontagent/mcp-shell';
import {
  parseTaskType,
  getDefaultRagCacheDir,
  resolveBuiltInSkillRoots,
  resolveRuntimeConfig,
  type RuntimeConfigInput,
} from './config.js';
import { FileMCPClient, MemoryMCPClient, WebMCPClient } from './mcp-clients.js';
import { createRunLogger, installRunConsoleFilter } from './run-logger.js';

export interface RunFrontAgentTaskOptions extends RuntimeConfigInput {
  projectRoot: string;
  task: string;
  type?: TaskType | string;
  files?: string[];
  url?: string;
  sddPath?: string;
  debug?: boolean | string;
  logFile?: string;
  runLog?: boolean;
  filterConsole?: boolean;
  builtInSkillRoots?: string[];
  codeQualityIsolationMode?: 'process' | 'in_memory';
  streamShellOutput?: boolean;
  llmBackend?: LLMBackend;
  signal?: AbortSignal;
  onRunLogPath?: (path: string | null) => void;
  onEvent?: (event: AgentEvent) => void;
  onApprovalRequest?: (request: ApprovalRequest) => Promise<boolean>;
}

function isDebugEnabled(value: unknown): boolean {
  return value === true || value === 'true' || value === '1';
}

export function formatRunError(
  error: string | undefined,
  input: {
    provider: string;
    model: string;
    baseURL?: string;
    debug: boolean;
  },
): string | undefined {
  if (!error || input.debug) return error;

  if (/not found|404/i.test(error)) {
    return [
      'LLM 请求失败：404 Not Found。',
      `请检查 provider/model/base-url：provider=${input.provider}, model=${input.model}, baseURL=${input.baseURL ?? '(default)'}`,
      '如 baseURL 包含 /chat/completions，CLI 会自动裁剪；仍失败时请确认供应商的 OpenAI-compatible 地址。',
    ].join('\n');
  }

  if (/api key|apikey|unauthorized|401/i.test(error)) {
    return `LLM 鉴权失败。请检查 ${input.provider.toUpperCase()}_API_KEY 或 --api-key。`;
  }

  return error.split('\n')[0];
}

export async function runFrontAgentTask(
  options: RunFrontAgentTaskOptions,
): Promise<AgentExecutionResult> {
  const projectRoot = options.projectRoot;
  const sddPath = resolve(projectRoot, options.sddPath ?? 'sdd.yaml');
  const debug = isDebugEnabled(options.debug);
  const resolved = resolveRuntimeConfig(options, projectRoot);
  const runLogger = createRunLogger({
    projectRoot,
    enabled: options.runLog !== false,
    logFile: options.logFile,
    task: options.task,
    provider: resolved.provider,
    model: resolved.model,
    baseURL: resolved.llm.baseURL,
    options: {
      ...options,
      apiKey: options.apiKey ? '[REDACTED]' : undefined,
      ragEmbeddingApiKey: options.ragEmbeddingApiKey ? '[REDACTED]' : undefined,
      ragRerankerApiKey: options.ragRerankerApiKey ? '[REDACTED]' : undefined,
      ragWeaviateApiKey: options.ragWeaviateApiKey ? '[REDACTED]' : undefined,
      onEvent: undefined,
      onApprovalRequest: undefined,
      onRunLogPath: undefined,
      llmBackend: options.llmBackend ? `[${options.llmBackend.name}]` : undefined,
      signal: undefined,
    },
  });
  options.onRunLogPath?.(runLogger?.path ?? null);

  const restoreConsole = options.filterConsole
    ? installRunConsoleFilter(debug, runLogger)
    : () => {};
  const webClient = new WebMCPClient();

  const config: AgentConfig = {
    projectRoot,
    sddPath: existsSync(sddPath) ? sddPath : undefined,
    llm: {
      ...resolved.llm,
      backend: options.llmBackend,
    },
    execution: resolved.execution,
    rag: resolved.rag,
    skillContent: {
      builtInSkillRoots: resolveBuiltInSkillRoots(options.builtInSkillRoots),
    },
    security: {
      mode: resolved.securityMode,
      interactive: Boolean(options.onApprovalRequest),
      auditEnabled: true,
      approvalHandler: options.onApprovalRequest,
    },
    subAgents: options.codeQualityIsolationMode
      ? {
          codeQualityEvaluator: {
            isolationMode: options.codeQualityIsolationMode,
          },
        }
      : undefined,
    debug,
  };

  const agent = createAgent(config);

  const fileClient = new FileMCPClient(projectRoot);
  agent.registerMCPClient('file', fileClient);
  agent.registerFileTools();

  if (resolved.rag.enabled !== false) {
    const memoryClient = new MemoryMCPClient({
      repoUrl: resolved.rag.repoUrl,
      branch: resolved.rag.branch ?? 'main',
      cacheDir: resolved.rag.cacheDir ?? getDefaultRagCacheDir(projectRoot),
      syncOnQuery: resolved.rag.syncOnQuery,
      maxResults: resolved.rag.maxResults,
      excludedPathPrefixes: resolved.rag.excludedPathPrefixes,
      keywordCandidateCount: resolved.rag.keywordCandidateCount,
      semanticCandidateCount: resolved.rag.semanticCandidateCount,
      keywordWeight: resolved.rag.keywordWeight,
      semanticWeight: resolved.rag.semanticWeight,
      chunkSize: resolved.rag.chunkSize,
      chunkOverlap: resolved.rag.chunkOverlap,
      maxFileSizeBytes: resolved.rag.maxFileSizeBytes,
      reranker: resolved.rag.reranker,
      embedding: resolved.rag.embedding,
      vectorStore: resolved.rag.vectorStore,
    });
    agent.registerMCPClient('memory', memoryClient);
    agent.registerMemoryTools();
  }

  const shellClient = createShellMCPClient(projectRoot, undefined, {
    streamOutput: options.streamShellOutput ?? true,
  });
  agent.registerMCPClient('shell', shellClient);
  agent.registerShellTools();

  agent.registerMCPClient('web', webClient);
  agent.registerWebTools();

  agent.addEventListener((event) => {
    runLogger?.event(event);
    options.onEvent?.(event);
  });

  try {
    const result = await agent.execute(options.task, {
      type: parseTaskType(String(options.type ?? 'query')),
      relevantFiles: options.files,
      browserUrl: options.url,
      signal: options.signal,
    });
    const formattedResult: AgentExecutionResult = {
      ...result,
      error: formatRunError(result.error, {
        provider: resolved.provider,
        model: resolved.model,
        baseURL: resolved.llm.baseURL,
        debug,
      }),
    };
    runLogger?.result(formattedResult);
    return formattedResult;
  } catch (error) {
    runLogger?.error(error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      taskId: '',
      executedSteps: [],
      error: formatRunError(errorMessage, {
        provider: resolved.provider,
        model: resolved.model,
        baseURL: resolved.llm.baseURL,
        debug,
      }),
      duration: 0,
      validations: [],
    };
  } finally {
    try {
      options.onEvent?.({ type: 'status_update', label: '关闭浏览器资源', operation: '关闭浏览器资源' });
      runLogger?.event({ type: 'status_update', label: '关闭浏览器资源', operation: '关闭浏览器资源' });
      await webClient.close();
    } catch (error) {
      runLogger?.error(error);
    } finally {
      options.onEvent?.({ type: 'status_update', label: '收尾完成' });
      runLogger?.event({ type: 'status_update', label: '收尾完成' });
      restoreConsole();
      runLogger?.close();
    }
  }
}

export interface PlanFrontAgentTaskOptions extends RunFrontAgentTaskOptions {}

export async function planFrontAgentTask(
  options: PlanFrontAgentTaskOptions,
): Promise<AgentPlanResult> {
  const projectRoot = options.projectRoot;
  const sddPath = resolve(projectRoot, options.sddPath ?? 'sdd.yaml');
  const debug = isDebugEnabled(options.debug);
  const resolved = resolveRuntimeConfig(options, projectRoot);
  const runLogger = createRunLogger({
    projectRoot,
    enabled: options.runLog !== false,
    logFile: options.logFile,
    task: options.task,
    provider: resolved.provider,
    model: resolved.model,
    baseURL: resolved.llm.baseURL,
    options: {
      ...options,
      apiKey: options.apiKey ? '[REDACTED]' : undefined,
      ragEmbeddingApiKey: options.ragEmbeddingApiKey ? '[REDACTED]' : undefined,
      ragRerankerApiKey: options.ragRerankerApiKey ? '[REDACTED]' : undefined,
      ragWeaviateApiKey: options.ragWeaviateApiKey ? '[REDACTED]' : undefined,
      onEvent: undefined,
      onApprovalRequest: undefined,
      onRunLogPath: undefined,
      llmBackend: options.llmBackend ? `[${options.llmBackend.name}]` : undefined,
      signal: undefined,
    },
  });
  options.onRunLogPath?.(runLogger?.path ?? null);

  const restoreConsole = options.filterConsole
    ? installRunConsoleFilter(debug, runLogger)
    : () => {};
  const webClient = new WebMCPClient();

  const config: AgentConfig = {
    projectRoot,
    sddPath: existsSync(sddPath) ? sddPath : undefined,
    llm: {
      ...resolved.llm,
      backend: options.llmBackend,
    },
    execution: resolved.execution,
    rag: resolved.rag,
    skillContent: {
      builtInSkillRoots: resolveBuiltInSkillRoots(options.builtInSkillRoots),
    },
    security: {
      mode: resolved.securityMode,
      interactive: Boolean(options.onApprovalRequest),
      auditEnabled: true,
      approvalHandler: options.onApprovalRequest,
    },
    subAgents: options.codeQualityIsolationMode
      ? {
          codeQualityEvaluator: {
            isolationMode: options.codeQualityIsolationMode,
          },
        }
      : undefined,
    debug,
  };

  const agent = createAgent(config);

  const fileClient = new FileMCPClient(projectRoot);
  agent.registerMCPClient('file', fileClient);
  agent.registerFileTools();

  if (resolved.rag.enabled !== false) {
    const memoryClient = new MemoryMCPClient({
      repoUrl: resolved.rag.repoUrl,
      branch: resolved.rag.branch ?? 'main',
      cacheDir: resolved.rag.cacheDir ?? getDefaultRagCacheDir(projectRoot),
      syncOnQuery: resolved.rag.syncOnQuery,
      maxResults: resolved.rag.maxResults,
      excludedPathPrefixes: resolved.rag.excludedPathPrefixes,
      keywordCandidateCount: resolved.rag.keywordCandidateCount,
      semanticCandidateCount: resolved.rag.semanticCandidateCount,
      keywordWeight: resolved.rag.keywordWeight,
      semanticWeight: resolved.rag.semanticWeight,
      chunkSize: resolved.rag.chunkSize,
      chunkOverlap: resolved.rag.chunkOverlap,
      maxFileSizeBytes: resolved.rag.maxFileSizeBytes,
      reranker: resolved.rag.reranker,
      embedding: resolved.rag.embedding,
      vectorStore: resolved.rag.vectorStore,
    });
    agent.registerMCPClient('memory', memoryClient);
    agent.registerMemoryTools();
  }

  const shellClient = createShellMCPClient(projectRoot, undefined, {
    streamOutput: options.streamShellOutput ?? true,
  });
  agent.registerMCPClient('shell', shellClient);
  agent.registerShellTools();

  agent.registerMCPClient('web', webClient);
  agent.registerWebTools();

  agent.addEventListener((event) => {
    runLogger?.event(event);
    options.onEvent?.(event);
  });

  try {
    const result = await agent.planOnly(options.task, {
      type: parseTaskType(String(options.type ?? 'query')),
      relevantFiles: options.files,
      browserUrl: options.url,
      signal: options.signal,
    });
    const formattedResult: AgentPlanResult = {
      ...result,
      error: formatRunError(result.error, {
        provider: resolved.provider,
        model: resolved.model,
        baseURL: resolved.llm.baseURL,
        debug,
      }),
    };
    return formattedResult;
  } catch (error) {
    runLogger?.error(error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      taskId: '',
      error: formatRunError(errorMessage, {
        provider: resolved.provider,
        model: resolved.model,
        baseURL: resolved.llm.baseURL,
        debug,
      }),
      duration: 0,
    };
  } finally {
    try {
      options.onEvent?.({ type: 'status_update', label: '关闭浏览器资源', operation: '关闭浏览器资源' });
      runLogger?.event({ type: 'status_update', label: '关闭浏览器资源', operation: '关闭浏览器资源' });
      await webClient.close();
    } catch (error) {
      runLogger?.error(error);
    } finally {
      options.onEvent?.({ type: 'status_update', label: '收尾完成' });
      runLogger?.event({ type: 'status_update', label: '收尾完成' });
      restoreConsole();
      runLogger?.close();
    }
  }
}
