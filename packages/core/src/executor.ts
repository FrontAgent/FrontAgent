/**
 * Agent Executor（两阶段架构 - Stage 2）
 * 负责执行计划中的步骤，并在需要时动态生成代码
 */

import type { ExecutionStep, StepResult, ValidationResult, AgentTask } from '@frontagent/shared';
import { HallucinationGuard } from '@frontagent/hallucination-guard';
import { Annotation, END, MemorySaver, START, StateGraph } from '@langchain/langgraph';
import type { ExecutorOutput } from './types.js';
import { LLMService } from './llm.js';
import {
  createDefaultExecutorSkillRegistry,
  type ExecutorActionSkill,
  type ExecutorSkillsLayerSnapshot,
} from './skills/index.js';

/**
 * MCP 客户端接口
 */
export interface MCPClient {
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  listTools(): Promise<Array<{ name: string; description: string }>>;
}

/**
 * Executor 配置
 */
export interface ExecutorConfig {
  /** 幻觉防控器 */
  hallucinationGuard: HallucinationGuard;
  /** LLM 服务（用于动态代码生成） */
  llmService: LLMService;
  /** 调试模式 */
  debug?: boolean;
  /** 获取已创建模块列表的回调（用于防止路径幻觉） */
  getCreatedModules?: () => string[];
  /** 获取 SDD 约束的回调（用于代码生成时遵守 SDD 规范） */
  getSddConstraints?: () => string | undefined;
  /** 获取文件系统事实的回调（用于验证文件是否存在） */
  getFileSystemFacts?: () => {
    existingFiles: Set<string>;
    nonExistentPaths: Set<string>;
    directoryContents: Map<string, string[]>;
  } | undefined;
  /** 执行流引擎（默认 native） */
  executionEngine?: 'native' | 'langgraph';
  /** LangGraph 相关配置 */
  langGraph?: {
    enabled?: boolean;
    useCheckpoint?: boolean;
    maxRecoveryAttempts?: number;
    threadIdPrefix?: string;
  };
}

interface PhaseExecutionGroup {
  phase: string;
  steps: ExecutionStep[];
  dependencies: Set<string>;
  firstSeenIndex: number;
  priority: number;
}

interface SerializablePhaseExecutionGroup {
  phase: string;
  steps: ExecutionStep[];
  dependencies: string[];
  firstSeenIndex: number;
  priority: number;
}

interface LangGraphRuntimeState {
  phaseGroups: SerializablePhaseExecutionGroup[];
  phaseIndex: number;
  completedStepIds: string[];
  allResults: ExecutorOutput[];
}

/**
 * Executor 类
 */
export class Executor {
  private config: ExecutorConfig;
  private mcpClients: Map<string, MCPClient> = new Map();
  private toolToClient: Map<string, string> = new Map();
  private actionSkills: ReturnType<typeof createDefaultExecutorSkillRegistry>;

  constructor(config: ExecutorConfig) {
    this.config = config;
    this.actionSkills = createDefaultExecutorSkillRegistry({
      llmService: this.config.llmService,
      debug: this.config.debug,
      getCreatedModules: this.config.getCreatedModules,
      getSddConstraints: this.config.getSddConstraints,
      buildContextString: (collectedContext) => this.buildContextString(collectedContext),
      detectLanguage: (path) => this.detectLanguage(path),
    });
  }

  /**
   * 注册 MCP 客户端
   */
  registerMCPClient(name: string, client: MCPClient): void {
    this.mcpClients.set(name, client);
  }

  /**
   * 注册工具到客户端的映射
   */
  registerToolMapping(toolName: string, clientName: string): void {
    this.toolToClient.set(toolName, clientName);
  }

  /**
   * 注册步骤 action skill
   */
  registerActionSkill(skill: ExecutorActionSkill): void {
    this.actionSkills.registerActionSkill(skill);
  }

  /**
   * 获取 Executor skills 层快照
   */
  getActionSkillSnapshot(): ExecutorSkillsLayerSnapshot {
    return this.actionSkills.snapshot();
  }

  /**
   * 执行单个步骤（Stage 2: 支持动态代码生成）
   */
  async executeStep(
    step: ExecutionStep,
    context: {
      task: AgentTask;
      collectedContext: { files: Map<string, string>; ragResults?: string[] };
    }
  ): Promise<ExecutorOutput> {
    const startTime = Date.now();

    try {
      // 0. 参数有效性检查（检查关键参数是否为空）
      const paramValidation = this.validateStepParams(step);
      if (!paramValidation.valid) {
        if (this.config.debug) {
          console.log(`[Executor] Skipping step due to invalid params: ${paramValidation.reason}`);
        }
        return {
          stepResult: {
            success: true,
            output: { skipped: true, reason: paramValidation.reason },
            duration: Date.now() - startTime
          },
          validation: { pass: true, results: [] },
          needsRollback: false
        };
      }

      // 1. 执行前验证
      const preValidation = await this.validateBeforeExecution(step, context);
      if (!preValidation.pass) {
        // 检查是否是可以跳过的错误
        const errorMsg = preValidation.blockedBy?.join('; ') || '';
        const isDirectoryError = errorMsg.includes('is not a file') || errorMsg.includes('Not a file');
        const isFileNotExist = errorMsg.includes('does not exist') && step.action === 'read_file';

        if (isDirectoryError || isFileNotExist) {
          // 跳过这个步骤而不是失败
          // - 对于 read_file 读取不存在的文件：让工具返回"文件不存在"而不是阻止
          // - 对于尝试读取目录：直接跳过
          if (this.config.debug) {
            console.log(`[Executor] Skipping step due to validation: ${errorMsg}`);
          }
          return {
            stepResult: {
              success: true, // 标记为成功，这样不会阻塞后续步骤
              output: { skipped: true, reason: errorMsg, exists: false },
              duration: Date.now() - startTime
            },
            validation: { pass: true, results: [] },
            needsRollback: false
          };
        }

        // 其他验证失败仍然返回错误
        return {
          stepResult: {
            success: false,
            error: `Pre-execution validation failed: ${errorMsg}`,
            duration: Date.now() - startTime
          },
          validation: preValidation,
          needsRollback: false
        };
      }

      // 2. 通过 action skills 生成/调整工具参数（含动态代码生成）
      let toolParams = { ...step.params };

      if (this.config.debug) {
        const stepAny = step as { needsCodeGeneration?: boolean };
        console.log(
          `[Executor] Step action: ${step.action}, needsCodeGeneration: ${Boolean(stepAny.needsCodeGeneration)}`,
        );
        console.log(`[Executor] Step params:`, toolParams);
      }

      toolParams = await this.actionSkills.prepareToolParams({
        step,
        params: toolParams,
        context,
      });

      // 3. 调用 MCP 工具
      const toolResult = await this.callTool(step.tool, toolParams);

      // 3.5. 检查工具执行结果是否是可跳过的错误
      if (typeof toolResult === 'object' && toolResult !== null) {
        const resultObj = toolResult as { success?: boolean; error?: string };
        if (resultObj.success === false && resultObj.error) {
          const errorMsg = resultObj.error;
          // 检查是否是可跳过的错误类型
          const isSkippableError = this.isSkippableError(errorMsg, step, toolParams);

          if (isSkippableError) {
            if (this.config.debug) {
              console.log(`[Executor] Skipping step due to tool error: ${errorMsg}`);
            }
            return {
              stepResult: {
                success: true, // 标记为成功，不阻塞后续步骤
                output: { skipped: true, reason: errorMsg },
                duration: Date.now() - startTime
              },
              validation: { pass: true, results: [] },
              needsRollback: false
            };
          }
        }
      }

      // 4. 执行后验证
      const postValidation = await this.validateAfterExecution(step, toolResult);

      // 5. 构建结果
      const stepResult: StepResult = {
        success: postValidation.pass,
        output: toolResult,
        error: postValidation.pass ? undefined : postValidation.blockedBy?.join('; '),
        duration: Date.now() - startTime,
        snapshotId: (toolResult as { snapshotId?: string })?.snapshotId
      };

      return {
        stepResult,
        validation: postValidation,
        needsRollback: !postValidation.pass && step.validation.some(v => v.required)
      };
    } catch (error) {
      return {
        stepResult: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime
        },
        validation: {
          pass: false,
          results: [],
          blockedBy: [error instanceof Error ? error.message : String(error)]
        },
        needsRollback: true
      };
    }
  }

  /**
   * 验证步骤参数的有效性
   */
  private validateStepParams(step: ExecutionStep): { valid: boolean; reason?: string } {
    const params = step.params as Record<string, unknown>;
    const customValidation = this.actionSkills.validateStepParams(step, params);
    if (customValidation && !customValidation.valid) {
      return customValidation;
    }

    const requiredParams = this.actionSkills.resolveRequiredParams(step.action);

    for (const paramName of requiredParams) {
      const value = params[paramName];
      const missing =
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim() === '');

      if (missing) {
        return {
          valid: false,
          reason: `${step.action} requires non-empty ${paramName} parameter`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * 判断错误是否可以跳过（不中断整个任务）
   */
  private isSkippableError(
    errorMsg: string,
    step: ExecutionStep,
    params?: Record<string, unknown>,
  ): boolean {
    const skillDecision = this.actionSkills.shouldSkipToolError({
      errorMsg,
      step,
      params: params ?? {},
    });
    if (typeof skillDecision === 'boolean') {
      return skillDecision;
    }

    // 尝试读取目录而不是文件的错误
    if (errorMsg.includes('Not a directory') ||
        errorMsg.includes('is not a file') ||
        errorMsg.includes('Not a file')) {
      return true;
    }

    return false;
  }

  /**
   * 构建上下文字符串
   */
  private buildContextString(
    collectedContext: { files: Map<string, string>; ragResults?: string[] }
  ): string {
    const parts: string[] = [];

    if (collectedContext.files.size > 0) {
      parts.push('相关文件:');
      for (const [path, content] of collectedContext.files) {
        const truncatedContent = content.length > 1000
          ? content.substring(0, 1000) + '\n... (内容已截断)'
          : content;
        parts.push(`\n--- ${path} ---\n${truncatedContent}`);
      }
    }

    if (collectedContext.ragResults && collectedContext.ragResults.length > 0) {
      parts.push('\n知识库参考:');
      for (const result of collectedContext.ragResults) {
        parts.push(`- ${result}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * 执行前验证
   */
  private async validateBeforeExecution(
    step: ExecutionStep,
    context: { task: AgentTask; collectedContext: { files: Map<string, string>; ragResults?: string[] } }
  ): Promise<ValidationResult> {
    const results: ValidationResult['results'] = [];

    // 🔧 修复问题1：使用文件系统事实来验证 apply_patch 操作
    if (step.action === 'apply_patch' && step.params.path) {
      const path = step.params.path as string;
      const facts = this.config.getFileSystemFacts?.();

      // 如果我们已经知道这个文件不存在（通过之前的 list_directory 或 read_file）
      if (facts?.nonExistentPaths.has(path)) {
        if (this.config.debug) {
          console.log(`[Executor] ⚠️  File ${path} is known to not exist. Suggest using create_file instead.`);
        }
        return {
          pass: false,
          results: [{
            pass: false,
            type: 'file_not_found',
            severity: 'block',
            message: `Cannot apply patch: file ${path} does not exist (confirmed by previous directory listing). Please use create_file instead.`
          }],
          blockedBy: [`File ${path} does not exist. Use create_file instead of apply_patch.`]
        };
      }

      // 🔧 优化：如果文件不在上下文中，自动读取文件（类似 vscode-copilot-chat 的 openFn 机制）
      if (!context.collectedContext.files.has(path)) {
        console.log(`[Executor] 📖 File ${path} not in context, auto-reading before apply_patch...`);

        try {
          // 自动调用 read_file 工具读取文件
          const readResult = await this.callTool('read_file', { path }) as { success: boolean; content?: string; error?: string };

          if (readResult.success && readResult.content !== undefined) {
            // 将文件内容添加到上下文
            context.collectedContext.files.set(path, readResult.content);
            console.log(`[Executor] ✅ Auto-read file ${path} (${readResult.content.length} chars) into context`);
          } else {
            // 读取失败，返回错误
            const errorMsg = readResult.error || 'Failed to read file';
            if (this.config.debug) {
              console.log(`[Executor] ❌ Auto-read failed: ${errorMsg}`);
            }
            return {
              pass: false,
              results: [{
                pass: false,
                type: 'file_read_failed',
                severity: 'block',
                message: `Cannot apply patch: failed to auto-read file ${path}. Error: ${errorMsg}`
              }],
              blockedBy: [`Failed to auto-read file ${path}: ${errorMsg}`]
            };
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.log(`[Executor] ❌ Auto-read exception: ${errorMsg}`);
          return {
            pass: false,
            results: [{
              pass: false,
              type: 'file_read_error',
              severity: 'block',
              message: `Cannot apply patch: error reading file ${path}. Error: ${errorMsg}`
            }],
            blockedBy: [`Error auto-reading file ${path}: ${errorMsg}`]
          };
        }
      }
    }

    // 对于读取文件操作，验证文件存在
    if (step.action === 'read_file' && step.params.path) {
      const fileCheck = await this.config.hallucinationGuard.validateFilePath(
        step.params.path as string,
        true
      );
      results.push(fileCheck);
    }

    // 对于创建文件操作，验证文件不存在
    if (step.action === 'create_file' && step.params.path && !step.params.overwrite) {
      const fileCheck = await this.config.hallucinationGuard.validateFilePath(
        step.params.path as string,
        false
      );
      results.push(fileCheck);
    }

    const blockedBy = results
      .filter(r => !r.pass && r.severity === 'block')
      .map(r => r.message ?? r.type);

    return {
      pass: blockedBy.length === 0,
      results,
      blockedBy: blockedBy.length > 0 ? blockedBy : undefined
    };
  }

  /**
   * 执行后验证
   */
  private async validateAfterExecution(
    step: ExecutionStep,
    result: unknown
  ): Promise<ValidationResult> {
    // 检查工具调用是否成功
    if (typeof result === 'object' && result !== null) {
      const resultObj = result as { success?: boolean; error?: string };
      if (resultObj.success === false) {
        return {
          pass: false,
          results: [],
          blockedBy: [resultObj.error ?? 'Tool execution failed']
        };
      }
    }

    // 对于代码修改操作，进行额外验证
    if (['apply_patch', 'create_file'].includes(step.action)) {
      const content = (result as { content?: string })?.content ?? 
                     step.params.content as string | undefined;
      const path = step.params.path as string;

      if (content && path) {
        const language = this.detectLanguage(path);
        if (language) {
          const codeValidation = await this.config.hallucinationGuard.validateCode(
            content,
            language,
            path
          );
          return codeValidation;
        }
      }
    }

    return {
      pass: true,
      results: []
    };
  }

  /**
   * 调用 MCP 工具
   */
  private async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const clientName = this.toolToClient.get(toolName);
    if (!clientName) {
      throw new Error(`No MCP client registered for tool: ${toolName}`);
    }

    const client = this.mcpClients.get(clientName);
    if (!client) {
      throw new Error(`MCP client not found: ${clientName}`);
    }

    if (this.config.debug) {
      console.log(`[Executor] Calling tool: ${toolName}`, args);
    }

    const result = await client.callTool(toolName, args);

    if (this.config.debug) {
      console.log(`[Executor] Tool result:`, result);
    }

    return result;
  }

  /**
   * 批量执行步骤（Stage 2: 支持动态代码生成）
   */
  async executeSteps(
    steps: ExecutionStep[],
    context: {
      task: AgentTask;
      collectedContext: { files: Map<string, string>; ragResults?: string[] };
    },
    onStepComplete?: (step: ExecutionStep, output: ExecutorOutput) => void
  ): Promise<ExecutorOutput[]> {
    const results: ExecutorOutput[] = [];
    const completedSteps = new Set<string>();

    // 按依赖顺序执行
    const pendingSteps = [...steps];

    while (pendingSteps.length > 0) {
      // 找到可以执行的步骤（依赖已完成）
      const executableIndex = pendingSteps.findIndex(step =>
        step.dependencies.every(dep => completedSteps.has(dep))
      );

      if (executableIndex === -1) {
        // 没有可执行的步骤，可能有循环依赖
        throw new Error('Circular dependency detected or missing dependency');
      }

      const step = pendingSteps.splice(executableIndex, 1)[0];
      step.status = 'running';

      const output = await this.executeStep(step, context);
      step.result = output.stepResult;
      step.status = output.stepResult.success ? 'completed' : 'failed';

      results.push(output);
      completedSteps.add(step.stepId);

      if (onStepComplete) {
        onStepComplete(step, output);
      }

      // 如果步骤失败且需要回滚，停止执行
      if (!output.stepResult.success && output.needsRollback) {
        // 标记剩余步骤为跳过
        for (const pending of pendingSteps) {
          pending.status = 'skipped';
        }
        break;
      }
    }

    return results;
  }

  /**
   * 基于步骤依赖构建阶段依赖图，并返回可执行顺序。
   * 先按依赖拓扑排序，无法排序时回退到优先级排序。
   */
  private buildOrderedPhaseGroups(steps: ExecutionStep[]): PhaseExecutionGroup[] {
    const phaseGroups = new Map<string, PhaseExecutionGroup>();
    const stepToPhase = new Map<string, string>();

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const phase = step.phase || '未分组';
      stepToPhase.set(step.stepId, phase);

      if (!phaseGroups.has(phase)) {
        phaseGroups.set(phase, {
          phase,
          steps: [],
          dependencies: new Set<string>(),
          firstSeenIndex: i,
          priority: this.getPhasePriority(phase)
        });
      }

      phaseGroups.get(phase)!.steps.push(step);
    }

    for (const step of steps) {
      const phase = step.phase || '未分组';
      const group = phaseGroups.get(phase);
      if (!group) continue;

      for (const dep of step.dependencies) {
        const depPhase = stepToPhase.get(dep);
        if (!depPhase || depPhase === phase) continue;
        group.dependencies.add(depPhase);
      }
    }

    return this.topologicalSortPhaseGroups(Array.from(phaseGroups.values()));
  }

  /**
   * 阶段拓扑排序（Kahn 算法），并保持稳定顺序。
   */
  private topologicalSortPhaseGroups(groups: PhaseExecutionGroup[]): PhaseExecutionGroup[] {
    if (groups.length <= 1) {
      return groups;
    }

    const groupMap = new Map(groups.map(group => [group.phase, group]));
    const indegree = new Map<string, number>();
    const outgoing = new Map<string, Set<string>>();

    for (const group of groups) {
      indegree.set(group.phase, 0);
      outgoing.set(group.phase, new Set<string>());
    }

    for (const group of groups) {
      for (const dep of group.dependencies) {
        if (!groupMap.has(dep)) continue;
        indegree.set(group.phase, (indegree.get(group.phase) ?? 0) + 1);
        outgoing.get(dep)!.add(group.phase);
      }
    }

    const ready = groups.filter(group => (indegree.get(group.phase) ?? 0) === 0);
    ready.sort((a, b) => this.comparePhaseGroup(a, b));

    const ordered: PhaseExecutionGroup[] = [];

    while (ready.length > 0) {
      const current = ready.shift()!;
      ordered.push(current);

      for (const nextPhase of outgoing.get(current.phase) ?? []) {
        const nextDegree = (indegree.get(nextPhase) ?? 0) - 1;
        indegree.set(nextPhase, nextDegree);

        if (nextDegree === 0) {
          const nextGroup = groupMap.get(nextPhase);
          if (nextGroup) {
            ready.push(nextGroup);
          }
        }
      }

      ready.sort((a, b) => this.comparePhaseGroup(a, b));
    }

    if (ordered.length !== groups.length) {
      console.warn('[Executor] Detected phase dependency cycle, fallback to priority ordering');
      return [...groups].sort((a, b) => this.comparePhaseGroup(a, b));
    }

    return ordered;
  }

  /**
   * 阶段排序比较器：先按语义优先级，再按首次出现顺序。
   */
  private comparePhaseGroup(a: PhaseExecutionGroup, b: PhaseExecutionGroup): number {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    if (a.firstSeenIndex !== b.firstSeenIndex) {
      return a.firstSeenIndex - b.firstSeenIndex;
    }
    return a.phase.localeCompare(b.phase);
  }

  /**
   * 阶段语义优先级（越小越先执行）。
   */
  private getPhasePriority(phase: string): number {
    const normalized = phase.toLowerCase();

    if (normalized.includes('分析') || normalized.includes('analy')) return 10;
    if (normalized.includes('创建') || normalized.includes('实现') || normalized.includes('create') || normalized.includes('implement')) return 20;
    if (normalized.includes('安装') || normalized.includes('install')) return 30;
    if (normalized.includes('验证') || normalized.includes('验收') || normalized.includes('valid') || normalized.includes('accept')) return 40;
    if (normalized.includes('启动') || normalized.includes('start') || normalized.includes('serve')) return 50;
    if (normalized.includes('浏览器') || normalized.includes('browser')) return 60;
    if (normalized.includes('仓库') || normalized.includes('repo') || normalized.includes('repository')) return 70;
    if (normalized.includes('未分组') || normalized.includes('ungroup')) return 90;

    return 80;
  }

  /**
   * 是否启用 LangGraph 执行流。
   */
  private shouldUseLangGraphEngine(): boolean {
    if (this.config.executionEngine === 'langgraph') {
      return true;
    }
    return this.config.langGraph?.enabled ?? false;
  }

  /**
   * 获取阶段恢复最大重试次数。
   */
  private getMaxRecoveryAttempts(): number {
    return this.config.langGraph?.maxRecoveryAttempts ?? 3;
  }

  /**
   * 执行单个阶段（包含阶段内错误恢复）。
   */
  private async executeSinglePhaseWithRecovery(
    phaseGroup: PhaseExecutionGroup,
    context: {
      task: AgentTask;
      collectedContext: { files: Map<string, string>; ragResults?: string[] };
    },
    completedStepIds: Set<string>,
    allResults: ExecutorOutput[],
    onStepComplete?: (step: ExecutionStep, output: ExecutorOutput) => void,
    onPhaseError?: (phase: string, errors: Array<{ step: ExecutionStep; error: string }>) => Promise<ExecutionStep[]>,
    onPhaseComplete?: (phase: string, results: ExecutorOutput[]) => Promise<Array<{ step: ExecutionStep; error: string }>>
  ): Promise<void> {
    const phase = phaseGroup.phase;
    const phaseSteps = phaseGroup.steps;

    console.log(`[Executor] ========================================`);
    console.log(`[Executor] Starting phase: ${phase} (${phaseSteps.length} steps)`);
    console.log(`[Executor] 🔗 Phase dependencies: [${Array.from(phaseGroup.dependencies).join(', ') || 'none'}]`);
    console.log(`[Executor] 📋 Steps in this phase:`);
    for (const s of phaseSteps) {
      console.log(`[Executor]    - ${s.stepId}: ${s.description} (deps: [${s.dependencies.join(', ') || 'none'}])`);
    }
    console.log(`[Executor] 📊 Already completed steps: [${Array.from(completedStepIds).join(', ') || 'none'}]`);
    console.log(`[Executor] ----------------------------------------`);

    const phaseResults: ExecutorOutput[] = [];
    let phaseErrors: Array<{ step: ExecutionStep; error: string }> = [];

    for (const step of phaseSteps) {
      const dependenciesMet = step.dependencies.every(dep => completedStepIds.has(dep));
      if (!dependenciesMet) {
        const missingDeps = step.dependencies.filter(dep => !completedStepIds.has(dep));
        console.warn(`[Executor] ⏭️  Skipping step ${step.stepId}: dependencies not met`);
        console.warn(`[Executor]    Step description: ${step.description}`);
        console.warn(`[Executor]    Required dependencies: [${step.dependencies.join(', ')}]`);
        console.warn(`[Executor]    Missing dependencies: [${missingDeps.join(', ')}]`);
        console.warn(`[Executor]    Completed steps: [${Array.from(completedStepIds).join(', ')}]`);
        step.status = 'skipped';
        continue;
      }

      step.status = 'running';
      const output = await this.executeStep(step, context);
      step.result = output.stepResult;
      step.status = output.stepResult.success ? 'completed' : 'failed';

      phaseResults.push(output);
      allResults.push(output);

      if (output.stepResult.success) {
        completedStepIds.add(step.stepId);
      } else {
        phaseErrors.push({
          step,
          error: output.stepResult.error || 'Unknown error'
        });
      }

      if (onStepComplete) {
        onStepComplete(step, output);
      }
    }

    if (onPhaseComplete) {
      try {
        const additionalErrors = await onPhaseComplete(phase, phaseResults);
        if (additionalErrors.length > 0) {
          console.log(`[Executor] Phase ${phase} validation found ${additionalErrors.length} additional issues`);
          phaseErrors.push(...additionalErrors);
        }
      } catch (error) {
        console.error(`[Executor] Phase complete validation failed:`, error);
      }
    }

    const maxRecoveryAttempts = this.getMaxRecoveryAttempts();
    let recoveryAttempt = 0;

    while (phaseErrors.length > 0 && onPhaseError && recoveryAttempt < maxRecoveryAttempts) {
      recoveryAttempt++;
      console.log(`[Executor] Phase ${phase} has ${phaseErrors.length} errors, recovery attempt ${recoveryAttempt}/${maxRecoveryAttempts}...`);

      try {
        const recoverySteps = await onPhaseError(phase, phaseErrors);
        if (recoverySteps.length === 0) {
          console.log(`[Executor] No recovery steps generated, stopping recovery attempts`);
          break;
        }

        console.log(`[Executor] Inserting ${recoverySteps.length} recovery steps for phase ${phase}`);

        for (const recoveryStep of recoverySteps) {
          recoveryStep.phase = phase;
          phaseSteps.push(recoveryStep);
        }

        const recoveryFailed = [];
        for (const recoveryStep of recoverySteps) {
          recoveryStep.status = 'running';
          const output = await this.executeStep(recoveryStep, context);
          recoveryStep.result = output.stepResult;
          recoveryStep.status = output.stepResult.success ? 'completed' : 'failed';

          allResults.push(output);

          if (output.stepResult.success) {
            completedStepIds.add(recoveryStep.stepId);
          } else {
            recoveryFailed.push({ step: recoveryStep, error: output.stepResult.error || 'Unknown error' });
          }

          if (onStepComplete) {
            onStepComplete(recoveryStep, output);
          }
        }

        if (onPhaseComplete) {
          console.log(`[Executor] Re-running phase completion checks after recovery attempt ${recoveryAttempt}...`);
          const previousPhaseErrors = phaseErrors;
          phaseErrors = [];

          try {
            const verificationErrors = await onPhaseComplete(phase, allResults);
            phaseErrors = verificationErrors;

            if (phaseErrors.length === 0) {
              console.log(`[Executor] ✅ Recovery successful! All errors fixed.`);

              for (const errorInfo of previousPhaseErrors) {
                if (errorInfo.step.status === 'failed') {
                  console.log(`[Executor] Marking step ${errorInfo.step.stepId} as completed (fixed by recovery)`);
                  console.log(`[Executor]    Step description: ${errorInfo.step.description}`);
                  errorInfo.step.status = 'completed';
                  completedStepIds.add(errorInfo.step.stepId);
                }
              }

              console.log(`[Executor] 📊 Completed steps after recovery: [${Array.from(completedStepIds).join(', ')}]`);

              const skippedSteps = phaseSteps.filter(s => s.status === 'skipped');
              if (skippedSteps.length > 0) {
                console.log(`[Executor] 🔄 Re-checking ${skippedSteps.length} skipped steps after recovery...`);

                for (const skippedStep of skippedSteps) {
                  const dependenciesMet = skippedStep.dependencies.every(dep => completedStepIds.has(dep));

                  if (dependenciesMet) {
                    console.log(`[Executor] 🔄 Re-executing previously skipped step: ${skippedStep.stepId}`);
                    console.log(`[Executor]    Step description: ${skippedStep.description}`);

                    skippedStep.status = 'running';
                    const output = await this.executeStep(skippedStep, context);
                    skippedStep.result = output.stepResult;
                    skippedStep.status = output.stepResult.success ? 'completed' : 'failed';

                    allResults.push(output);

                    if (output.stepResult.success) {
                      completedStepIds.add(skippedStep.stepId);
                      console.log(`[Executor] ✅ Re-executed step ${skippedStep.stepId} successfully`);
                    } else {
                      console.log(`[Executor] ❌ Re-executed step ${skippedStep.stepId} failed: ${output.stepResult.error}`);
                      phaseErrors.push({
                        step: skippedStep,
                        error: output.stepResult.error || 'Unknown error'
                      });
                    }

                    if (onStepComplete) {
                      onStepComplete(skippedStep, output);
                    }
                  } else {
                    const missingDeps = skippedStep.dependencies.filter(dep => !completedStepIds.has(dep));
                    console.log(`[Executor] ⏭️  Step ${skippedStep.stepId} still has missing deps: [${missingDeps.join(', ')}]`);
                  }
                }

                console.log(`[Executor] 📊 Completed steps after re-execution: [${Array.from(completedStepIds).join(', ')}]`);
              }

              if (phaseErrors.length === 0) {
                break;
              } else {
                console.log(`[Executor] ⚠️  ${phaseErrors.length} error(s) after re-execution, continuing recovery...`);
                continue;
              }
            } else {
              console.log(`[Executor] ⚠️  Still have ${phaseErrors.length} error(s) after recovery attempt ${recoveryAttempt}`);
              if (recoveryAttempt >= maxRecoveryAttempts) {
                console.warn(`[Executor] ❌ Max recovery attempts (${maxRecoveryAttempts}) reached. Stopping recovery.`);
              }
            }
          } catch (error) {
            console.error(`[Executor] Verification check failed:`, error);
            break;
          }
        } else {
          break;
        }
      } catch (error) {
        console.error(`[Executor] Failed to generate/execute recovery plan:`, error);
        break;
      }
    }

    const phaseStats = {
      total: phaseSteps.length,
      completed: phaseSteps.filter(s => s.status === 'completed').length,
      failed: phaseSteps.filter(s => s.status === 'failed').length,
      skipped: phaseSteps.filter(s => s.status === 'skipped').length,
    };
    console.log(`[Executor] ----------------------------------------`);
    console.log(`[Executor] Phase ${phase} completed`);
    console.log(`[Executor] 📊 Phase stats: ${phaseStats.completed}/${phaseStats.total} completed, ${phaseStats.failed} failed, ${phaseStats.skipped} skipped`);
    console.log(`[Executor] ========================================`);
  }

  /**
   * 使用 LangGraph 执行阶段流。
   */
  private async executeStepsWithErrorFeedbackViaLangGraph(
    steps: ExecutionStep[],
    context: {
      task: AgentTask;
      collectedContext: { files: Map<string, string>; ragResults?: string[] };
    },
    onStepComplete?: (step: ExecutionStep, output: ExecutorOutput) => void,
    onPhaseError?: (phase: string, errors: Array<{ step: ExecutionStep; error: string }>) => Promise<ExecutionStep[]>,
    onPhaseComplete?: (phase: string, results: ExecutorOutput[]) => Promise<Array<{ step: ExecutionStep; error: string }>>
  ): Promise<ExecutorOutput[]> {
    const orderedPhaseGroups = this.buildOrderedPhaseGroups(steps);
    const serializablePhaseGroups: SerializablePhaseExecutionGroup[] = orderedPhaseGroups.map(group => ({
      phase: group.phase,
      steps: group.steps,
      dependencies: Array.from(group.dependencies),
      firstSeenIndex: group.firstSeenIndex,
      priority: group.priority
    }));

    const RuntimeStateAnnotation = Annotation.Root({
      runtime: Annotation<LangGraphRuntimeState>({
        reducer: (_left, right) => right,
        default: () => ({
          phaseGroups: [],
          phaseIndex: 0,
          completedStepIds: [],
          allResults: []
        })
      })
    });

    const graph = new StateGraph(RuntimeStateAnnotation)
      .addNode('select_phase', () => ({}))
      .addNode('execute_phase', async (state) => {
        const runtime = state.runtime as LangGraphRuntimeState;
        if (runtime.phaseIndex >= runtime.phaseGroups.length) {
          return {};
        }

        const phaseGroupData = runtime.phaseGroups[runtime.phaseIndex];
        const phaseGroup: PhaseExecutionGroup = {
          ...phaseGroupData,
          dependencies: new Set(phaseGroupData.dependencies)
        };
        const completedStepIds = new Set(runtime.completedStepIds);
        const allResults = [...runtime.allResults];

        await this.executeSinglePhaseWithRecovery(
          phaseGroup,
          context,
          completedStepIds,
          allResults,
          onStepComplete,
          onPhaseError,
          onPhaseComplete
        );

        return {
          runtime: {
            ...runtime,
            completedStepIds: Array.from(completedStepIds),
            allResults
          }
        };
      })
      .addNode('advance_phase', (state) => {
        const runtime = state.runtime as LangGraphRuntimeState;
        return {
          runtime: {
            ...runtime,
            phaseIndex: runtime.phaseIndex + 1
          }
        };
      })
      .addEdge(START, 'select_phase')
      .addConditionalEdges('select_phase', (state) => {
        const runtime = state.runtime as LangGraphRuntimeState;
        return runtime.phaseIndex >= runtime.phaseGroups.length ? END : 'execute_phase';
      })
      .addEdge('execute_phase', 'advance_phase')
      .addEdge('advance_phase', 'select_phase')
      .compile({
        checkpointer: this.config.langGraph?.useCheckpoint ? new MemorySaver() : undefined,
        name: 'frontagent.phase.flow'
      });

    const initialState: LangGraphRuntimeState = {
      phaseGroups: serializablePhaseGroups,
      phaseIndex: 0,
      completedStepIds: [],
      allResults: []
    };

    const runnableConfig = this.config.langGraph?.useCheckpoint
      ? {
        configurable: {
          thread_id: `${this.config.langGraph?.threadIdPrefix ?? 'frontagent'}-${Date.now()}`
        }
      }
      : undefined;

    const finalState = await graph.invoke({ runtime: initialState }, runnableConfig as any) as {
      runtime?: LangGraphRuntimeState;
    };

    return finalState.runtime?.allResults ?? [];
  }

  /**
   * 按阶段执行步骤，支持错误反馈循环（Tool Error Feedback Loop）
   */
  async executeStepsWithErrorFeedback(
    steps: ExecutionStep[],
    context: {
      task: AgentTask;
      collectedContext: { files: Map<string, string>; ragResults?: string[] };
    },
    onStepComplete?: (step: ExecutionStep, output: ExecutorOutput) => void,
    onPhaseError?: (phase: string, errors: Array<{ step: ExecutionStep; error: string }>) => Promise<ExecutionStep[]>,
    onPhaseComplete?: (phase: string, results: ExecutorOutput[]) => Promise<Array<{ step: ExecutionStep; error: string }>>
  ): Promise<ExecutorOutput[]> {
    if (this.shouldUseLangGraphEngine()) {
      if (this.config.debug) {
        console.log('[Executor] Using LangGraph execution engine');
      }
      return this.executeStepsWithErrorFeedbackViaLangGraph(
        steps,
        context,
        onStepComplete,
        onPhaseError,
        onPhaseComplete
      );
    }

    const orderedPhaseGroups = this.buildOrderedPhaseGroups(steps);

    const allResults: ExecutorOutput[] = [];
    const completedStepIds = new Set<string>();

    // 按阶段顺序执行
    for (const phaseGroup of orderedPhaseGroups) {
      await this.executeSinglePhaseWithRecovery(
        phaseGroup,
        context,
        completedStepIds,
        allResults,
        onStepComplete,
        onPhaseError,
        onPhaseComplete
      );
    }

    return allResults;
  }

  /**
   * 回滚操作
   */
  async rollback(snapshotId: string): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.callTool('rollback', { snapshotId });
      return result as { success: boolean; message: string };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 检测文件语言
   */
  private detectLanguage(path: string): 'typescript' | 'javascript' | 'json' | 'yaml' | null {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
      case 'mjs':
      case 'cjs':
        return 'javascript';
      case 'json':
        return 'json';
      case 'yaml':
      case 'yml':
        return 'yaml';
      default:
        return null;
    }
  }
}

/**
 * 创建 Executor 实例
 */
export function createExecutor(config: ExecutorConfig): Executor {
  return new Executor(config);
}
