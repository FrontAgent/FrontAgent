/**
 * Agent 主类
 * 负责整体编排
 */

import type { AgentTask, ExecutionPlan, SDDConfig, ValidationResult } from '@frontagent/shared';
import { generateId } from '@frontagent/shared';
import { SDDParser, SDDPromptGenerator } from '@frontagent/sdd';
import { HallucinationGuard } from '@frontagent/hallucination-guard';
import { ContextManager } from './context.js';
import { Planner } from './planner.js';
import { Executor, type MCPClient } from './executor.js';
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

    // 初始化 Executor
    this.executor = new Executor({
      hallucinationGuard: this.hallucinationGuard,
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

      // 执行阶段
      const validations: ValidationResult[] = [];

      await this.executor.executeSteps(
        planResult.plan.steps,
        (step, output) => {
          if (output.stepResult.success) {
            this.emit({ type: 'step_completed', step, result: output.stepResult });
          } else {
            this.emit({ type: 'step_failed', step, error: output.stepResult.error ?? 'Unknown error' });
          }
          validations.push(output.validation);

          // 更新上下文
          this.contextManager.addExecutedStep(task.id, step);
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

