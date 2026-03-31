/**
 * Agent 主类
 * 负责整体编排
 */

import type { AgentTask, ExecutionPlan, ExecutionStep, SDDConfig, ValidationResult } from '@frontagent/shared';
import { generateId } from '@frontagent/shared';
import { SDDParser, SDDPromptGenerator } from '@frontagent/sdd';
import { HallucinationGuard } from '@frontagent/hallucination-guard';
import { z } from 'zod';
import { ContextManager } from './context.js';
import { Planner } from './planner.js';
import { Executor, type MCPClient } from './executor.js';
import { LLMService } from './llm.js';
import { InMemoryA2ABus, type A2AAgent } from './a2a.js';
import { SkillContentLoader } from './skill-content/loader.js';
import { SkillContentResolver } from './skill-content/resolver.js';
import {
  CodeQualitySubAgent,
  ProcessIsolatedCodeQualitySubAgent,
  type CodeQualityIssue,
  type CodeQualityReviewFile,
  type CodeQualityReviewRequest,
  type CodeQualityReviewResponse
} from './sub-agents/index.js';
import type {
  ExecutorActionSkill,
  ExecutorSkillsLayerSnapshot,
  PhaseInjectionSkill,
  PlannerSkillsLayerSnapshot,
  TaskPlanningSkill,
} from './skills/index.js';
import type {
  AgentConfig,
  AgentExecutionResult,
  AgentEvent,
  AgentEventListener,
  ProjectFactsUpdate,
  RagContextMatch,
} from './types.js';

interface RetrievedRagContext {
  formattedResults: string[];
  matches: RagContextMatch[];
  searchMode?: 'hybrid' | 'keyword_only';
  reranked?: boolean;
  warnings?: string[];
}

const ragQueryRewriteSchema = z.object({
  searchQuery: z.string().min(1),
});

function truncateForPrompt(input: string, maxLength: number): string {
  if (input.length <= maxLength) {
    return input;
  }
  return `${input.slice(0, maxLength)}\n...`;
}

function normalizeSearchQuery(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^["'`“”]+|["'`“”]+$/g, '')
    .trim();
}

function mergeRetrievalQuery(originalQuery: string, rewrittenQuery: string): string {
  const original = normalizeSearchQuery(originalQuery);
  const rewritten = normalizeSearchQuery(rewrittenQuery);

  if (!rewritten) {
    return original;
  }

  if (!original) {
    return rewritten;
  }

  if (rewritten.includes(original)) {
    return rewritten;
  }

  if (original.includes(rewritten)) {
    return original;
  }

  const merged = `${original} ${rewritten}`.trim();
  return merged.length > 320 ? merged.slice(0, 320).trim() : merged;
}

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
  private currentTaskId?: string;  // 🔧 修复问题1：追踪当前执行的任务ID
  private a2aBus: InMemoryA2ABus;
  private codeQualitySubAgent?: A2AAgent<CodeQualityReviewRequest, CodeQualityReviewResponse>;
  private skillContentResolver?: SkillContentResolver;
  private pendingFactsUpdates: ProjectFactsUpdate[] = [];
  private factsUpdateFlushInProgress = false;

  constructor(config: AgentConfig) {
    this.config = config;
    this.contextManager = new ContextManager();
    this.sddParser = new SDDParser();

    // 加载 SDD 配置
    if (config.sddPath) {
      const parseResult = this.sddParser.parseFile(config.sddPath);
      if (parseResult.success && parseResult.config) {
        this.sddConfig = parseResult.config;
        this.promptGenerator = new SDDPromptGenerator(this.sddConfig);
      }
    }

    // 初始化 LLM 服务
    this.llmService = new LLMService(config.llm);

    // 初始化幻觉防控器
    this.hallucinationGuard = new HallucinationGuard({
      projectRoot: config.projectRoot,
      sddConfig: this.sddConfig,
      enabledChecks: config.hallucinationGuard?.checks
    });

    // 初始化 Planner
    this.planner = new Planner({
      llm: config.llm,
      sddConfig: this.sddConfig
    });

    // 初始化 Executor（两阶段架构 - 传递 llmService 和 SDD 约束）
    this.executor = new Executor({
      hallucinationGuard: this.hallucinationGuard,
      llmService: this.llmService,
      debug: config.debug,
      executionEngine: config.execution?.engine,
      langGraph: config.execution?.langGraph,
      getSddConstraints: () => this.promptGenerator?.generate(),
      getSkillContext: () => {
        if (!this.currentTaskId) return undefined;
        return this.contextManager.getContext(this.currentTaskId)?.collectedContext.skillContext;
      },
      // 🔧 修复问题1：传递文件系统事实，帮助 Executor 判断文件是否存在
      getFileSystemFacts: () => {
        if (!this.currentTaskId) return undefined;
        const context = this.contextManager.getContext(this.currentTaskId);
        return context?.facts.filesystem;
      }
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

    // 初始化 A2A 总线和代码质量 SubAgent
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
          debug: config.debug ?? false
        });
      } else {
        this.codeQualitySubAgent = new CodeQualitySubAgent({
          llmService: enableLLMReview ? this.llmService : undefined,
          enableRuleFallback: codeQualityConfig?.enableRuleFallback ?? true,
          maxFilesForLLM: codeQualityConfig?.maxFilesForLLM,
          maxCharsPerFileForLLM: codeQualityConfig?.maxCharsPerFileForLLM,
          debug: config.debug ?? false
        });
      }

      this.a2aBus.registerAgent(this.codeQualitySubAgent);
    }
  }

  /**
   * 注册 MCP 客户端
   */
  registerMCPClient(name: string, client: MCPClient): void {
    this.executor.registerMCPClient(name, client);
  }

  /**
   * 注册工具映射
   */
  registerToolMapping(toolName: string, clientName: string): void {
    this.executor.registerToolMapping(toolName, clientName);
  }

  /**
   * 注册任务级 planning skill
   */
  registerTaskSkill(skill: TaskPlanningSkill): void {
    this.planner.registerTaskSkill(skill);
  }

  /**
   * 注册阶段注入 skill
   */
  registerPhaseSkill(skill: PhaseInjectionSkill): void {
    this.planner.registerPhaseSkill(skill);
  }

  /**
   * 获取 Planner 的 skills 层快照
   */
  getPlannerSkillSnapshot(): PlannerSkillsLayerSnapshot {
    return this.planner.getSkillLayerSnapshot();
  }

  /**
   * 注册 Executor action skill
   */
  registerExecutorActionSkill(skill: ExecutorActionSkill): void {
    this.executor.registerActionSkill(skill);
  }

  /**
   * 获取 Executor 的 action skills 快照
   */
  getExecutorSkillSnapshot(): ExecutorSkillsLayerSnapshot {
    return this.executor.getActionSkillSnapshot();
  }

  /**
   * 批量注册文件工具
   */
  registerFileTools(): void {
    const tools = [
      'read_file',
      'apply_patch',
      'create_file',
      'search_code',
      'list_directory',
      'get_ast',
      'rollback',
      'get_snapshots'
    ];
    for (const tool of tools) {
      this.executor.registerToolMapping(tool, 'file');
    }
  }

  /**
   * 批量注册 Web 工具
   */
  registerWebTools(): void {
    const tools = [
      'browser_navigate',    // 注意工具名
      'get_page_structure',
      'get_accessibility_tree',
      'get_interactive_elements',
      'browser_click',
      'browser_type',
      'browser_scroll',
      'browser_screenshot',
      'browser_wait_for_selector',
      // Backward-compatible aliases for historical plans/prompts.
      'navigate',
      'click',
      'type',
      'scroll',
      'screenshot',
      'wait_for_selector'
    ];
    for (const tool of tools) {
      this.executor.registerToolMapping(tool, 'web');
    }
  }

  /**
   * 批量注册 Shell 工具
   */
  registerShellTools(): void {
    const tools = ['run_command'];
    for (const tool of tools) {
      this.executor.registerToolMapping(tool, 'shell');
    }
  }

  /**
   * 批量注册 Memory / RAG 工具
   */
  registerMemoryTools(): void {
    const tools = ['rag_query'];
    for (const tool of tools) {
      this.executor.registerToolMapping(tool, 'memory');
    }
  }

  /**
   * 添加事件监听器
   */
  addEventListener(listener: AgentEventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(listener: AgentEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * 触发事件
   */
  private emit(event: AgentEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Event listener error:', error);
      }
    }
  }

  /**
   * 执行任务
   */
  async execute(taskDescription: string, options?: {
    type?: AgentTask['type'];
    relevantFiles?: string[];
    browserUrl?: string;
  }): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    this.pendingFactsUpdates = [];
    this.factsUpdateFlushInProgress = false;
    const skillResolution = this.skillContentResolver?.resolveForTask(taskDescription);
    const resolvedTaskDescription = skillResolution?.sanitizedTaskDescription?.trim() || taskDescription;
    const skillContext = skillResolution?.promptContext;
    const matchedSkillNames = skillResolution?.matchedSkills.map((skill) => skill.name) ?? [];

    if (this.config.debug && matchedSkillNames.length > 0) {
      console.log(`[Agent] 🎯 Matched content skills: ${matchedSkillNames.join(', ')}`);
    }

    // 创建任务
    const task: AgentTask = {
      id: generateId('task'),
      type: options?.type ?? 'query',
      description: resolvedTaskDescription,
      context: {
        workingDirectory: this.config.projectRoot,
        relevantFiles: options?.relevantFiles,
        browserUrl: options?.browserUrl
      }
    };

    this.emit({ type: 'task_started', task });

    try {
      // 设置当前任务ID，以便 Executor 能获取文件系统事实
      this.currentTaskId = task.id;

      // 创建上下文
      const context = this.contextManager.createContext(task, this.sddConfig);
      context.collectedContext.skillContext = skillContext;
      context.collectedContext.matchedSkillNames = matchedSkillNames;
      context.collectedContext.metadata.originalTaskDescription = taskDescription;

      // 添加 SDD 约束到系统提示
      if (this.promptGenerator) {
        const sddPrompt = this.promptGenerator.generate();
        this.contextManager.addMessage(task.id, {
          role: 'system',
          content: sddPrompt
        });
      }

      // 🔧 优化：规划前先获取项目文件结构，帮助 LLM 生成正确的文件路径
      let projectStructure: string | undefined;
      const preScannedFiles = new Map<string, string>();  // 用于端口检测
      try {
        const listResult = await this.executor['callTool']('list_directory', {
          path: this.config.projectRoot,
          recursive: true
        }) as { success: boolean; entries?: Array<{ name: string; type: string; path: string }> };

        if (listResult.success && listResult.entries) {
          // 只保留文件（不包括目录），并过滤掉 node_modules 等
          const files = listResult.entries
            .filter(e => e.type === 'file' && !e.path.includes('node_modules') && !e.path.includes('.git'))
            .map(e => e.path);

          if (files.length > 0) {
            projectStructure = `项目文件列表（共 ${files.length} 个文件）:\n${files.join('\n')}`;
            console.log(`[Agent] 📂 Pre-scanned project structure: ${files.length} files`);
          }

          // 预读取关键配置文件用于端口检测
          const configFiles = files.filter(f =>
            f.endsWith('package.json') ||
            f.includes('vite.config')
          );
          for (const configFile of configFiles) {
            try {
              const readResult = await this.executor['callTool']('read_file', { path: configFile }) as { success: boolean; content?: string };
              if (readResult.success && readResult.content) {
                preScannedFiles.set(configFile, readResult.content);
              }
            } catch (error) {
              // 忽略读取失败
            }
          }
        }
      } catch (error) {
        console.warn('[Agent] Failed to pre-scan project structure:', error);
      }

      // 🔧 检测开发服务器端口
      const devServerPort = await this.detectDevServerPort(preScannedFiles);

      // RAG 预检索：在规划前注入远程知识库结果
      const ragContext = await this.retrieveRagContext(task.id, task.description);
      const ragResults = ragContext?.formattedResults;

      if (this.config.rag?.enabled !== false) {
        this.emit({
          type: 'rag_retrieved',
          searchMode: ragContext?.searchMode,
          reranked: ragContext?.reranked,
          warnings: ragContext?.warnings,
          matches: ragContext?.matches ?? [],
        });
      }

      // 规划阶段
      this.emit({ type: 'planning_started' });

      const planResult = await this.planner.plan(
        task,
        {
          files: context.collectedContext.files,
          pageStructure: context.collectedContext.pageStructure,
          ragResults,
          projectStructure,  // 🔧 传递项目文件结构给 Planner
          devServerPort,    // 🔧 传递检测到的端口给 Planner
          skillContext,
          matchedSkillNames,
        },
        this.contextManager.getMessages(task.id)
      );

      // 如果需要更多上下文
      if (planResult.needsMoreContext && planResult.contextRequests) {
        await this.gatherContext(task.id, planResult.contextRequests);

        // 重新规划
        const retryResult = await this.planner.plan(
          task,
          {
            files: context.collectedContext.files,
            pageStructure: context.collectedContext.pageStructure,
            ragResults: context.collectedContext.ragResults,
            skillContext: context.collectedContext.skillContext,
            matchedSkillNames: context.collectedContext.matchedSkillNames,
          },
          this.contextManager.getMessages(task.id)
        );

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

      // 执行阶段（两阶段架构 - 传递上下文给 Executor）
      const validations: ValidationResult[] = [];
      const executionContext = this.contextManager.getContext(task.id);

      if (!executionContext) {
        throw new Error('Execution context not found');
      }

      // 执行阶段：使用错误反馈循环机制
      // Executor 只关注执行 Plan，不再传递 SDD 约束
      // SDD 已在 Planner 阶段约束，确保生成的 Plan 符合 SDD 规范
      await this.executor.executeStepsWithErrorFeedback(
        executionPlan.steps,
        {
          task,
          collectedContext: {
            files: executionContext.collectedContext.files,
            ragResults: executionContext.collectedContext.ragResults,
            matchedSkillNames: executionContext.collectedContext.matchedSkillNames,
            skillContext: executionContext.collectedContext.skillContext,
          },
        },
        // onStepComplete
        (step, output) => {
          // 更新项目事实（从工具执行结果中提取结构化信息）
          const toolResult = output.stepResult.output as any;
          const resultWithStatus = {
            success: output.stepResult.success,
            error: output.stepResult.error,
            ...toolResult
          };

          // 更新文件系统事实
          this.contextManager.updateFileSystemFacts(task.id, step.tool, step.params, resultWithStatus);
          // 更新依赖事实
          this.contextManager.updateDependencyFacts(task.id, step.tool, step.params, resultWithStatus);
          // 更新项目状态事实
          this.contextManager.updateProjectFacts(task.id, step.tool, step.params, resultWithStatus);
          // 更新模块依赖图（追踪已创建的模块）
          this.contextManager.updateModuleDependencyGraph(task.id, step.tool, step.params, resultWithStatus);

          if (output.stepResult.success) {
            this.emit({ type: 'step_completed', step, result: output.stepResult });

            // 如果是 read_file，将内容添加到上下文
            if (step.action === 'read_file' && output.stepResult.output) {
              const result = output.stepResult.output as any;
              if (result.content && step.params.path) {
                const filePath = step.params.path as string;
                executionContext.collectedContext.files.set(filePath, result.content);
                if (this.config.debug) {
                  console.log(`[Agent] Added read file to context: ${filePath}`);
                }
              }
            }

            // 如果是 create_file，也将创建的内容添加到上下文（用于后续代码生成时知道哪些模块已存在）
            if (step.action === 'create_file' && step.params.path) {
              const filePath = step.params.path as string;
              const result = output.stepResult.output as any;
              const content = result?.content || step.params.content as string || '';
              if (content) {
                executionContext.collectedContext.files.set(filePath, content);
                if (this.config.debug) {
                  console.log(`[Agent] Added created file to context: ${filePath}`);
                }
              }
            }
          } else {
            this.emit({ type: 'step_failed', step, error: output.stepResult.error ?? 'Unknown error' });

            // 记录错误事实
            this.contextManager.addErrorFact(
              task.id,
              step.stepId,
              step.action,
              output.stepResult.error ?? 'Unknown error'
            );
          }
          validations.push(output.validation);

          // 更新上下文
          this.contextManager.addExecutedStep(task.id, step);
        },
        // onPhaseError: Tool Error Feedback Loop
        async (phase, errors) => {
          console.log(`[Agent] Error feedback loop triggered for phase: ${phase}`);

          // 检查模块依赖问题（在创建阶段尤其重要）
          const missingModules = this.contextManager.validateModuleDependencies(task.id);
          if (missingModules.length > 0) {
            console.log(`[Agent] Found ${missingModules.length} missing module dependencies`);
            // 将缺失的模块作为额外的错误添加到分析中
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
                  status: 'failed'
                } as ExecutionStep,
                error: `Missing module: ${missing.importPath} (resolved: ${missing.missing})`
              });
            }
          }

          // 使用结构化的事实而非日志
          const factsContext = this.contextManager.serializeFactsForLLM(task.id);

          // 调用LLM分析错误并生成修复步骤
          const recoveryPlan = await this.llmService.analyzeErrorsAndGenerateRecovery({
            task: task.description,
            phase,
            failedSteps: errors.map(e => ({
              description: e.step.description,
              action: e.step.action,
              params: e.step.params,
              error: e.error
            })),
            context: factsContext || '无可用的项目状态信息'
          });

          console.log(`[Agent] Recovery plan analysis: ${recoveryPlan.analysis}`);
          console.log(`[Agent] Can recover: ${recoveryPlan.canRecover}`);
          console.log(`[Agent] Recommendation: ${recoveryPlan.recommendation}`);

          if (!recoveryPlan.canRecover) {
            console.warn(`[Agent] Cannot recover from errors in phase ${phase}`);
            return [];
          }

          // 将LLM生成的修复步骤转换为ExecutionStep
          const recoverySteps: ExecutionStep[] = recoveryPlan.recoverySteps.map((step, idx) => ({
            stepId: generateId('recovery-step'),
            description: step.description,
            action: step.action as any,
            tool: step.tool,
            params: step.params as Record<string, unknown>,
            dependencies: idx > 0 ? [generateId('recovery-step')] : [],
            validation: [],
            status: 'pending' as const,
            phase: step.phase
          }));

          console.log(`[Agent] Generated ${recoverySteps.length} recovery steps`);
          return recoverySteps;
        },
        // onPhaseComplete: 阶段结束时进行自检验证
        async (phase, _results) => {
          const errors: Array<{ step: ExecutionStep; error: string }> = [];

          // 在代码实现阶段结束后进行多项检查
          if (this.shouldRunPhaseChecks(phase)) {
            console.log(`[Agent] Running phase completion checks for: ${phase}`);

            // 1. 检查模块依赖
            const missingModules = this.contextManager.validateModuleDependencies(task.id);
            if (missingModules.length > 0) {
              console.log(`[Agent] Module validation found ${missingModules.length} missing dependencies`);
              errors.push(...missingModules.slice(0, 5).map(missing => ({
                step: {
                  stepId: `module-validation-${missing.missing.replace(/[^a-zA-Z0-9]/g, '-')}`,
                  description: `模块 ${missing.from} 引用了不存在的模块: ${missing.importPath}`,
                  action: 'create_file' as const,
                  tool: 'create_file',
                  params: { path: missing.missing },
                  dependencies: [],
                  validation: [],
                  status: 'failed' as const
                } as ExecutionStep,
                error: `Missing module: ${missing.importPath} (resolved path: ${missing.missing})`
              })));
            }

            // 2. 检查缺失的 npm 依赖（检查代码中使用但未在 package.json 中声明的依赖）
            // 重新读取 package.json 以获取最新的依赖列表（可能已通过 npm install 更新）
            try {
              const pkgJsonResult = await this.executor['callTool']('read_file', { path: 'package.json' }) as { success: boolean; content?: string };
              if (pkgJsonResult.success && pkgJsonResult.content) {
                executionContext.collectedContext.files.set('package.json', pkgJsonResult.content);
              }
            } catch (error) {
              console.warn('[Agent] Failed to refresh package.json:', error);
            }

            const missingDeps = await this.checkMissingNpmDependencies(executionContext.collectedContext.files);
            if (missingDeps.length > 0) {
              console.log(`[Agent] Found ${missingDeps.length} missing npm dependencies: ${missingDeps.join(', ')}`);
              // 生成安装缺失依赖的步骤
              errors.push({
                step: {
                  stepId: 'install-missing-deps',
                  description: `安装缺失的依赖: ${missingDeps.join(', ')}`,
                  action: 'run_command' as const,
                  tool: 'run_command',
                  params: { command: `npm install ${missingDeps.join(' ')}` },
                  dependencies: [],
                  validation: [],
                  status: 'failed' as const
                } as ExecutionStep,
                error: `Missing npm dependencies: ${missingDeps.join(', ')}`
              });
            }

            // 3. TypeScript 类型检查（如果有 tsconfig.json）
            const hasTsConfig = executionContext.collectedContext.files.has('tsconfig.json');
            if (hasTsConfig) {
              console.log(`[Agent] Running TypeScript type check...`);
              const typeErrors = await this.runTypeCheck(task.context?.workingDirectory || process.cwd());
              if (typeErrors.length > 0) {
                console.log(`[Agent] TypeScript check found ${typeErrors.length} errors`);
                // 记录 TS 错误到 Facts 系统
                for (const error of typeErrors.slice(0, 10)) {
                  this.contextManager.addErrorFact(task.id, 'type-check', 'typescript', error.message);
                }

                // 触发错误恢复机制
                const tsErrorOutput = typeErrors.map(e => e.message).join('\n');
                errors.push({
                  step: {
                    stepId: 'typescript-type-check',
                    description: `TypeScript 类型检查`,
                    action: 'run_command' as const,
                    tool: 'run_command',
                    params: { command: 'npx tsc --noEmit' },
                    dependencies: [],
                    validation: [],
                    status: 'failed' as const,
                    phase
                  } as ExecutionStep,
                  error: `TypeScript compilation failed with ${typeErrors.length} error(s):\n${tsErrorOutput}`
                });
              } else {
                console.log(`[Agent] ✅ TypeScript check passed`);
              }
            }

            // 4. 通过 A2A 调用代码质量 SubAgent 审核本阶段生成/修改的文件
            const qualityIssues = await this.evaluateGeneratedCodeQualityViaSubAgent(
              task.id,
              phase,
              executionPlan.steps,
              executionContext.collectedContext.files
            );
            if (qualityIssues.length > 0) {
              const errorCount = qualityIssues.filter(issue => issue.severity === 'error').length;
              const warningCount = qualityIssues.filter(issue => issue.severity === 'warning').length;
              console.log(`[Agent] CodeQualitySubAgent found ${errorCount} error(s), ${warningCount} warning(s)`);

              const failOnWarnings = this.config.subAgents?.codeQualityEvaluator?.failOnWarnings ?? false;
              const blockingIssues = qualityIssues.filter(
                issue => issue.severity === 'error' || (failOnWarnings && issue.severity === 'warning')
              );

              if (blockingIssues.length > 0) {
                const issueText = blockingIssues
                  .slice(0, 10)
                  .map(issue => {
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
                    phase
                  } as ExecutionStep,
                  error: `Code quality review found ${blockingIssues.length} blocking issue(s):\n${issueText}`
                });
              }
            }
          }

          return errors;
        }
      );

      // 检查是否有失败的步骤
      const failedSteps = executionPlan.steps.filter(s => s.status === 'failed');
      const success = failedSteps.length === 0;
      const finalOutput = success
        ? await this.buildFinalOutput(task, executionPlan.steps, executionContext)
        : undefined;

      const result: AgentExecutionResult = {
        success,
        taskId: task.id,
        executedSteps: executionPlan.steps,
        output: finalOutput,
        error: success ? undefined : failedSteps.map(s => s.result?.error).join('; '),
        duration: Date.now() - startTime,
        validations
      };

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
        validations: []
      };
    } finally {
      // 清理上下文
      this.pendingFactsUpdates = [];
      this.factsUpdateFlushInProgress = false;
      this.currentTaskId = undefined;  // 清理当前任务ID
      this.contextManager.clearContext(task.id);
    }
  }

  /**
   * 收集上下文
   */
  private async gatherContext(
    taskId: string,
    requests: Array<{ type: string; params: Record<string, unknown> }>
  ): Promise<void> {
    for (const request of requests) {
      try {
        switch (request.type) {
          case 'read_file': {
            const path = request.params.path as string;
            const result = await this.executor['callTool']('read_file', { path });
            if ((result as { success?: boolean }).success) {
              this.contextManager.addFile(
                taskId,
                path,
                (result as { content: string }).content
              );
            }
            break;
          }
          case 'get_page': {
            const url = request.params.url as string;
            await this.executor['callTool']('browser_navigate', { url });
            const result = await this.executor['callTool']('get_page_structure', {});
            this.contextManager.setPageStructure(taskId, result);
            break;
          }
          case 'rag_query': {
            const query = request.params.query as string;
            const maxResults = request.params.maxResults as number | undefined;
            const rewrittenQuery = await this.rewriteRagQueryForRetrieval(query);
            const retrievalQuery = rewrittenQuery
              ? mergeRetrievalQuery(query, rewrittenQuery)
              : normalizeSearchQuery(query);
            const result = await this.executor['callTool']('rag_query', { query: retrievalQuery, maxResults }) as {
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
                result.results.map((item) => this.formatRagResult(item))
              );
            }
            break;
          }
        }
      } catch (error) {
        if (this.config.debug) {
          console.warn(`Failed to gather context: ${request.type}`, error);
        }
      }
    }
  }

  /**
   * 生成输出摘要
   */
  private generateOutput(steps: ExecutionPlan['steps']): string {
    const completedSteps = steps.filter(s => s.status === 'completed');
    const summary = completedSteps.map(s => `✅ ${s.description}`).join('\n');
    return `执行完成 (${completedSteps.length}/${steps.length} 步骤成功)\n\n${summary}`;
  }

  private async buildFinalOutput(
    task: AgentTask,
    steps: ExecutionPlan['steps'],
    executionContext: NonNullable<ReturnType<ContextManager['getContext']>>,
  ): Promise<string> {
    if (task.type !== 'query') {
      return this.generateOutput(steps);
    }

    try {
      return await this.generateQueryAnswer(task, executionContext, steps);
    } catch (error) {
      if (this.config.debug) {
        console.warn('[Agent] Failed to synthesize query answer:', error);
      }
      return this.generateOutput(steps);
    }
  }

  private async generateQueryAnswer(
    task: AgentTask,
    executionContext: NonNullable<ReturnType<ContextManager['getContext']>>,
    steps: ExecutionPlan['steps'],
  ): Promise<string> {
    const ragMatches = executionContext.collectedContext.ragMatches ?? [];
    const ragWarnings = executionContext.collectedContext.ragWarnings ?? [];
    const files = Array.from(executionContext.collectedContext.files.entries());

    const searchEvidence = steps
      .filter((step) => step.action === 'search_code' && step.result?.success)
      .flatMap((step) => {
        const output = step.result?.output as {
          matches?: Array<{ file: string; line: number; content: string }>;
        } | undefined;
        return (output?.matches ?? []).slice(0, 5).map((match) =>
          `${match.file}:${match.line} ${match.content}`
        );
      })
      .slice(0, 10);

    const evidenceParts: string[] = [];

    if (ragMatches.length > 0) {
      evidenceParts.push('## 知识库检索结果');
      for (const match of ragMatches.slice(0, 5)) {
        const location = match.path ? ` path=${match.path}` : '';
        evidenceParts.push(
          `- ${match.title}${location} source=${match.sourceUrl}\n${truncateForPrompt(match.snippet, 320)}`
        );
      }
    }

    if (searchEvidence.length > 0) {
      evidenceParts.push('\n## 代码搜索命中');
      for (const item of searchEvidence) {
        evidenceParts.push(`- ${item}`);
      }
    }

    if (files.length > 0) {
      evidenceParts.push('\n## 已读取文件');
      let remainingBudget = 16000;
      for (const [path, content] of files) {
        if (remainingBudget <= 0) {
          break;
        }
        const snippet = truncateForPrompt(content, Math.min(remainingBudget, 5000));
        remainingBudget -= snippet.length;
        evidenceParts.push(`\n### ${path}\n${snippet}`);
      }
    }

    if (evidenceParts.length === 0) {
      return this.generateOutput(steps);
    }

    const warningText = ragWarnings.length > 0
      ? `\n已知检索告警：\n${ragWarnings.map((warning) => `- ${warning}`).join('\n')}\n`
      : '';

    return this.llmService.generateText({
      system: `你是 FrontAgent 的查询问答总结器。
你必须基于提供的证据直接回答用户问题，而不是汇报执行步骤。
术语要求：
1. 远程 RAG 命中的资料统一称为“知识库”或“知识库条目”。
2. 只有当前工作区里实际读取到的本地文件，才称为“当前工作区文件”或“本地文件”。
3. 不要把知识库条目说成“当前仓库里的文件”或“仓库里的实现”。
回答要求：
1. 先直接给出结论。
2. 用简洁语言解释原理。
3. 如果引用到知识库证据，尽量点出文件路径或知识库条目。
4. 如果引用到当前工作区证据，明确说它来自当前工作区文件。
5. 如果证据不足，明确说明不确定点。
6. 不要编造未出现在证据里的细节。${warningText}`,
      messages: [
        {
          role: 'user',
          content: `用户问题：${task.description}\n\n以下是可用证据：\n${evidenceParts.join('\n')}`,
        },
      ],
      temperature: 0.2,
      maxTokens: 1800,
    });
  }

  /**
   * 检查代码中使用但未在 package.json 中声明的 npm 依赖
   * 需要从执行上下文中传入 collectedContext
   */
  private async checkMissingNpmDependencies(
    collectedFiles: Map<string, string> = new Map()
  ): Promise<string[]> {
    // 读取 package.json
    const packageJsonPath = 'package.json';
    let packageJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } = {};

    const packageJsonContent = collectedFiles.get(packageJsonPath);
    if (packageJsonContent) {
      try {
        packageJson = JSON.parse(packageJsonContent);
      } catch (error) {
        console.warn('[Agent] Failed to parse package.json:', error);
      }
    }

    const declaredDeps = new Set([
      ...Object.keys(packageJson.dependencies || {}),
      ...Object.keys(packageJson.devDependencies || {})
    ]);

    // 分析所有 JS/TS 文件，提取 import 语句中的外部依赖
    const usedDeps = new Set<string>();
    const importRegex = /^import\s+.*?\s+from\s+['"]([^'"]+)['"]/gm;
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

    for (const [filePath, content] of collectedFiles.entries()) {
      if (!/\.(tsx?|jsx?|mjs|cjs)$/.test(filePath)) continue;

      // 提取 import 语句
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];
        // 只关注外部依赖（非相对路径）
        if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
          // 提取包名（处理 @scope/package 和 package/subpath）
          const pkgName = importPath.startsWith('@')
            ? importPath.split('/').slice(0, 2).join('/')
            : importPath.split('/')[0];
          usedDeps.add(pkgName);
        }
      }

      // 提取 require 语句
      while ((match = requireRegex.exec(content)) !== null) {
        const requirePath = match[1];
        if (!requirePath.startsWith('.') && !requirePath.startsWith('/')) {
          const pkgName = requirePath.startsWith('@')
            ? requirePath.split('/').slice(0, 2).join('/')
            : requirePath.split('/')[0];
          usedDeps.add(pkgName);
        }
      }
    }

    // 找出缺失的依赖
    const missingDeps: string[] = [];
    for (const dep of usedDeps) {
      if (!declaredDeps.has(dep)) {
        missingDeps.push(dep);
      }
    }

    return missingDeps;
  }

  /**
   * 运行 TypeScript 类型检查并解析错误为结构化数据
   */
  private async runTypeCheck(workingDir: string): Promise<Array<{ file: string; line: number; column: number; message: string; code: string }>> {
    try {
      // 执行 tsc --noEmit 获取类型错误
      const result = await this.executor['callTool']('run_command', {
        command: 'npx tsc --noEmit 2>&1',
        cwd: workingDir
      }) as { success: boolean; output: string; error?: string };

      const output = result.output || result.error || '';

      // 解析 TypeScript 错误输出
      // 格式：src/App.tsx(10,5): error TS2304: Cannot find name 'Foo'.
      const errorRegex = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/gm;
      const errors: Array<{ file: string; line: number; column: number; message: string; code: string }> = [];

      let match;
      while ((match = errorRegex.exec(output)) !== null) {
        errors.push({
          file: match[1],
          line: parseInt(match[2], 10),
          column: parseInt(match[3], 10),
          code: match[4],
          message: match[5]
        });
      }

      return errors;
    } catch (error) {
      console.warn('[Agent] TypeScript check failed:', error);
      return [];
    }
  }

  /**
   * 判断是否需要执行阶段完成检查
   */
  private shouldRunPhaseChecks(phase: string): boolean {
    const normalized = phase.toLowerCase();
    return (
      phase.includes('创建') ||
      phase.includes('实现') ||
      phase === '未分组' ||
      normalized.includes('create') ||
      normalized.includes('implement')
    );
  }

  /**
   * 收集某阶段生成/修改过的代码文件
   */
  private collectGeneratedCodeFilesForPhase(phase: string, steps: ExecutionStep[]): string[] {
    const maxFiles = this.config.subAgents?.codeQualityEvaluator?.maxFilesPerPhase ?? 20;
    const codeFileRegex = /\.(tsx?|jsx?|mjs|cjs)$/;
    const paths = new Set<string>();

    for (const step of steps) {
      const stepPhase = step.phase || '未分组';
      if (stepPhase !== phase) continue;
      if (step.status !== 'completed') continue;
      if (step.action !== 'create_file' && step.action !== 'apply_patch') continue;

      const path = step.params.path;
      if (typeof path !== 'string') continue;
      if (!codeFileRegex.test(path)) continue;

      paths.add(path);
      if (paths.size >= maxFiles) break;
    }

    return Array.from(paths);
  }

  /**
   * 读取待评估文件内容（优先读取最新磁盘内容，失败时回退到上下文缓存）
   */
  private async readFilesForCodeQualityReview(
    filePaths: string[],
    collectedFiles: Map<string, string>
  ): Promise<CodeQualityReviewFile[]> {
    const files: CodeQualityReviewFile[] = [];

    for (const path of filePaths) {
      try {
        const readResult = await this.executor['callTool']('read_file', { path }) as {
          success: boolean;
          content?: string;
        };

        if (readResult.success && typeof readResult.content === 'string') {
          collectedFiles.set(path, readResult.content);
          files.push({ path, content: readResult.content });
          continue;
        }
      } catch (error) {
        if (this.config.debug) {
          console.warn(`[Agent] Failed to read file for code quality review: ${path}`, error);
        }
      }

      const fallbackContent = collectedFiles.get(path);
      if (fallbackContent !== undefined) {
        files.push({ path, content: fallbackContent });
      }
    }

    return files;
  }

  /**
   * 通过 A2A 调用 CodeQualitySubAgent 评估代码质量
   */
  private async evaluateGeneratedCodeQualityViaSubAgent(
    taskId: string,
    phase: string,
    steps: ExecutionStep[],
    collectedFiles: Map<string, string>
  ): Promise<CodeQualityIssue[]> {
    if (!this.codeQualitySubAgent || !this.a2aBus.hasAgent(this.codeQualitySubAgent.agentId)) {
      return [];
    }

    const filePaths = this.collectGeneratedCodeFilesForPhase(phase, steps);
    if (filePaths.length === 0) {
      return [];
    }

    const reviewFiles = await this.readFilesForCodeQualityReview(filePaths, collectedFiles);
    if (reviewFiles.length === 0) {
      return [];
    }

    const request: CodeQualityReviewRequest = {
      taskId,
      phase,
      files: reviewFiles,
      sddConfig: this.sddConfig,
      sharedFacts: this.contextManager.exportFactsSnapshot(taskId),
    };

    const response = await this.a2aBus.request<CodeQualityReviewRequest, CodeQualityReviewResponse>({
      from: 'frontagent.main',
      to: this.codeQualitySubAgent.agentId,
      intent: 'code_quality.review_generated_files',
      payload: request
    });

    if (!response.success || !response.payload) {
      console.warn(`[Agent] CodeQualitySubAgent request failed: ${response.error ?? 'Unknown error'}`);
      return [];
    }

    if (response.payload.factUpdates) {
      await this.enqueueFactsUpdate(taskId, response.payload.factUpdates);
    }

    if (this.config.debug) {
      console.log(`[Agent] ${response.payload.summary}`);
    }

    return response.payload.issues;
  }

  /**
   * 将子 Agent 返回的事实更新包排队，并串行合并到主事实库
   */
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
          if (this.config.debug) {
            const staleText = mergeResult.staleBaseRevision ? ' (stale base revision, rebased in main reducer)' : '';
            console.log(
              `[Agent] Merged facts update from ${mergeResult.source}: ` +
              `r${mergeResult.previousRevision} -> r${mergeResult.nextRevision}${staleText}`
            );
          }
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

  /**
   * 检测项目开发服务器端口
   * 从 vite.config.ts, package.json scripts, 或使用默认值
   */
  private async detectDevServerPort(collectedFiles: Map<string, string>): Promise<number> {
    // 1. 检查 vite.config.ts/js
    for (const [filePath, content] of collectedFiles) {
      if (filePath.includes('vite.config')) {
        // 匹配 server: { port: 3000 } 或 server: { port: Number }
        const portMatch = content.match(/server\s*:\s*\{[^}]*port\s*:\s*(\d+)/);
        if (portMatch) {
          console.log(`[Agent] 🔍 Detected port ${portMatch[1]} from ${filePath}`);
          return parseInt(portMatch[1], 10);
        }
      }
    }

    // 2. 检查 package.json scripts
    const packageJson = collectedFiles.get('package.json');
    if (packageJson) {
      try {
        const pkg = JSON.parse(packageJson);
        const devScript = pkg.scripts?.dev || pkg.scripts?.start || '';

        // 匹配 --port 3000 或 -p 3000
        const portMatch = devScript.match(/(?:--port|-p)\s+(\d+)/);
        if (portMatch) {
          console.log(`[Agent] 🔍 Detected port ${portMatch[1]} from package.json scripts`);
          return parseInt(portMatch[1], 10);
        }

        // 检查是否使用特定框架（根据依赖推断默认端口）
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps['vite']) {
          console.log(`[Agent] 🔍 Detected Vite project, using default port 5173`);
          return 5173;  // Vite 默认
        }
        if (deps['next']) {
          console.log(`[Agent] 🔍 Detected Next.js project, using default port 3000`);
          return 3000;  // Next.js 默认
        }
        if (deps['react-scripts']) {
          console.log(`[Agent] 🔍 Detected CRA project, using default port 3000`);
          return 3000;  // Create React App 默认
        }
        if (deps['@angular/cli']) {
          console.log(`[Agent] 🔍 Detected Angular project, using default port 4200`);
          return 4200;  // Angular 默认
        }
        if (deps['vue']) {
          console.log(`[Agent] 🔍 Detected Vue project, using default port 5173`);
          return 5173;  // Vue CLI 默认
        }
      } catch (error) {
        console.warn('[Agent] Failed to parse package.json for port detection:', error);
      }
    }

    // 3. 默认使用 5173（Vite 默认）
    console.log(`[Agent] 🔍 Using fallback port 5173`);
    return 5173;
  }

  private async retrieveRagContext(taskId: string, query: string): Promise<RetrievedRagContext | undefined> {
    if (this.config.rag?.enabled === false) {
      return undefined;
    }

    try {
      const rewrittenQuery = await this.rewriteRagQueryForRetrieval(query);
      const retrievalQuery = rewrittenQuery
        ? mergeRetrievalQuery(query, rewrittenQuery)
        : normalizeSearchQuery(query);

      if (this.config.debug && rewrittenQuery) {
        console.log('[Agent] RAG query rewrite applied:', {
          originalQuery: query,
          rewrittenQuery,
          retrievalQuery,
        });
      }

      const result = await this.executor['callTool']('rag_query', {
        query: retrievalQuery,
        maxResults: this.config.rag?.maxResults ?? 5,
      }) as {
        success?: boolean;
        searchMode?: 'hybrid' | 'keyword_only';
        reranked?: boolean;
        warnings?: string[];
        results?: Array<{
          type: string;
          title: string;
          sourceUrl: string;
          snippet: string;
          path?: string;
          score?: number;
          rerankScore?: number;
        }>;
      };

      if (!result.success) {
        return undefined;
      }

      const matches = (result.results ?? []).map((item) => ({
        type: item.type,
        title: item.title,
        sourceUrl: item.sourceUrl,
        snippet: item.snippet,
        path: item.path,
        score: item.score,
        rerankScore: item.rerankScore,
      }));
      const formattedResults = matches.map((item) => this.formatRagResult(item));
      if (formattedResults.length > 0) {
        this.contextManager.addRagResults(taskId, formattedResults);
      }
      this.contextManager.setRagMetadata(taskId, {
        matches,
        searchMode: result.searchMode,
        warnings: result.warnings,
      });
      return {
        formattedResults,
        matches,
        searchMode: result.searchMode,
        reranked: result.reranked,
        warnings: result.warnings,
      };
    } catch (error) {
      if (this.config.debug) {
        console.warn('[Agent] Failed to retrieve RAG context:', error);
      }
      return undefined;
    }
  }

  private async rewriteRagQueryForRetrieval(query: string): Promise<string | undefined> {
    if (this.config.rag?.queryRewrite?.enabled === false) {
      return undefined;
    }

    const normalizedQuery = normalizeSearchQuery(query);
    if (!normalizedQuery) {
      return undefined;
    }

    try {
      const rewritten = await this.llmService.generateObject({
        system: `你是前端领域知识库的检索查询优化器。
你的任务不是回答问题，而是把用户原始需求改写成更适合知识库检索的专业查询。
要求：
1. 保留用户原始意图和核心词，不要改变需求。
2. 如果用户说法口语化、不专业或过于模糊，补充前端领域常用术语、英文关键词、同义词和相关实现概念。
3. 如果问题涉及具体框架或技术方向，补充可能的专业表达，例如 React、Vue、DOM、CSS、表单控件、listbox、combobox、dropdown 等。
4. 只输出一个用于检索的查询字符串，不要输出解释、前缀、编号或 Markdown。`,
        messages: [
          {
            role: 'user',
            content: `请把下面的用户需求改写为适合前端知识库检索的查询：\n${normalizedQuery}`,
          },
        ],
        schema: ragQueryRewriteSchema,
        maxTokens: this.config.rag?.queryRewrite?.maxTokens ?? 160,
        temperature: this.config.rag?.queryRewrite?.temperature ?? 0.1,
      });

      const rewrittenQuery = normalizeSearchQuery(rewritten.searchQuery);
      if (!rewrittenQuery || rewrittenQuery === normalizedQuery) {
        return undefined;
      }

      return rewrittenQuery;
    } catch (error) {
      if (this.config.debug) {
        console.warn('[Agent] Failed to rewrite RAG query, falling back to original query:', error);
      }
      return undefined;
    }
  }

  private formatRagResult(result: {
    type: string;
    title: string;
    sourceUrl: string;
    snippet: string;
    path?: string;
  }): string {
    const location = result.path ? ` path=${result.path}` : '';
    return `[${result.type}] ${result.title}${location} source=${result.sourceUrl}\n${result.snippet}`;
  }

  /**
   * 获取 SDD 配置
   */
  getSDDConfig(): SDDConfig | undefined {
    return this.sddConfig;
  }

  /**
   * 更新 SDD 配置
   */
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

  /**
   * 生成 SDD 约束提示词
   */
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
