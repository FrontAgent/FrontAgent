/**
 * Agent 主类
 * 负责整体编排
 */

import type { AgentTask, ExecutionPlan, ExecutionStep, SDDConfig, ValidationResult } from '@frontagent/shared';
import { generateId } from '@frontagent/shared';
import { SDDParser, SDDPromptGenerator } from '@frontagent/sdd';
import { HallucinationGuard } from '@frontagent/hallucination-guard';
import { ContextManager } from './context.js';
import { Planner } from './planner.js';
import { Executor, type MCPClient } from './executor.js';
import { LLMService } from './llm.js';
import type {
  AgentConfig,
  AgentExecutionResult,
  AgentEvent,
  AgentEventListener
} from './types.js';

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

    // 初始化 Executor（两阶段架构 - 传递 llmService）
    this.executor = new Executor({
      hallucinationGuard: this.hallucinationGuard,
      llmService: this.llmService,
      debug: config.debug
    });
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
      'navigate',
      'get_page_structure',
      'get_accessibility_tree',
      'get_interactive_elements',
      'click',
      'type',
      'scroll',
      'screenshot',
      'wait_for_selector',
      'evaluate',
      'close_browser'
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

    // 创建任务
    const task: AgentTask = {
      id: generateId('task'),
      type: options?.type ?? 'query',
      description: taskDescription,
      context: {
        workingDirectory: this.config.projectRoot,
        relevantFiles: options?.relevantFiles,
        browserUrl: options?.browserUrl
      }
    };

    this.emit({ type: 'task_started', task });

    try {
      // 创建上下文
      const context = this.contextManager.createContext(task, this.sddConfig);

      // 添加 SDD 约束到系统提示
      if (this.promptGenerator) {
        const sddPrompt = this.promptGenerator.generate();
        this.contextManager.addMessage(task.id, {
          role: 'system',
          content: sddPrompt
        });
      }

      // 规划阶段
      this.emit({ type: 'planning_started' });
      
      const planResult = await this.planner.plan(
        task,
        {
          files: context.collectedContext.files,
          pageStructure: context.collectedContext.pageStructure
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
            pageStructure: context.collectedContext.pageStructure
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

      this.contextManager.setPlan(task.id, planResult.plan);
      this.emit({ type: 'planning_completed', plan: planResult.plan });

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
        planResult.plan.steps,
        {
          task,
          collectedContext: { files: executionContext.collectedContext.files },
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

          // 在创建阶段结束后进行多项检查
          if (phase.includes('创建') || phase.includes('实现') || phase === '未分组') {
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
          }

          return errors;
        }
      );

      // 检查是否有失败的步骤
      const failedSteps = planResult.plan.steps.filter(s => s.status === 'failed');
      const success = failedSteps.length === 0;

      const result: AgentExecutionResult = {
        success,
        taskId: task.id,
        executedSteps: planResult.plan.steps,
        output: success ? this.generateOutput(planResult.plan.steps) : undefined,
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
            await this.executor['callTool']('navigate', { url });
            const result = await this.executor['callTool']('get_page_structure', {});
            this.contextManager.setPageStructure(taskId, result);
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

