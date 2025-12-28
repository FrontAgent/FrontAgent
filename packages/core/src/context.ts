/**
 * Agent 上下文管理器
 */

import type {
  AgentTask,
  ExecutionPlan,
  ExecutionStep,
  SDDConfig
} from '@frontagent/shared';
import type { AgentContext, Message } from './types.js';

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
      messages: [],
      facts: {
        filesystem: {
          existingFiles: new Set(),
          existingDirectories: new Set(),
          nonExistentPaths: new Set(),
          directoryContents: new Map()
        },
        dependencies: {
          installedPackages: new Set(),
          missingPackages: new Set()
        },
        project: {
          devServerRunning: false,
          buildStatus: 'unknown'
        },
        errors: []
      }
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

  /**
   * 更新文件系统事实
   */
  updateFileSystemFacts(
    taskId: string,
    toolName: string,
    params: Record<string, unknown>,
    result: { success?: boolean; error?: string; [key: string]: unknown }
  ): void {
    const context = this.contexts.get(taskId);
    if (!context) return;

    const { facts } = context;

    switch (toolName) {
      case 'create_file':
      case 'apply_patch': {
        const path = params.path as string;
        if (result.success) {
          facts.filesystem.existingFiles.add(path);
          facts.filesystem.nonExistentPaths.delete(path);
        } else if (result.error?.includes('not found')) {
          facts.filesystem.nonExistentPaths.add(path);
        }
        break;
      }
      case 'read_file': {
        const path = params.path as string;
        if (result.success) {
          facts.filesystem.existingFiles.add(path);
          facts.filesystem.nonExistentPaths.delete(path);
        } else if (result.error?.includes('not found') || result.error?.includes('does not exist')) {
          facts.filesystem.nonExistentPaths.add(path);
          facts.filesystem.existingFiles.delete(path);
        }
        break;
      }
      case 'list_directory': {
        const path = params.path as string;
        if (result.success && Array.isArray(result.entries)) {
          facts.filesystem.existingDirectories.add(path);
          facts.filesystem.directoryContents.set(path, result.entries as string[]);
        } else if (result.error?.includes('not found')) {
          facts.filesystem.nonExistentPaths.add(path);
        }
        break;
      }
    }
  }

  /**
   * 更新依赖事实
   */
  updateDependencyFacts(
    taskId: string,
    toolName: string,
    params: Record<string, unknown>,
    result: { success?: boolean; error?: string; [key: string]: unknown }
  ): void {
    const context = this.contexts.get(taskId);
    if (!context) return;

    const { facts } = context;

    if (toolName === 'run_command') {
      const command = params.command as string;

      // 检测包管理器安装命令
      if (command.includes('npm install') || command.includes('pnpm install') || command.includes('yarn add')) {
        const packageMatch = command.match(/(?:install|add)\s+(@?[\w/-]+)/);
        if (packageMatch && result.success) {
          facts.dependencies.installedPackages.add(packageMatch[1]);
          facts.dependencies.missingPackages.delete(packageMatch[1]);
        }
      }

      // 检测缺失的包（从错误信息中提取）
      if (result.error) {
        const missingMatch = result.error.match(/Cannot find (?:module|package) ['"](@?[\w/-]+)['"]/);
        if (missingMatch) {
          facts.dependencies.missingPackages.add(missingMatch[1]);
        }
      }
    }
  }

  /**
   * 更新项目状态事实
   */
  updateProjectFacts(
    taskId: string,
    toolName: string,
    params: Record<string, unknown>,
    result: { success?: boolean; error?: string; output?: string; [key: string]: unknown }
  ): void {
    const context = this.contexts.get(taskId);
    if (!context) return;

    const { facts } = context;

    if (toolName === 'run_command') {
      const command = params.command as string;

      // 检测开发服务器启动
      if (command.includes('dev') || command.includes('start')) {
        if (result.success) {
          facts.project.devServerRunning = true;
          // 尝试提取端口号
          const portMatch = result.output?.match(/(?:localhost|127\.0\.0\.1):(\d+)/);
          if (portMatch) {
            facts.project.runningPort = parseInt(portMatch[1], 10);
          }
        }
      }

      // 检测构建命令
      if (command.includes('build')) {
        facts.project.buildStatus = result.success ? 'success' : 'failed';
      }
    }
  }

  /**
   * 添加错误事实
   */
  addErrorFact(
    taskId: string,
    stepId: string,
    errorType: string,
    errorMessage: string
  ): void {
    const context = this.contexts.get(taskId);
    if (!context) return;

    context.facts.errors.push({
      stepId,
      type: errorType,
      message: errorMessage,
      timestamp: Date.now()
    });
  }

  /**
   * 序列化事实为 LLM 可读格式
   */
  serializeFactsForLLM(taskId: string): string {
    const context = this.contexts.get(taskId);
    if (!context) return '';

    const { facts } = context;
    const parts: string[] = [];

    // 文件系统事实
    parts.push('## 文件系统状态');

    if (facts.filesystem.existingFiles.size > 0) {
      parts.push('\n### 已确认存在的文件:');
      for (const file of facts.filesystem.existingFiles) {
        parts.push(`- ${file}`);
      }
    }

    if (facts.filesystem.existingDirectories.size > 0) {
      parts.push('\n### 已确认存在的目录:');
      for (const dir of facts.filesystem.existingDirectories) {
        const contents = facts.filesystem.directoryContents.get(dir);
        if (contents && contents.length > 0) {
          parts.push(`- ${dir}/ (包含: ${contents.slice(0, 5).join(', ')}${contents.length > 5 ? '...' : ''})`);
        } else {
          parts.push(`- ${dir}/`);
        }
      }
    }

    if (facts.filesystem.nonExistentPaths.size > 0) {
      parts.push('\n### 已确认不存在的路径:');
      for (const path of facts.filesystem.nonExistentPaths) {
        parts.push(`- ${path}`);
      }
    }

    // 依赖状态
    if (facts.dependencies.installedPackages.size > 0 || facts.dependencies.missingPackages.size > 0) {
      parts.push('\n## 依赖状态');

      if (facts.dependencies.installedPackages.size > 0) {
        parts.push('\n### 已安装的包:');
        parts.push(Array.from(facts.dependencies.installedPackages).join(', '));
      }

      if (facts.dependencies.missingPackages.size > 0) {
        parts.push('\n### 缺失的包:');
        parts.push(Array.from(facts.dependencies.missingPackages).join(', '));
      }
    }

    // 项目状态
    parts.push('\n## 项目状态');
    parts.push(`- 开发服务器: ${facts.project.devServerRunning ? `运行中${facts.project.runningPort ? ` (端口: ${facts.project.runningPort})` : ''}` : '未运行'}`);
    if (facts.project.buildStatus && facts.project.buildStatus !== 'unknown') {
      parts.push(`- 构建状态: ${facts.project.buildStatus === 'success' ? '成功' : '失败'}`);
    }

    // 最近错误
    if (facts.errors.length > 0) {
      parts.push('\n## 最近的错误 (最多显示5条)');
      const recentErrors = facts.errors.slice(-5);
      for (const error of recentErrors) {
        parts.push(`- [${error.type}] ${error.message}`);
      }
    }

    return parts.join('\n');
  }
}

/**
 * 创建上下文管理器实例
 */
export function createContextManager(): ContextManager {
  return new ContextManager();
}

