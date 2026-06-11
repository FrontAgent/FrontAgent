import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  type AgentConfig,
  type AgentEvent,
  type AgentExecutionResult,
  type AgentPlanResult,
  type AgentSessionSnapshot,
  createAgent,
  type ExecutorStepTrace,
  type LLMBackend,
} from '@frontagent/core';
import { createShellMCPClient } from '@frontagent/mcp-shell';
import type { ApprovalRequest, TaskType } from '@frontagent/shared';
import {
  getDefaultRagCacheDir,
  parseTaskType,
  type RuntimeConfigInput,
  resolveBuiltInSkillRoots,
  resolveRuntimeConfig,
} from './config.js';
import { FileMCPClient, MemoryMCPClient, WebMCPClient } from './mcp-clients.js';
import { createRunLogger, installRunConsoleFilter } from './run-logger.js';
import {
  createSessionId,
  findLatestResumableSession,
  listSessionRecords,
  loadSessionRecord,
  type SessionStatus,
  saveSessionRecord,
} from './session-store.js';

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
  /** 恢复会话：true 恢复最近未完成会话，字符串恢复指定 sessionId */
  resumeSession?: string | boolean;
  onRunLogPath?: (path: string | null) => void;
  onEvent?: (event: AgentEvent) => void;
  onApprovalRequest?: (request: ApprovalRequest) => Promise<boolean>;
  /** 可选的 executor step trace 回调，用于性能分析 */
  onStepTrace?: (trace: ExecutorStepTrace) => void;
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
      input.provider === 'anthropic'
        ? 'Anthropic provider 会请求 baseURL + /messages；请确认供应商支持 Anthropic Messages API。'
        : '如 baseURL 包含 /chat/completions，CLI 会自动裁剪；仍失败时请确认供应商的 OpenAI-compatible 地址。',
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
      openVikingApiKey: options.openVikingApiKey ? '[REDACTED]' : undefined,
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
    filesense: resolved.filesense,
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
    trace: options.onStepTrace ? { enabled: true, onStepTrace: options.onStepTrace } : undefined,
  };

  const agent = createAgent(config);

  const fileClient = new FileMCPClient(projectRoot);
  agent.registerMCPClient('file', fileClient);
  agent.registerFileTools();

  if (resolved.rag.enabled !== false) {
    const memoryClient = new MemoryMCPClient({
      source: resolved.rag.source,
      openViking: resolved.rag.openViking,
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

  // 会话持久化：步骤推进时写入快照，任务结束时落最终状态
  const sessionState = {
    sessionId: createSessionId(),
    createdAt: new Date().toISOString(),
  };
  const persistSession = (status: SessionStatus) => {
    try {
      const snapshot = agent.getSessionSnapshot();
      if (!snapshot) return;
      saveSessionRecord(projectRoot, {
        sessionId: sessionState.sessionId,
        status,
        createdAt: sessionState.createdAt,
        updatedAt: new Date().toISOString(),
        snapshot,
      });
    } catch (error) {
      runLogger?.error(error);
    }
  };
  agent.addEventListener((event) => {
    if (
      event.type === 'planning_completed' ||
      event.type === 'step_completed' ||
      event.type === 'step_failed'
    ) {
      persistSession('running');
    } else if (event.type === 'task_completed') {
      persistSession(event.result.success ? 'completed' : 'failed');
    } else if (event.type === 'task_failed') {
      persistSession('failed');
    }
  });

  try {
    let resumeSnapshot: AgentSessionSnapshot | undefined;
    if (options.resumeSession) {
      const record =
        typeof options.resumeSession === 'string'
          ? loadSessionRecord(projectRoot, options.resumeSession)
          : findLatestResumableSession(projectRoot);
      if (!record) {
        const available = listSessionRecords(projectRoot)
          .slice(0, 10)
          .map((item) => `${item.sessionId} (${item.status})`);
        throw new Error(
          available.length > 0
            ? `未找到可恢复的会话。可用会话：${available.join('，')}`
            : '未找到可恢复的会话：当前项目没有已保存的会话。',
        );
      }
      sessionState.sessionId = record.sessionId;
      sessionState.createdAt = record.createdAt;
      resumeSnapshot = record.snapshot;
    }

    const result = await agent.execute(options.task, {
      type: parseTaskType(String(options.type ?? 'query')),
      relevantFiles: options.files,
      browserUrl: options.url,
      signal: options.signal,
      resume: resumeSnapshot,
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
      options.onEvent?.({
        type: 'status_update',
        label: '关闭浏览器资源',
        operation: '关闭浏览器资源',
      });
      runLogger?.event({
        type: 'status_update',
        label: '关闭浏览器资源',
        operation: '关闭浏览器资源',
      });
      await webClient.close();
    } catch (error) {
      runLogger?.error(error);
    } finally {
      options.onEvent?.({ type: 'status_update', label: '收尾完成' });
      runLogger?.event({ type: 'status_update', label: '收尾完成' });
      restoreConsole();
      await runLogger?.close();
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
      openVikingApiKey: options.openVikingApiKey ? '[REDACTED]' : undefined,
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
    filesense: resolved.filesense,
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
    trace: options.onStepTrace ? { enabled: true, onStepTrace: options.onStepTrace } : undefined,
  };

  const agent = createAgent(config);

  const fileClient = new FileMCPClient(projectRoot);
  agent.registerMCPClient('file', fileClient);
  agent.registerFileTools();

  if (resolved.rag.enabled !== false) {
    const memoryClient = new MemoryMCPClient({
      source: resolved.rag.source,
      openViking: resolved.rag.openViking,
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
      options.onEvent?.({
        type: 'status_update',
        label: '关闭浏览器资源',
        operation: '关闭浏览器资源',
      });
      runLogger?.event({
        type: 'status_update',
        label: '关闭浏览器资源',
        operation: '关闭浏览器资源',
      });
      await webClient.close();
    } catch (error) {
      runLogger?.error(error);
    } finally {
      options.onEvent?.({ type: 'status_update', label: '收尾完成' });
      runLogger?.event({ type: 'status_update', label: '收尾完成' });
      restoreConsole();
      await runLogger?.close();
    }
  }
}
