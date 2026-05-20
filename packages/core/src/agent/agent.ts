/**
 * Agent 主类
 * 负责整体编排
 */

import { HallucinationGuard } from '@frontagent/hallucination-guard';
import { SDDParser, SDDPromptGenerator } from '@frontagent/sdd';
import type {
  ActionType,
  AgentTask,
  ExecutionPlan,
  ExecutionStep,
  SDDConfig,
  ValidationResult,
} from '@frontagent/shared';
import { generateId } from '@frontagent/shared';
import { type A2AAgent, InMemoryA2ABus } from '../a2a.js';
import { ContextManager } from '../context.js';
import { Executor, type MCPClient } from '../executor.js';
import { LLMService } from '../llm.js';
import { MemoryStore } from '../memory/index.js';
import { Planner } from '../planner.js';
import { SkillContentLoader } from '../skill-content/loader.js';
import { SkillContentResolver } from '../skill-content/resolver.js';
import type {
  ExecutorActionSkill,
  ExecutorSkillsLayerSnapshot,
  PhaseInjectionSkill,
  PlannerSkillsLayerSnapshot,
  TaskPlanningSkill,
} from '../skills/index.js';
import {
  type CodeQualityIssue,
  type CodeQualityReviewRequest,
  type CodeQualityReviewResponse,
  CodeQualitySubAgent,
  ProcessIsolatedCodeQualitySubAgent,
} from '../sub-agents/index.js';
import type {
  AgentConfig,
  AgentEvent,
  AgentEventListener,
  AgentExecutionResult,
  AgentPlanResult,
  FilesenseNavigationIntent,
  ProjectFactsUpdate,
} from '../types.js';
import { WorkflowIntegration } from '../workflow-integration.js';
import { buildFinalOutput } from './answer-generation.js';
import { detectDevServerPort } from './dev-server-detection.js';
import { mergeRetrievalQuery, normalizeSearchQuery } from './helpers.js';
import { persistMemory, preloadMemory } from './memory-lifecycle.js';
import {
  checkMissingNpmDependencies,
  evaluateGeneratedCodeQualityViaSubAgent,
  runTypeCheck,
  shouldRunPhaseChecks,
} from './phase-checks.js';
import {
  formatRagResult,
  retrieveRagContext,
  rewriteRagQueryForRetrieval,
} from './rag-retrieval.js';

/**
 * FrontAgent 主类
 */
export class FrontAgent {
  private config: AgentConfig;
  private contextManager: ContextManager;
  private planner: Planner;
  private executor: Executor;
  private sddParser: SDDParser;
  private sddConfig?: SDDConfig;
  private hallucinationGuard: HallucinationGuard;
  private llmService: LLMService;
  private promptGenerator?: SDDPromptGenerator;
  private eventListeners: AgentEventListener[] = [];
  private currentTaskId?: string;
  private a2aBus: InMemoryA2ABus;
  private codeQualitySubAgent?: A2AAgent<CodeQualityReviewRequest, CodeQualityReviewResponse>;
  private skillContentResolver?: SkillContentResolver;
  private memoryStore: MemoryStore;
  private workflowIntegration?: WorkflowIntegration;
  private pendingFactsUpdates: ProjectFactsUpdate[] = [];
  private factsUpdateFlushInProgress = false;
  private lastAnswerGenerationError?: string;
  private lastLlmFailureError?: string;

  constructor(config: AgentConfig) {
    this.config = config;
    this.contextManager = new ContextManager();
    this.sddParser = new SDDParser();

    if (config.sddPath) {
      const parseResult = this.sddParser.parseFile(config.sddPath);
      if (parseResult.success && parseResult.config) {
        this.sddConfig = parseResult.config;
        this.promptGenerator = new SDDPromptGenerator(this.sddConfig);
      }
    }

    this.llmService = new LLMService({ ...config.llm, debug: config.debug });

    this.hallucinationGuard = new HallucinationGuard({
      projectRoot: config.projectRoot,
      sddConfig: this.sddConfig,
      enabledChecks: config.hallucinationGuard?.checks,
    });

    this.planner = new Planner({
      llm: { ...config.llm, debug: config.debug },
      sddConfig: this.sddConfig,
      debug: config.debug,
    });

    this.executor = new Executor({
      projectRoot: config.projectRoot,
      hallucinationGuard: this.hallucinationGuard,
      llmService: this.llmService,
      debug: config.debug,
      security: config.security,
      sddConfig: this.sddConfig,
      approvalHandler: config.security?.approvalHandler,
      onSecurityDecision: (decision) => {
        this.emit({ type: 'security_decision', decision });
      },
      executionEngine: config.execution?.engine,
      langGraph: config.execution?.langGraph,
      maxRecoveryAttempts: config.execution?.maxRecoveryAttempts,
      getSddConstraints: () => this.promptGenerator?.generate(),
      getSkillContext: () => {
        if (!this.currentTaskId) return undefined;
        return this.contextManager.getContext(this.currentTaskId)?.collectedContext.skillContext;
      },
      getFileSystemFacts: () => {
        if (!this.currentTaskId) return undefined;
        const context = this.contextManager.getContext(this.currentTaskId);
        return context?.facts.filesystem;
      },
      getMemoryRecall: (filePath: string, action: string) => {
        if (this.config.memory?.enabled === false) return undefined;
        const recalled = this.memoryStore.recall({ filePath, action });
        if (recalled.length === 0) return undefined;
        const parts = recalled.map((r) => `[${r.topicId}] ${r.content}`);
        return `## 跨会话记忆\n${parts.join('\n')}`;
      },
      onStreamToken: (token: string, stepId: string) => {
        this.emit({ type: 'stream_token', token, stepId });
      },
      trace: config.trace,
    });

    if (config.skillContent?.enabled !== false) {
      const loader = new SkillContentLoader({
        projectRoot: config.projectRoot,
        builtInSkillRoots: config.skillContent?.builtInSkillRoots,
        userSkillRoots: config.skillContent?.userSkillRoots,
      });
      this.skillContentResolver = new SkillContentResolver(loader, {
        maxImplicitMatches: config.skillContent?.maxImplicitMatches,
        maxExplicitMatches: config.skillContent?.maxExplicitMatches,
        maxReferenceFiles: config.skillContent?.maxReferenceFiles,
        maxCharsPerFile: config.skillContent?.maxCharsPerFile,
      });
    }

    this.memoryStore = new MemoryStore(config.projectRoot, config.memory);

    if (config.sddWorkflow?.enabled) {
      this.workflowIntegration = new WorkflowIntegration({
        projectRoot: config.projectRoot,
        config: config.sddWorkflow,
        constitutionPath: config.constitutionPath,
        debug: config.debug,
      });
    }

    this.a2aBus = new InMemoryA2ABus();
    const codeQualityConfig = config.subAgents?.codeQualityEvaluator;
    const enableCodeQualitySubAgent = codeQualityConfig?.enabled ?? true;
    if (enableCodeQualitySubAgent) {
      const isolationMode = codeQualityConfig?.isolationMode ?? 'process';
      const enableLLMReview = codeQualityConfig?.enableLLMReview ?? true;

      if (isolationMode === 'process') {
        this.codeQualitySubAgent = new ProcessIsolatedCodeQualitySubAgent({
          llmConfig: config.llm,
          enableLLMReview,
          enableRuleFallback: codeQualityConfig?.enableRuleFallback ?? true,
          maxFilesForLLM: codeQualityConfig?.maxFilesForLLM,
          maxCharsPerFileForLLM: codeQualityConfig?.maxCharsPerFileForLLM,
          timeoutMs: codeQualityConfig?.processTimeoutMs,
          debug: config.debug ?? false,
        });
      } else {
        this.codeQualitySubAgent = new CodeQualitySubAgent({
          llmService: enableLLMReview ? this.llmService : undefined,
          enableRuleFallback: codeQualityConfig?.enableRuleFallback ?? true,
          maxFilesForLLM: codeQualityConfig?.maxFilesForLLM,
          maxCharsPerFileForLLM: codeQualityConfig?.maxCharsPerFileForLLM,
          debug: config.debug ?? false,
        });
      }

      this.a2aBus.registerAgent(this.codeQualitySubAgent);
    }
  }

  getWorkflowIntegration(): WorkflowIntegration | undefined {
    return this.workflowIntegration;
  }

  registerMCPClient(name: string, client: MCPClient): void {
    this.executor.registerMCPClient(name, client);
  }

  registerToolMapping(toolName: string, clientName: string): void {
    this.executor.registerToolMapping(toolName, clientName);
  }

  registerTaskSkill(skill: TaskPlanningSkill): void {
    this.planner.registerTaskSkill(skill);
  }

  registerPhaseSkill(skill: PhaseInjectionSkill): void {
    this.planner.registerPhaseSkill(skill);
  }

  getPlannerSkillSnapshot(): PlannerSkillsLayerSnapshot {
    return this.planner.getSkillLayerSnapshot();
  }

  registerExecutorActionSkill(skill: ExecutorActionSkill): void {
    this.executor.registerActionSkill(skill);
  }

  getExecutorSkillSnapshot(): ExecutorSkillsLayerSnapshot {
    return this.executor.getActionSkillSnapshot();
  }

  registerFileTools(): void {
    const tools = [
      'read_file',
      'apply_patch',
      'create_file',
      'search_code',
      'list_directory',
      'get_ast',
      'rollback',
      'get_snapshots',
      'filesense_init',
      'filesense_sync',
      'filesense_summarize',
      'filesense_query',
      'filesense_check',
      'filesense_navigate',
      'filesense_sync_and_summarize',
    ];
    for (const tool of tools) {
      this.executor.registerToolMapping(tool, 'file');
    }
  }

  registerWebTools(): void {
    const tools = [
      'browser_navigate',
      'get_page_structure',
      'get_accessibility_tree',
      'get_interactive_elements',
      'browser_click',
      'browser_type',
      'browser_scroll',
      'browser_screenshot',
      'browser_wait_for_selector',
      'navigate',
      'click',
      'type',
      'scroll',
      'screenshot',
      'wait_for_selector',
    ];
    for (const tool of tools) {
      this.executor.registerToolMapping(tool, 'web');
    }
  }

  registerShellTools(): void {
    const tools = ['run_command'];
    for (const tool of tools) {
      this.executor.registerToolMapping(tool, 'shell');
    }
  }

  registerMemoryTools(): void {
    const tools = ['rag_query'];
    for (const tool of tools) {
      this.executor.registerToolMapping(tool, 'memory');
    }
  }

  addEventListener(listener: AgentEventListener): void {
    this.eventListeners.push(listener);
  }

  removeEventListener(listener: AgentEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  private emit(event: AgentEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        this.debugError('Event listener error:', error);
      }
    }
  }

  private debugLog(...args: unknown[]): void {
    if (this.config.debug) {
      console.log(...args);
    }
  }

  private debugWarn(...args: unknown[]): void {
    if (this.config.debug) {
      console.warn(...args);
    }
  }

  private debugError(...args: unknown[]): void {
    if (this.config.debug) {
      console.error(...args);
    }
  }

  private throwIfAborted(signal?: AbortSignal): void {
    if (!signal?.aborted) return;
    const reason = signal.reason;
    if (reason instanceof Error) {
      throw reason;
    }
    throw new Error(typeof reason === 'string' ? reason : 'FrontAgent run cancelled');
  }

  private emitStatus(label: string, operation = label, detail?: string): void {
    this.emit({ type: 'status_update', label, operation, detail });
  }

  private get ragDeps() {
    return {
      config: this.config,
      executor: this.executor,
      llmService: this.llmService,
      contextManager: this.contextManager,
      debugLog: this.debugLog.bind(this),
      debugWarn: this.debugWarn.bind(this),
    };
  }

  private get phaseCheckDeps() {
    return {
      config: this.config,
      executor: this.executor,
      contextManager: this.contextManager,
      sddConfig: this.sddConfig,
      a2aBus: this.a2aBus,
      codeQualitySubAgent: this.codeQualitySubAgent,
      debugLog: this.debugLog.bind(this),
      debugWarn: this.debugWarn.bind(this),
      enqueueFactsUpdate: this.enqueueFactsUpdate.bind(this),
    };
  }

  private get memoryDeps() {
    return {
      config: this.config,
      contextManager: this.contextManager,
      memoryStore: this.memoryStore,
      debugLog: this.debugLog.bind(this),
      debugWarn: this.debugWarn.bind(this),
    };
  }

  async planOnly(
    taskDescription: string,
    options?: {
      type?: AgentTask['type'];
      relevantFiles?: string[];
      browserUrl?: string;
      signal?: AbortSignal;
    },
  ): Promise<AgentPlanResult> {
    const startTime = Date.now();
    this.pendingFactsUpdates = [];
    this.factsUpdateFlushInProgress = false;
    this.lastAnswerGenerationError = undefined;
    this.lastLlmFailureError = undefined;

    const skillResolution = this.skillContentResolver?.resolveForTask(taskDescription);
    const resolvedTaskDescription =
      skillResolution?.sanitizedTaskDescription?.trim() || taskDescription;
    const skillContext = skillResolution?.promptContext;
    const matchedSkillNames = skillResolution?.matchedSkills.map((skill) => skill.name) ?? [];

    const task: AgentTask = {
      id: generateId('task'),
      type: options?.type ?? 'query',
      description: resolvedTaskDescription,
      context: {
        workingDirectory: this.config.projectRoot,
        relevantFiles: options?.relevantFiles,
        browserUrl: options?.browserUrl,
      },
    };

    this.emit({ type: 'task_started', task });
    this.emitStatus('初始化计划任务', '初始化计划上下文');

    try {
      this.throwIfAborted(options?.signal);
      this.currentTaskId = task.id;

      const context = this.contextManager.createContext(task, this.sddConfig);
      context.collectedContext.skillContext = skillContext;
      context.collectedContext.matchedSkillNames = matchedSkillNames;
      context.collectedContext.metadata.originalTaskDescription = taskDescription;

      this.emitStatus('加载跨会话记忆', '加载跨会话记忆');
      this.memoryStore.resetSession();
      preloadMemory(this.memoryDeps, task.id, context);

      if (this.promptGenerator) {
        const constitutionPrompt = this.workflowIntegration?.getConstitutionPrompt();
        if (constitutionPrompt) {
          this.contextManager.addMessage(task.id, { role: 'system', content: constitutionPrompt });
        }
        this.contextManager.addMessage(task.id, {
          role: 'system',
          content: this.promptGenerator.generate(),
        });
      }

      let projectStructure: string | undefined;
      const preScannedFiles = new Map<string, string>();
      try {
        this.emitStatus('扫描项目结构', 'list_directory 扫描项目结构');
        const listResult = (await this.executor.callTool('list_directory', {
          path: this.config.projectRoot,
          recursive: true,
        })) as { success: boolean; entries?: Array<{ name: string; type: string; path: string }> };

        if (listResult.success && listResult.entries) {
          const files = listResult.entries
            .filter(
              (e) =>
                e.type === 'file' && !e.path.includes('node_modules') && !e.path.includes('.git'),
            )
            .map((e) => e.path);

          if (files.length > 0) {
            projectStructure = `项目文件列表（共 ${files.length} 个文件）:\n${files.join('\n')}`;
          }

          const configFiles = files.filter(
            (f) => f.endsWith('package.json') || f.includes('vite.config'),
          );
          for (const configFile of configFiles) {
            try {
              const readResult = (await this.executor.callTool('read_file', {
                path: configFile,
              })) as { success: boolean; content?: string };
              if (readResult.success && readResult.content) {
                preScannedFiles.set(configFile, readResult.content);
              }
            } catch {
              // Ignore optional pre-scan read failures.
            }
          }
        }
      } catch (error) {
        this.debugWarn('[Agent] Failed to pre-scan project structure for plan-only:', error);
      }

      this.emitStatus('检测开发服务器端口', '检测开发服务器端口');
      const devServerPort = detectDevServerPort(
        { debugLog: this.debugLog.bind(this), debugWarn: this.debugWarn.bind(this) },
        preScannedFiles,
      );

      this.emitStatus('检索知识库', 'RAG 检索');
      const ragContext = await retrieveRagContext(this.ragDeps, task.id, task.description);
      const ragResults = ragContext?.formattedResults;

      if (this.config.rag?.enabled !== false) {
        this.emit({
          type: 'rag_retrieved',
          searchMode: ragContext?.searchMode,
          reranked: ragContext?.reranked,
          warnings: ragContext?.warnings,
          timing: ragContext?.timing,
          matches: ragContext?.matches ?? [],
        });
      }

      this.emit({ type: 'planning_started' });
      this.emitStatus('生成执行计划', 'LLM 规划');

      const planResult = await this.planner.plan(
        task,
        {
          files: context.collectedContext.files,
          pageStructure: context.collectedContext.pageStructure,
          ragResults,
          projectStructure,
          devServerPort,
          skillContext,
          matchedSkillNames,
          memoryContext: context.collectedContext.memoryContext,
          filesense: this.config.filesense,
        },
        this.contextManager.getMessages(task.id),
      );
      this.rememberPlannerFallback(planResult.fallbackReason);

      if (planResult.needsMoreContext && planResult.contextRequests) {
        this.emitStatus('补充规划上下文', '读取更多上下文');
        await this.gatherContext(task.id, planResult.contextRequests);

        this.emitStatus('重新生成执行计划', 'LLM 重新规划');
        const retryResult = await this.planner.plan(
          task,
          {
            files: context.collectedContext.files,
            pageStructure: context.collectedContext.pageStructure,
            ragResults: context.collectedContext.ragResults,
            skillContext: context.collectedContext.skillContext,
            matchedSkillNames: context.collectedContext.matchedSkillNames,
            memoryContext: context.collectedContext.memoryContext,
            filesense: this.config.filesense,
          },
          this.contextManager.getMessages(task.id),
        );
        this.rememberPlannerFallback(retryResult.fallbackReason);

        if (!retryResult.plan) {
          throw new Error(retryResult.rejectionReason ?? '无法生成执行计划');
        }

        planResult.plan = retryResult.plan;
      }

      if (!planResult.plan) {
        throw new Error(planResult.rejectionReason ?? '无法生成执行计划');
      }

      this.contextManager.setPlan(task.id, planResult.plan);
      this.emit({ type: 'planning_completed', plan: planResult.plan });
      this.emitStatus('执行计划已生成', '计划模式完成');

      return {
        success: true,
        taskId: task.id,
        plan: planResult.plan,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emit({ type: 'task_failed', error: errorMessage });
      return {
        success: false,
        taskId: task.id,
        error: errorMessage,
        duration: Date.now() - startTime,
      };
    } finally {
      this.emitStatus('清理计划上下文', '清理计划上下文');
      this.pendingFactsUpdates = [];
      this.factsUpdateFlushInProgress = false;
      this.currentTaskId = undefined;
      this.contextManager.clearContext(task.id);
    }
  }

  async execute(
    taskDescription: string,
    options?: {
      type?: AgentTask['type'];
      relevantFiles?: string[];
      browserUrl?: string;
      signal?: AbortSignal;
    },
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    this.pendingFactsUpdates = [];
    this.factsUpdateFlushInProgress = false;
    this.lastAnswerGenerationError = undefined;
    this.lastLlmFailureError = undefined;
    const skillResolution = this.skillContentResolver?.resolveForTask(taskDescription);
    const resolvedTaskDescription =
      skillResolution?.sanitizedTaskDescription?.trim() || taskDescription;
    const skillContext = skillResolution?.promptContext;
    const matchedSkillNames = skillResolution?.matchedSkills.map((skill) => skill.name) ?? [];

    if (matchedSkillNames.length > 0) {
      this.debugLog(`[Agent] 🎯 Matched content skills: ${matchedSkillNames.join(', ')}`);
    }

    const task: AgentTask = {
      id: generateId('task'),
      type: options?.type ?? 'query',
      description: resolvedTaskDescription,
      context: {
        workingDirectory: this.config.projectRoot,
        relevantFiles: options?.relevantFiles,
        browserUrl: options?.browserUrl,
      },
    };

    this.emit({ type: 'task_started', task });
    this.emitStatus('初始化任务', '初始化运行上下文');

    try {
      this.throwIfAborted(options?.signal);
      this.currentTaskId = task.id;

      const context = this.contextManager.createContext(task, this.sddConfig);
      context.collectedContext.skillContext = skillContext;
      context.collectedContext.matchedSkillNames = matchedSkillNames;
      context.collectedContext.metadata.originalTaskDescription = taskDescription;

      this.emitStatus('加载跨会话记忆', '加载跨会话记忆');
      this.memoryStore.resetSession();
      preloadMemory(this.memoryDeps, task.id, context);

      if (this.promptGenerator) {
        const constitutionPrompt = this.workflowIntegration?.getConstitutionPrompt();
        if (constitutionPrompt) {
          this.contextManager.addMessage(task.id, { role: 'system', content: constitutionPrompt });
        }
        const sddPrompt = this.promptGenerator.generate();
        this.contextManager.addMessage(task.id, {
          role: 'system',
          content: sddPrompt,
        });
      }

      let projectStructure: string | undefined;
      const preScannedFiles = new Map<string, string>();
      try {
        this.emitStatus('扫描项目结构', 'list_directory 扫描项目结构');
        const listResult = (await this.executor.callTool('list_directory', {
          path: this.config.projectRoot,
          recursive: true,
        })) as { success: boolean; entries?: Array<{ name: string; type: string; path: string }> };

        if (listResult.success && listResult.entries) {
          const files = listResult.entries
            .filter(
              (e) =>
                e.type === 'file' && !e.path.includes('node_modules') && !e.path.includes('.git'),
            )
            .map((e) => e.path);

          if (files.length > 0) {
            projectStructure = `项目文件列表（共 ${files.length} 个文件）:\n${files.join('\n')}`;
            this.debugLog(`[Agent] 📂 Pre-scanned project structure: ${files.length} files`);
          }

          const configFiles = files.filter(
            (f) => f.endsWith('package.json') || f.includes('vite.config'),
          );
          for (const configFile of configFiles) {
            try {
              const readResult = (await this.executor.callTool('read_file', {
                path: configFile,
              })) as { success: boolean; content?: string };
              if (readResult.success && readResult.content) {
                preScannedFiles.set(configFile, readResult.content);
              }
            } catch (_error) {
              // Ignore read failures
            }
          }
        }
      } catch (error) {
        this.debugWarn('[Agent] Failed to pre-scan project structure:', error);
      }

      this.emitStatus('检测开发服务器端口', '检测开发服务器端口');
      const devServerPort = detectDevServerPort(
        { debugLog: this.debugLog.bind(this), debugWarn: this.debugWarn.bind(this) },
        preScannedFiles,
      );

      this.emitStatus('检索知识库', 'RAG 检索');
      const ragContext = await retrieveRagContext(this.ragDeps, task.id, task.description);
      const ragResults = ragContext?.formattedResults;

      if (this.config.rag?.enabled !== false) {
        this.emit({
          type: 'rag_retrieved',
          searchMode: ragContext?.searchMode,
          reranked: ragContext?.reranked,
          warnings: ragContext?.warnings,
          timing: ragContext?.timing,
          matches: ragContext?.matches ?? [],
        });
      }

      this.emit({ type: 'planning_started' });
      this.emitStatus('生成执行计划', 'LLM 规划');

      const planResult = await this.planner.plan(
        task,
        {
          files: context.collectedContext.files,
          pageStructure: context.collectedContext.pageStructure,
          ragResults,
          projectStructure,
          devServerPort,
          skillContext,
          matchedSkillNames,
          memoryContext: context.collectedContext.memoryContext,
          filesense: this.config.filesense,
        },
        this.contextManager.getMessages(task.id),
      );
      this.rememberPlannerFallback(planResult.fallbackReason);

      if (planResult.needsMoreContext && planResult.contextRequests) {
        this.emitStatus('补充规划上下文', '读取更多上下文');
        await this.gatherContext(task.id, planResult.contextRequests);

        this.emitStatus('重新生成执行计划', 'LLM 重新规划');
        const retryResult = await this.planner.plan(
          task,
          {
            files: context.collectedContext.files,
            pageStructure: context.collectedContext.pageStructure,
            ragResults: context.collectedContext.ragResults,
            skillContext: context.collectedContext.skillContext,
            matchedSkillNames: context.collectedContext.matchedSkillNames,
            memoryContext: context.collectedContext.memoryContext,
            filesense: this.config.filesense,
          },
          this.contextManager.getMessages(task.id),
        );
        this.rememberPlannerFallback(retryResult.fallbackReason);

        if (!retryResult.plan) {
          throw new Error(retryResult.rejectionReason ?? '无法生成执行计划');
        }

        planResult.plan = retryResult.plan;
      }

      if (!planResult.plan) {
        throw new Error(planResult.rejectionReason ?? '无法生成执行计划');
      }

      const executionPlan = planResult.plan;

      this.contextManager.setPlan(task.id, executionPlan);
      this.emit({ type: 'planning_completed', plan: executionPlan });
      this.emitStatus('执行计划已生成', '执行工具步骤');
      this.throwIfAborted(options?.signal);

      const validations: ValidationResult[] = [];
      const executionContext = this.contextManager.getContext(task.id);

      if (!executionContext) {
        throw new Error('Execution context not found');
      }

      this.emitStatus('执行工具步骤', '执行工具步骤');
      await this.executeSteps(task, executionPlan, executionContext, validations, options?.signal);

      this.throwIfAborted(options?.signal);

      const failedSteps = executionPlan.steps.filter((s) => s.status === 'failed');
      let success = failedSteps.length === 0;
      this.emitStatus(
        task.type === 'query' ? '生成最终回答' : '汇总执行结果',
        task.type === 'query' ? '生成最终回答' : '汇总执行结果',
      );

      let finalOutput: string | undefined;
      try {
        finalOutput = success
          ? await buildFinalOutput(
              { llmService: this.llmService, debugWarn: this.debugWarn.bind(this) },
              task,
              executionPlan.steps,
              executionContext,
            )
          : undefined;
      } catch (error) {
        this.lastAnswerGenerationError = error instanceof Error ? error.message : String(error);
      }

      const missingQueryAnswer = task.type === 'query' && !finalOutput?.trim();
      if (missingQueryAnswer) {
        success = false;
      }
      const missingAnswerCause = this.lastAnswerGenerationError ?? this.lastLlmFailureError;

      const result: AgentExecutionResult = {
        success,
        taskId: task.id,
        executedSteps: executionPlan.steps,
        output: finalOutput,
        error: success
          ? undefined
          : missingQueryAnswer
            ? missingAnswerCause
              ? `任务未能生成最终回答：${missingAnswerCause}`
              : '任务完成了工具步骤，但未生成最终回答。'
            : failedSteps.map((s) => s.result?.error).join('; '),
        duration: Date.now() - startTime,
        validations,
      };

      this.emitStatus('任务执行完成', '准备输出结果');
      this.emit({ type: 'task_completed', result });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emit({ type: 'task_failed', error: errorMessage });

      return {
        success: false,
        taskId: task.id,
        executedSteps: [],
        error: errorMessage,
        duration: Date.now() - startTime,
        validations: [],
      };
    } finally {
      this.emitStatus('持久化运行记忆', '写入跨会话记忆');
      persistMemory(this.memoryDeps, task.id, task.description);

      this.emitStatus('清理运行上下文', '清理运行上下文');
      this.pendingFactsUpdates = [];
      this.factsUpdateFlushInProgress = false;
      this.currentTaskId = undefined;
      this.contextManager.clearContext(task.id);
    }
  }

  private async executeSteps(
    task: AgentTask,
    executionPlan: ExecutionPlan,
    executionContext: NonNullable<ReturnType<ContextManager['getContext']>>,
    validations: ValidationResult[],
    signal?: AbortSignal,
  ): Promise<void> {
    await this.executor.executeStepsWithErrorFeedback(
      executionPlan.steps,
      {
        task,
        collectedContext: {
          files: executionContext.collectedContext.files,
          ragResults: executionContext.collectedContext.ragResults,
          matchedSkillNames: executionContext.collectedContext.matchedSkillNames,
          skillContext: executionContext.collectedContext.skillContext,
          filesenseContext: executionContext.collectedContext.filesenseContext,
        },
      },
      (step) => {
        this.emit({ type: 'step_started', step });
      },
      (step, output) => {
        const toolResult = output.stepResult.output as Record<string, unknown> | undefined;
        const resultWithStatus: Record<string, unknown> = {
          ...toolResult,
          success: output.stepResult.success,
          error: output.stepResult.error,
        };

        this.contextManager.updateFileSystemFacts(
          task.id,
          step.tool,
          step.params,
          resultWithStatus,
        );
        this.contextManager.updateDependencyFacts(
          task.id,
          step.tool,
          step.params,
          resultWithStatus,
        );
        this.contextManager.updateProjectFacts(task.id, step.tool, step.params, resultWithStatus);
        this.contextManager.updateModuleDependencyGraph(
          task.id,
          step.tool,
          step.params,
          resultWithStatus,
        );

        if (output.stepResult.success && step.tool === 'filesense_navigate') {
          this.contextManager.updateFilesenseNavigation(task.id, {
            intent: step.params.intent as FilesenseNavigationIntent | undefined,
            paths: Array.isArray(step.params.paths) ? (step.params.paths as string[]) : undefined,
            data: resultWithStatus.data ?? resultWithStatus,
          });
          const filesenseNavigation = this.contextManager.getContext(task.id)?.collectedContext
            .filesenseNavigation;
          if (filesenseNavigation) {
            this.emit({
              type: 'filesense_navigated',
              intent: filesenseNavigation.intent,
              paths: filesenseNavigation.paths,
              entries: filesenseNavigation.scanned.entries,
              elapsedMs: filesenseNavigation.scanned.elapsedMs,
              truncated: filesenseNavigation.scanned.truncated,
              candidateCount: filesenseNavigation.candidates.length,
              warnings: filesenseNavigation.warnings,
            });
          }
        }

        if (output.stepResult.success) {
          this.emit({ type: 'step_completed', step, result: output.stepResult });

          if (step.action === 'read_file' && output.stepResult.output) {
            const result = output.stepResult.output as Record<string, unknown>;
            if (result.content && step.params.path) {
              const filePath = step.params.path as string;
              executionContext.collectedContext.files.set(filePath, result.content as string);
              this.debugLog(`[Agent] Added read file to context: ${filePath}`);
            }
          }

          if (step.action === 'create_file' && step.params.path) {
            const filePath = step.params.path as string;
            const result = output.stepResult.output as Record<string, unknown> | undefined;
            const content = (result?.content as string) || (step.params.content as string) || '';
            if (content) {
              executionContext.collectedContext.files.set(filePath, content);
              this.debugLog(`[Agent] Added created file to context: ${filePath}`);
            }
          }
        } else {
          this.emit({
            type: 'step_failed',
            step,
            error: output.stepResult.error ?? 'Unknown error',
          });

          this.contextManager.addErrorFact(
            task.id,
            step.stepId,
            step.action,
            output.stepResult.error ?? 'Unknown error',
          );
        }
        validations.push(output.validation);

        this.contextManager.addExecutedStep(task.id, step);
      },
      (phase, stepCount) => {
        this.emit({ type: 'phase_started', phase, stepCount });
      },
      async (phase, errors) => {
        this.throwIfAborted(signal);
        this.emitStatus(`生成恢复计划：${phase}`, '分析错误并生成恢复步骤');
        this.debugLog(`[Agent] Error feedback loop triggered for phase: ${phase}`);

        const missingModules = this.contextManager.validateModuleDependencies(task.id);
        if (missingModules.length > 0) {
          this.debugLog(`[Agent] Found ${missingModules.length} missing module dependencies`);
          for (const missing of missingModules.slice(0, 5)) {
            errors.push({
              step: {
                stepId: 'module-validation',
                description: `模块 ${missing.from} 引用了不存在的模块`,
                action: 'create_file',
                tool: 'create_file',
                params: { path: missing.missing },
                dependencies: [],
                validation: [],
                status: 'failed',
              } as ExecutionStep,
              error: `Missing module: ${missing.importPath} (resolved: ${missing.missing})`,
            });
          }
        }

        const factsContext = this.contextManager.serializeFactsForLLM(task.id);

        const recoveryPlan = await this.llmService.analyzeErrorsAndGenerateRecovery({
          task: task.description,
          phase,
          failedSteps: errors.map((e) => ({
            description: e.step.description,
            action: e.step.action,
            params: e.step.params,
            error: e.error,
          })),
          context: factsContext || '无可用的项目状态信息',
        });

        this.debugLog(`[Agent] Recovery plan analysis: ${recoveryPlan.analysis}`);
        this.debugLog(`[Agent] Can recover: ${recoveryPlan.canRecover}`);
        this.debugLog(`[Agent] Recommendation: ${recoveryPlan.recommendation}`);

        if (!recoveryPlan.canRecover) {
          this.debugWarn(`[Agent] Cannot recover from errors in phase ${phase}`);
          return [];
        }

        const recoveryStepIds = recoveryPlan.recoverySteps.map(() => generateId('recovery-step'));
        const recoverySteps: ExecutionStep[] = recoveryPlan.recoverySteps.map((step, idx) => ({
          stepId: recoveryStepIds[idx],
          description: step.description,
          action: step.action as ActionType,
          tool: step.tool,
          params: step.params as Record<string, unknown>,
          dependencies: idx > 0 ? [recoveryStepIds[idx - 1]] : [],
          validation: [],
          status: 'pending' as const,
          phase: step.phase,
        }));

        this.debugLog(`[Agent] Generated ${recoverySteps.length} recovery steps`);
        this.emitStatus(`恢复计划生成完成：${phase}`, `恢复步骤 ${recoverySteps.length} 个`);
        return recoverySteps;
      },
      async (phase, phaseResults) => {
        this.throwIfAborted(signal);
        const successCount = phaseResults.filter((r) => r.stepResult.success).length;
        const failureCount = phaseResults.filter((r) => !r.stepResult.success).length;
        this.emitStatus(`阶段检查：${phase}`, '阶段完成检查');

        const errors: Array<{ step: ExecutionStep; error: string }> = [];

        if (shouldRunPhaseChecks(phase)) {
          this.debugLog(`[Agent] Running phase completion checks for: ${phase}`);

          this.emitStatus(`检查模块依赖：${phase}`, '模块依赖检查');
          const missingModules = this.contextManager.validateModuleDependencies(task.id);
          if (missingModules.length > 0) {
            this.debugLog(
              `[Agent] Module validation found ${missingModules.length} missing dependencies`,
            );
            errors.push(
              ...missingModules.slice(0, 5).map((missing) => ({
                step: {
                  stepId: `module-validation-${missing.missing.replace(/[^a-zA-Z0-9]/g, '-')}`,
                  description: `模块 ${missing.from} 引用了不存在的模块: ${missing.importPath}`,
                  action: 'create_file' as const,
                  tool: 'create_file',
                  params: { path: missing.missing },
                  dependencies: [],
                  validation: [],
                  status: 'failed' as const,
                } as ExecutionStep,
                error: `Missing module: ${missing.importPath} (resolved path: ${missing.missing})`,
              })),
            );
          }

          try {
            this.emitStatus(`刷新依赖清单：${phase}`, '读取 package.json');
            const pkgJsonResult = (await this.executor.callTool('read_file', {
              path: 'package.json',
            })) as { success: boolean; content?: string };
            if (pkgJsonResult.success && pkgJsonResult.content) {
              executionContext.collectedContext.files.set('package.json', pkgJsonResult.content);
            }
          } catch (error) {
            this.debugWarn('[Agent] Failed to refresh package.json:', error);
          }

          this.emitStatus(`检查缺失依赖：${phase}`, 'npm 依赖检查');
          const missingDeps = await checkMissingNpmDependencies(
            this.phaseCheckDeps,
            executionContext.collectedContext.files,
          );
          if (missingDeps.length > 0) {
            this.debugLog(
              `[Agent] Found ${missingDeps.length} missing npm dependencies: ${missingDeps.join(', ')}`,
            );
            errors.push({
              step: {
                stepId: 'install-missing-deps',
                description: `安装缺失的依赖: ${missingDeps.join(', ')}`,
                action: 'run_command' as const,
                tool: 'run_command',
                params: { command: `npm install ${missingDeps.join(' ')}` },
                dependencies: [],
                validation: [],
                status: 'failed' as const,
              } as ExecutionStep,
              error: `Missing npm dependencies: ${missingDeps.join(', ')}`,
            });
          }

          const hasTsConfig = executionContext.collectedContext.files.has('tsconfig.json');
          if (hasTsConfig) {
            this.emitStatus(`TypeScript 检查：${phase}`, '运行类型检查');
            this.debugLog('[Agent] Running TypeScript type check...');
            const typeErrors = await runTypeCheck(
              this.phaseCheckDeps,
              task.context?.workingDirectory || process.cwd(),
            );
            if (typeErrors.length > 0) {
              this.debugLog(`[Agent] TypeScript check found ${typeErrors.length} errors`);
              for (const error of typeErrors.slice(0, 10)) {
                this.contextManager.addErrorFact(
                  task.id,
                  'type-check',
                  'typescript',
                  error.message,
                );
              }

              const tsErrorOutput = typeErrors.map((e) => e.message).join('\n');
              errors.push({
                step: {
                  stepId: 'typescript-type-check',
                  description: 'TypeScript 类型检查',
                  action: 'run_command' as const,
                  tool: 'run_command',
                  params: { command: 'npx tsc --noEmit' },
                  dependencies: [],
                  validation: [],
                  status: 'failed' as const,
                  phase,
                } as ExecutionStep,
                error: `TypeScript compilation failed with ${typeErrors.length} error(s):\n${tsErrorOutput}`,
              });
            } else {
              this.debugLog('[Agent] ✅ TypeScript check passed');
            }
          }

          this.emitStatus(`代码质量检查：${phase}`, 'SubAgent 代码质量评估');
          const qualityIssues = await evaluateGeneratedCodeQualityViaSubAgent(
            this.phaseCheckDeps,
            task.id,
            phase,
            executionPlan.steps,
            executionContext.collectedContext.files,
          );
          if (qualityIssues.length > 0) {
            const errorCount = qualityIssues.filter((issue) => issue.severity === 'error').length;
            const warningCount = qualityIssues.filter(
              (issue) => issue.severity === 'warning',
            ).length;
            this.debugLog(
              `[Agent] CodeQualitySubAgent found ${errorCount} error(s), ${warningCount} warning(s)`,
            );

            const failOnWarnings =
              this.config.subAgents?.codeQualityEvaluator?.failOnWarnings ?? false;
            const blockingIssues = qualityIssues.filter(
              (issue: CodeQualityIssue) =>
                issue.severity === 'error' || (failOnWarnings && issue.severity === 'warning'),
            );

            if (blockingIssues.length > 0) {
              const issueText = blockingIssues
                .slice(0, 10)
                .map((issue: CodeQualityIssue) => {
                  const lineText = issue.line ? `:${issue.line}` : '';
                  return `- ${issue.filePath}${lineText} [${issue.rule}] ${issue.message}`;
                })
                .join('\n');

              errors.push({
                step: {
                  stepId: generateId('code-quality-review'),
                  description: 'SubAgent 代码质量评估',
                  action: 'run_command' as const,
                  tool: 'run_command',
                  params: { command: 'subagent:code-quality-review' },
                  dependencies: [],
                  validation: [],
                  status: 'failed' as const,
                  phase,
                } as ExecutionStep,
                error: `Code quality review found ${blockingIssues.length} blocking issue(s):\n${issueText}`,
              });
            }
          }
        }

        this.emit({ type: 'phase_completed', phase, successCount, failureCount });
        return errors;
      },
      signal,
    );
  }

  private async gatherContext(
    taskId: string,
    requests: Array<{ type: string; params: Record<string, unknown> }>,
  ): Promise<void> {
    for (const request of requests) {
      try {
        switch (request.type) {
          case 'read_file': {
            const path = request.params.path as string;
            const result = await this.executor.callTool('read_file', { path });
            if ((result as { success?: boolean }).success) {
              this.contextManager.addFile(taskId, path, (result as { content: string }).content);
            }
            break;
          }
          case 'get_page': {
            const url = request.params.url as string;
            await this.executor.callTool('browser_navigate', { url });
            const result = await this.executor.callTool('get_page_structure', {});
            this.contextManager.setPageStructure(taskId, result);
            break;
          }
          case 'rag_query': {
            const query = request.params.query as string;
            const maxResults = request.params.maxResults as number | undefined;
            const rewrittenQuery = await rewriteRagQueryForRetrieval(this.ragDeps, query);
            const retrievalQuery = rewrittenQuery
              ? mergeRetrievalQuery(query, rewrittenQuery)
              : normalizeSearchQuery(query);
            const result = (await this.executor.callTool('rag_query', {
              query: retrievalQuery,
              maxResults,
            })) as {
              success?: boolean;
              results?: Array<{
                type: string;
                title: string;
                sourceUrl: string;
                snippet: string;
                path?: string;
              }>;
            };

            if (result.success && result.results?.length) {
              this.contextManager.addRagResults(
                taskId,
                result.results.map((item) => formatRagResult(item)),
              );
            }
            break;
          }
        }
      } catch (error) {
        this.debugWarn(`Failed to gather context: ${request.type}`, error);
      }
    }
  }

  private rememberPlannerFallback(reason: string | undefined): void {
    if (reason && !this.lastLlmFailureError) {
      this.lastLlmFailureError = reason;
    }
  }

  private async enqueueFactsUpdate(taskId: string, update: ProjectFactsUpdate): Promise<void> {
    this.pendingFactsUpdates.push(update);
    await this.flushFactsUpdates(taskId);
  }

  private async flushFactsUpdates(taskId: string): Promise<void> {
    if (this.factsUpdateFlushInProgress) {
      return;
    }

    this.factsUpdateFlushInProgress = true;
    while (true) {
      try {
        while (this.pendingFactsUpdates.length > 0) {
          const nextUpdate = this.pendingFactsUpdates.shift();
          if (!nextUpdate) {
            continue;
          }

          const mergeResult = this.contextManager.mergeFactsUpdate(taskId, nextUpdate);
          const staleText = mergeResult.staleBaseRevision
            ? ' (stale base revision, rebased in main reducer)'
            : '';
          this.debugLog(
            `[Agent] Merged facts update from ${mergeResult.source}: ` +
              `r${mergeResult.previousRevision} -> r${mergeResult.nextRevision}${staleText}`,
          );
        }
      } finally {
        this.factsUpdateFlushInProgress = false;
      }

      if (this.pendingFactsUpdates.length === 0) {
        break;
      }

      this.factsUpdateFlushInProgress = true;
    }
  }

  getSDDConfig(): SDDConfig | undefined {
    return this.sddConfig;
  }

  updateSDDConfig(configPath: string): boolean {
    const parseResult = this.sddParser.parseFile(configPath);
    if (parseResult.success && parseResult.config) {
      this.sddConfig = parseResult.config;
      this.promptGenerator = new SDDPromptGenerator(this.sddConfig);
      this.hallucinationGuard.updateSDDConfig(this.sddConfig);
      this.planner.updateSDDConfig(this.sddConfig);
      return true;
    }
    return false;
  }

  generateSDDPrompt(): string {
    if (!this.promptGenerator) {
      return '';
    }
    return this.promptGenerator.generate();
  }
}

/**
 * 创建 FrontAgent 实例
 */
export function createAgent(config: AgentConfig): FrontAgent {
  return new FrontAgent(config);
}
