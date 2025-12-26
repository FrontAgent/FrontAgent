/**
 * Agent Planner
 * 负责任务分解和执行计划生成
 */

import type {
  AgentTask,
  ExecutionPlan,
  ExecutionStep,
  SDDConfig,
  RollbackStrategy,
  ValidationRule
} from '@frontagent/shared';
import { generateId } from '@frontagent/shared';
import type { PlannerOutput, ContextRequest, LLMConfig, Message } from './types.js';

/**
 * Planner 配置
 */
export interface PlannerConfig {
  llm: LLMConfig;
  sddConfig?: SDDConfig;
  maxSteps?: number;
}

/**
 * Planner 类
 */
export class Planner {
  private config: PlannerConfig;

  constructor(config: PlannerConfig) {
    this.config = {
      ...config,
      maxSteps: config.maxSteps ?? 20
    };
  }

  /**
   * 为任务生成执行计划
   */
  async plan(
    task: AgentTask,
    context: { files: Map<string, string>; pageStructure?: unknown },
    messages: Message[]
  ): Promise<PlannerOutput> {
    // 分析任务，确定需要的上下文
    const contextRequests = this.analyzeContextNeeds(task, context);
    
    if (contextRequests.length > 0) {
      return {
        needsMoreContext: true,
        contextRequests
      };
    }

    // 生成执行计划
    const plan = await this.generatePlan(task, context, messages);
    
    if (!plan) {
      return {
        needsMoreContext: false,
        rejectionReason: '无法生成有效的执行计划'
      };
    }

    return {
      needsMoreContext: false,
      plan
    };
  }

  /**
   * 分析任务需要的上下文
   */
  private analyzeContextNeeds(
    task: AgentTask,
    context: { files: Map<string, string>; pageStructure?: unknown }
  ): ContextRequest[] {
    const requests: ContextRequest[] = [];

    // 如果任务涉及修改文件，但文件还没读取
    if (task.type === 'modify' || task.type === 'refactor') {
      const relevantFiles = task.context?.relevantFiles ?? [];
      for (const file of relevantFiles) {
        if (!context.files.has(file)) {
          requests.push({
            type: 'read_file',
            params: { path: file }
          });
        }
      }
    }

    // 如果任务涉及 Web 操作，但没有页面结构
    if (task.context?.browserUrl && !context.pageStructure) {
      requests.push({
        type: 'get_page',
        params: { url: task.context.browserUrl }
      });
    }

    return requests;
  }

  /**
   * 生成执行计划（核心逻辑）
   */
  private async generatePlan(
    task: AgentTask,
    context: { files: Map<string, string>; pageStructure?: unknown },
    _messages: Message[]
  ): Promise<ExecutionPlan | null> {
    // 根据任务类型生成基础计划
    const steps = this.generateStepsForTask(task, context);

    if (steps.length === 0) {
      return null;
    }

    // 限制步骤数量
    const limitedSteps = steps.slice(0, this.config.maxSteps!);

    const plan: ExecutionPlan = {
      taskId: task.id,
      summary: this.generatePlanSummary(task, limitedSteps),
      steps: limitedSteps,
      rollbackStrategy: this.determineRollbackStrategy(task),
      estimatedDuration: this.estimateDuration(limitedSteps)
    };

    return plan;
  }

  /**
   * 根据任务类型生成步骤
   */
  private generateStepsForTask(
    task: AgentTask,
    context: { files: Map<string, string>; pageStructure?: unknown }
  ): ExecutionStep[] {
    const steps: ExecutionStep[] = [];

    switch (task.type) {
      case 'create':
        steps.push(...this.generateCreateSteps(task));
        break;
      case 'modify':
        steps.push(...this.generateModifySteps(task, context));
        break;
      case 'query':
        steps.push(...this.generateQuerySteps(task));
        break;
      case 'debug':
        steps.push(...this.generateDebugSteps(task, context));
        break;
      case 'refactor':
        steps.push(...this.generateRefactorSteps(task, context));
        break;
      case 'test':
        steps.push(...this.generateTestSteps(task));
        break;
    }

    return steps;
  }

  /**
   * 生成创建任务的步骤
   */
  private generateCreateSteps(task: AgentTask): ExecutionStep[] {
    const steps: ExecutionStep[] = [];
    const targetPath = task.context?.relevantFiles?.[0] ?? 'src/new-file.ts';

    // 1. 检查目标路径是否已存在
    steps.push(this.createStep({
      description: `检查目标路径 ${targetPath} 是否已存在`,
      action: 'read_file',
      tool: 'read_file',
      params: { path: targetPath },
      validation: [{ type: 'file_exists', required: false }]
    }));

    // 2. 创建文件
    steps.push(this.createStep({
      description: `创建文件 ${targetPath}`,
      action: 'create_file',
      tool: 'create_file',
      params: { path: targetPath, content: '' }, // 内容由 Executor 填充
      dependencies: [steps[0].stepId],
      validation: [
        { type: 'syntax_valid', required: true },
        { type: 'sdd_compliant', required: true }
      ]
    }));

    return steps;
  }

  /**
   * 生成修改任务的步骤
   */
  private generateModifySteps(
    task: AgentTask,
    context: { files: Map<string, string> }
  ): ExecutionStep[] {
    const steps: ExecutionStep[] = [];
    const targetFiles = task.context?.relevantFiles ?? [];

    for (const file of targetFiles) {
      // 1. 读取文件（如果还没读取）
      if (!context.files.has(file)) {
        steps.push(this.createStep({
          description: `读取文件 ${file}`,
          action: 'read_file',
          tool: 'read_file',
          params: { path: file },
          validation: [{ type: 'file_exists', required: true }]
        }));
      }

      // 2. 获取 AST 分析
      steps.push(this.createStep({
        description: `分析文件结构 ${file}`,
        action: 'get_ast',
        tool: 'get_ast',
        params: { path: file },
        dependencies: steps.length > 0 ? [steps[steps.length - 1].stepId] : []
      }));

      // 3. 应用补丁
      steps.push(this.createStep({
        description: `修改文件 ${file}`,
        action: 'apply_patch',
        tool: 'apply_patch',
        params: { path: file, patches: [] }, // 补丁由 Executor 生成
        dependencies: [steps[steps.length - 1].stepId],
        validation: [
          { type: 'syntax_valid', required: true },
          { type: 'sdd_compliant', required: true }
        ]
      }));
    }

    return steps;
  }

  /**
   * 生成查询任务的步骤
   */
  private generateQuerySteps(task: AgentTask): ExecutionStep[] {
    const steps: ExecutionStep[] = [];

    // 搜索代码
    steps.push(this.createStep({
      description: '搜索相关代码',
      action: 'search_code',
      tool: 'search_code',
      params: { query: task.description }
    }));

    return steps;
  }

  /**
   * 生成调试任务的步骤
   */
  private generateDebugSteps(
    task: AgentTask,
    context: { files: Map<string, string> }
  ): ExecutionStep[] {
    const steps: ExecutionStep[] = [];
    const relevantFiles = task.context?.relevantFiles ?? [];

    // 1. 读取相关文件
    for (const file of relevantFiles) {
      if (!context.files.has(file)) {
        steps.push(this.createStep({
          description: `读取文件 ${file}`,
          action: 'read_file',
          tool: 'read_file',
          params: { path: file }
        }));
      }
    }

    // 2. 搜索错误相关代码
    steps.push(this.createStep({
      description: '搜索错误相关代码',
      action: 'search_code',
      tool: 'search_code',
      params: { query: task.description }
    }));

    return steps;
  }

  /**
   * 生成重构任务的步骤
   */
  private generateRefactorSteps(
    task: AgentTask,
    context: { files: Map<string, string> }
  ): ExecutionStep[] {
    // 重构步骤类似修改，但可能涉及多个文件
    return this.generateModifySteps(task, context);
  }

  /**
   * 生成测试任务的步骤
   */
  private generateTestSteps(task: AgentTask): ExecutionStep[] {
    const steps: ExecutionStep[] = [];

    // 如果涉及 Web 测试
    if (task.context?.browserUrl) {
      steps.push(this.createStep({
        description: '导航到测试页面',
        action: 'browser_navigate',
        tool: 'navigate',
        params: { url: task.context.browserUrl }
      }));

      steps.push(this.createStep({
        description: '获取页面结构',
        action: 'get_page_structure',
        tool: 'get_page_structure',
        params: {},
        dependencies: [steps[0].stepId]
      }));

      steps.push(this.createStep({
        description: '截取页面截图',
        action: 'browser_screenshot',
        tool: 'screenshot',
        params: {},
        dependencies: [steps[1].stepId]
      }));
    }

    return steps;
  }

  /**
   * 创建步骤的辅助方法
   */
  private createStep(options: {
    description: string;
    action: ExecutionStep['action'];
    tool: string;
    params: Record<string, unknown>;
    dependencies?: string[];
    validation?: ValidationRule[];
  }): ExecutionStep {
    return {
      stepId: generateId('step'),
      description: options.description,
      action: options.action,
      tool: options.tool,
      params: options.params,
      dependencies: options.dependencies ?? [],
      validation: options.validation ?? [],
      status: 'pending'
    };
  }

  /**
   * 生成计划摘要
   */
  private generatePlanSummary(task: AgentTask, steps: ExecutionStep[]): string {
    const actionCounts = steps.reduce((acc, step) => {
      acc[step.action] = (acc[step.action] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const actionSummary = Object.entries(actionCounts)
      .map(([action, count]) => `${action}: ${count}`)
      .join(', ');

    return `${task.type} 任务: ${task.description}\n步骤数: ${steps.length} (${actionSummary})`;
  }

  /**
   * 确定回滚策略
   */
  private determineRollbackStrategy(task: AgentTask): RollbackStrategy {
    // 对于修改类任务，启用回滚
    const needsRollback = ['modify', 'create', 'refactor'].includes(task.type);

    return {
      enabled: needsRollback,
      snapshotBeforeExecution: needsRollback,
      rollbackOnFailure: needsRollback,
      maxRollbackSteps: 10
    };
  }

  /**
   * 估算执行时长
   */
  private estimateDuration(steps: ExecutionStep[]): number {
    // 简单估算：每个步骤 2 秒
    return steps.length * 2000;
  }

  /**
   * 更新 SDD 配置
   */
  updateSDDConfig(sddConfig: SDDConfig): void {
    this.config.sddConfig = sddConfig;
  }
}

/**
 * 创建 Planner 实例
 */
export function createPlanner(config: PlannerConfig): Planner {
  return new Planner(config);
}

