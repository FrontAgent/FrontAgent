import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  type AgentConfig,
  type AgentEvent,
  type AgentExecutionResult,
  type AgentPlanResult,
  createAgent,
  type ExecutorStepTrace,
  type LLMBackend,
} from '@frontagent/core';
import { createShellMCPClient } from '@frontagent/mcp-shell';
import type { ApprovalRequest, SecurityApprovalResponse, TaskType } from '@frontagent/shared';
import {
  getDefaultRagCacheDir,
  parseTaskType,
  type RuntimeConfigInput,
  resolveBuiltInSkillRoots,
  resolveRuntimeConfig,
} from './config.js';
import {
  type CreateLifecycleHooksInput,
  createAgentLifecycleHooks,
  loadHooksSettings,
  runTaskCompleteHooks,
  shouldEnableProjectHooks,
} from './hooks.js';
import { FileMCPClient, MemoryMCPClient, WebMCPClient } from './mcp-clients.js';
import { createRunLogger, installRunConsoleFilter } from './run-logger.js';
import { appendAllowRuleToSettings, loadProjectSettings } from './settings.js';

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
  /**
   * 显式启用项目内 .frontagent/settings.json 的 hooks（默认关闭）。
   * 仓库提交的配置不应自动获得本机 shell 执行能力；
   * 也可用 FRONTAGENT_ENABLE_PROJECT_HOOKS=1 启用。
   */
  enableProjectHooks?: boolean;
  onRunLogPath?: (path: string | null) => void;
  onEvent?: (event: AgentEvent) => void;
  onApprovalRequest?: (request: ApprovalRequest) => Promise<boolean | SecurityApprovalResponse>;
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

  // 项目 hooks 默认不执行：仓库提交的 settings 不应自动获得 shell 执行能力
  const projectHooksEnabled = shouldEnableProjectHooks(options.enableProjectHooks);
  const hooksInput: CreateLifecycleHooksInput = {
    projectRoot,
    settings: projectHooksEnabled ? loadHooksSettings(projectRoot) : undefined,
    onHookExecuted: (hookEvent, execution) => {
      runLogger?.event({
        type: 'status_update',
        label: `hook:${hookEvent}`,
        operation: execution.command,
        detail: `exit=${execution.exitCode}${execution.timedOut ? ' (timeout)' : ''} ${execution.durationMs}ms`,
      });
    },
  };
  if (!projectHooksEnabled && loadHooksSettings(projectRoot)) {
    runLogger?.event({
      type: 'status_update',
      label: 'hooks 未启用',
      operation:
        '检测到 .frontagent/settings.json 的 hooks 配置；如需启用请使用 --enable-hooks 或 FRONTAGENT_ENABLE_PROJECT_HOOKS=1',
    });
  }

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
      permissions: loadProjectSettings(projectRoot).permissions,
      approvalHandler: options.onApprovalRequest,
      onPersistAllowRule: (rule) => appendAllowRuleToSettings(projectRoot, rule),
    },
    lifecycleHooks: createAgentLifecycleHooks(hooksInput),
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

  // taskComplete hooks：任务结束事件触发，失败仅记录不影响结果；
  // promise 收集到 pending 列表，在任务收尾阶段 drain，保证返回前执行完并写入运行日志。
  // task_failed 事件本身不带 taskId，从 task_started 捕获真实任务标识。
  const pendingTaskCompleteHooks: Promise<void>[] = [];
  let currentTaskId = '';
  agent.addEventListener((event) => {
    if (event.type === 'task_started') {
      currentTaskId = event.task.id;
    } else if (event.type === 'task_completed') {
      pendingTaskCompleteHooks.push(
        runTaskCompleteHooks(hooksInput, {
          event: 'taskComplete',
          taskId: event.result.taskId,
          success: event.result.success,
          error: event.result.error,
        }).catch((error) => runLogger?.error(error)),
      );
    } else if (event.type === 'task_failed') {
      pendingTaskCompleteHooks.push(
        runTaskCompleteHooks(hooksInput, {
          event: 'taskComplete',
          taskId: currentTaskId,
          success: false,
          error: event.error,
        }).catch((error) => runLogger?.error(error)),
      );
    }
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
    // 任务返回前 drain taskComplete hooks，保证执行与运行日志记录完成
    await Promise.allSettled(pendingTaskCompleteHooks);
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
      permissions: loadProjectSettings(projectRoot).permissions,
      approvalHandler: options.onApprovalRequest,
      onPersistAllowRule: (rule) => appendAllowRuleToSettings(projectRoot, rule),
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
