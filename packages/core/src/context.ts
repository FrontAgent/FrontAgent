/**
 * Agent 上下文管理器
 */

import type {
  AgentTask,
  ExecutionPlan,
  ExecutionStep,
  SDDConfig
} from '@frontagent/shared';
import type { AgentContext, ContextInfo, Message } from './types.js';
import { generateId } from '@frontagent/shared';

/**
 * 上下文管理器
 */
export class ContextManager {
  private contexts: Map<string, AgentContext> = new Map();

  /**
   * 创建新的上下文
   */
  createContext(task: AgentTask, sddConfig?: SDDConfig): AgentContext {
    const context: AgentContext = {
      task,
      executedSteps: [],
      sddConfig,
      collectedContext: {
        files: new Map(),
        metadata: {}
      },
      messages: []
    };

    this.contexts.set(task.id, context);
    return context;
  }

  /**
   * 获取上下文
   */
  getContext(taskId: string): AgentContext | undefined {
    return this.contexts.get(taskId);
  }

  /**
   * 更新执行计划
   */
  setPlan(taskId: string, plan: ExecutionPlan): void {
    const context = this.contexts.get(taskId);
    if (context) {
      context.plan = plan;
    }
  }

  /**
   * 添加已执行步骤
   */
  addExecutedStep(taskId: string, step: ExecutionStep): void {
    const context = this.contexts.get(taskId);
    if (context) {
      context.executedSteps.push(step);
    }
  }

  /**
   * 添加文件到上下文
   */
  addFile(taskId: string, path: string, content: string): void {
    const context = this.contexts.get(taskId);
    if (context) {
      context.collectedContext.files.set(path, content);
    }
  }

  /**
   * 设置页面结构
   */
  setPageStructure(taskId: string, structure: unknown): void {
    const context = this.contexts.get(taskId);
    if (context) {
      context.collectedContext.pageStructure = structure;
    }
  }

  /**
   * 添加 RAG 结果
   */
  addRagResults(taskId: string, results: string[]): void {
    const context = this.contexts.get(taskId);
    if (context) {
      context.collectedContext.ragResults = [
        ...(context.collectedContext.ragResults ?? []),
        ...results
      ];
    }
  }

  /**
   * 添加消息
   */
  addMessage(taskId: string, message: Message): void {
    const context = this.contexts.get(taskId);
    if (context) {
      context.messages.push(message);
    }
  }

  /**
   * 获取消息历史
   */
  getMessages(taskId: string): Message[] {
    return this.contexts.get(taskId)?.messages ?? [];
  }

  /**
   * 清理上下文
   */
  clearContext(taskId: string): void {
    this.contexts.delete(taskId);
  }

  /**
   * 构建系统提示词
   */
  buildSystemPrompt(taskId: string, sddPrompt: string): string {
    const context = this.contexts.get(taskId);
    if (!context) {
      return sddPrompt;
    }

    const parts: string[] = [sddPrompt];

    // 添加已读取的文件信息
    if (context.collectedContext.files.size > 0) {
      parts.push('\n## 已读取的文件\n');
      for (const [path, content] of context.collectedContext.files) {
        const lines = content.split('\n').length;
        parts.push(`- \`${path}\` (${lines} 行)`);
      }
    }

    // 添加已执行的步骤
    if (context.executedSteps.length > 0) {
      parts.push('\n## 已执行的步骤\n');
      for (const step of context.executedSteps) {
        const status = step.status === 'completed' ? '✅' : step.status === 'failed' ? '❌' : '⏳';
        parts.push(`${status} ${step.description}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * 构建当前上下文摘要
   */
  buildContextSummary(taskId: string): string {
    const context = this.contexts.get(taskId);
    if (!context) {
      return '';
    }

    const summary: string[] = [];

    // 任务信息
    summary.push(`## 当前任务`);
    summary.push(`- 类型: ${context.task.type}`);
    summary.push(`- 描述: ${context.task.description}`);

    // 文件上下文
    if (context.collectedContext.files.size > 0) {
      summary.push(`\n## 相关文件`);
      for (const [path] of context.collectedContext.files) {
        summary.push(`- ${path}`);
      }
    }

    // 计划进度
    if (context.plan) {
      const total = context.plan.steps.length;
      const completed = context.executedSteps.filter(s => s.status === 'completed').length;
      summary.push(`\n## 执行进度: ${completed}/${total}`);
    }

    return summary.join('\n');
  }
}

/**
 * 创建上下文管理器实例
 */
export function createContextManager(): ContextManager {
  return new ContextManager();
}

