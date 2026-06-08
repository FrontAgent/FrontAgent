import type { AgentTask, ExecutionPlan, ExecutionStep, SDDConfig } from '@frontagent/shared';
import type {
  AgentContext,
  FilesenseNavigationIntent,
  Message,
  ProjectFacts,
  ProjectFactsMergeResult,
  ProjectFactsSnapshot,
  ProjectFactsUpdate,
  RagContextMatch,
} from '../types.js';
import { serializeProjectFactsForLLM } from './fact-serializer.js';
import {
  exportProjectFactsSnapshot,
  mergeProjectFactsUpdate,
  projectFactsFromSnapshot,
} from './facts-merge-helpers.js';
import {
  formatFilesenseNavigationContext,
  normalizeFilesenseNavigation,
  parentDirectoriesForPath,
} from './helpers.js';
import { updateModuleDependencyGraphFromToolResult } from './module-dependency-graph.js';

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
        metadata: {},
      },
      messages: [],
      facts: {
        revision: 0,
        filesystem: {
          existingFiles: new Set(),
          existingDirectories: new Set(),
          nonExistentPaths: new Set(),
          directoryContents: new Map(),
        },
        dependencies: {
          installedPackages: new Set(),
          missingPackages: new Set(),
        },
        project: {
          devServerRunning: false,
          buildStatus: 'unknown',
        },
        moduleDependencyGraph: {
          modules: new Map(),
          dependencies: new Map(),
          reverseDependencies: new Map(),
        },
        errors: [],
      },
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

  private bumpFactsRevision(facts: ProjectFacts): void {
    facts.revision += 1;
  }

  private addToSet(set: Set<string>, value: string): boolean {
    const before = set.size;
    set.add(value);
    return set.size !== before;
  }

  private removeFromSet(set: Set<string>, value: string): boolean {
    return set.delete(value);
  }

  private setStringArrayMap(map: Map<string, string[]>, key: string, value: string[]): boolean {
    const previous = map.get(key);
    if (
      previous &&
      previous.length === value.length &&
      previous.every((item, idx) => item === value[idx])
    ) {
      return false;
    }
    map.set(key, value);
    return true;
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
        ...results,
      ];
    }
  }

  setRagMetadata(
    taskId: string,
    input: {
      matches?: RagContextMatch[];
      searchMode?: 'hybrid' | 'keyword_only' | 'openviking' | 'composite';
      warnings?: string[];
    },
  ): void {
    const context = this.contexts.get(taskId);
    if (context) {
      context.collectedContext.ragMatches = input.matches;
      context.collectedContext.ragSearchMode = input.searchMode;
      context.collectedContext.ragWarnings = input.warnings;
    }
  }

  /**
   * 设置 Filesense 目录索引上下文
   */
  setFilesenseContext(taskId: string, context: string): void {
    const ctx = this.contexts.get(taskId);
    if (ctx) {
      ctx.collectedContext.filesenseContext = context;
    }
  }

  updateFilesenseNavigation(
    taskId: string,
    input: {
      intent?: FilesenseNavigationIntent;
      paths?: string[];
      data?: unknown;
    },
  ): void {
    const ctx = this.contexts.get(taskId);
    if (!ctx) return;

    const navigation = normalizeFilesenseNavigation(input.data, input.intent, input.paths);
    if (!navigation) return;

    ctx.collectedContext.filesenseNavigation = navigation;
    ctx.collectedContext.filesenseContext = formatFilesenseNavigationContext(navigation);
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
   *
   * The prompt is structured into three zones with independent budgets:
   *   1. Rules zone -- SDD constraints, behavioral instructions (immutable per task)
   *   2. Memory zone -- durable project knowledge from .frontagent/memory/
   *   3. Context zone -- dynamic per-task data (files, executed steps)
   */
  buildSystemPrompt(taskId: string, sddPrompt: string): string {
    const context = this.contexts.get(taskId);
    if (!context) {
      return sddPrompt;
    }

    const zones: string[] = [];

    // --- Zone 1: Rules (SDD constraints) ---
    zones.push(sddPrompt);

    // --- Zone 2: Memory (durable cross-session knowledge) ---
    if (context.collectedContext.memoryContext) {
      zones.push(`\n${context.collectedContext.memoryContext}`);
    }

    // --- Zone 2.5: Filesense (directory structure awareness) ---
    if (context.collectedContext.filesenseContext) {
      zones.push(`\n## 目录导航 (Filesense)\n${context.collectedContext.filesenseContext}`);
    }

    // --- Zone 3: Context (dynamic per-task data) ---
    const contextParts: string[] = [];

    if (context.collectedContext.files.size > 0) {
      contextParts.push('\n## 已读取的文件\n');
      for (const [path, content] of context.collectedContext.files) {
        const lines = content.split('\n').length;
        contextParts.push(`- \`${path}\` (${lines} 行)`);
      }
    }

    if (context.executedSteps.length > 0) {
      contextParts.push('\n## 已执行的步骤\n');
      for (const step of context.executedSteps) {
        const status = step.status === 'completed' ? '✅' : step.status === 'failed' ? '❌' : '⏳';
        contextParts.push(`${status} ${step.description}`);
      }
    }

    if (contextParts.length > 0) {
      zones.push(contextParts.join('\n'));
    }

    return zones.join('\n');
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
    summary.push('## 当前任务');
    summary.push(`- 类型: ${context.task.type}`);
    summary.push(`- 描述: ${context.task.description}`);

    // 文件上下文
    if (context.collectedContext.files.size > 0) {
      summary.push('\n## 相关文件');
      for (const [path] of context.collectedContext.files) {
        summary.push(`- ${path}`);
      }
    }

    // 计划进度
    if (context.plan) {
      const total = context.plan.steps.length;
      const completed = context.executedSteps.filter((s) => s.status === 'completed').length;
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
    result: { success?: boolean; error?: string; [key: string]: unknown },
  ): void {
    const context = this.contexts.get(taskId);
    if (!context) return;

    const { facts } = context;
    let changed = false;

    // Handle filesense navigation results - consume explicit factsDelta instead of guessing result shape.
    if (toolName.startsWith('filesense_')) {
      const data = result.data as
        | { factsDelta?: { existingFiles?: string[]; existingDirectories?: string[] } }
        | undefined;
      const factsDelta = data?.factsDelta;
      if (result.success && factsDelta) {
        for (const file of factsDelta.existingFiles ?? []) {
          changed = this.addToSet(facts.filesystem.existingFiles, file) || changed;
          changed = this.removeFromSet(facts.filesystem.nonExistentPaths, file) || changed;
        }
        for (const dir of factsDelta.existingDirectories ?? []) {
          changed = this.addToSet(facts.filesystem.existingDirectories, dir) || changed;
          changed = this.removeFromSet(facts.filesystem.nonExistentPaths, dir) || changed;
        }
      }
    }

    // Handle filesense tool results - enrich ProjectFacts from index data
    if (
      toolName === 'filesense_sync' ||
      toolName === 'filesense_sync_and_summarize' ||
      toolName === 'filesense_query'
    ) {
      if (result.success && result.data) {
        const data = result.data as Record<string, unknown>;

        // For query results, extract file/directory existence from the index
        const index = (data.index ?? (data as { sync?: unknown }).sync) as
          | { children?: Array<{ name: string; path: string; type: string }> }
          | undefined;
        if (index?.children) {
          for (const child of index.children) {
            if (child.type === 'file') {
              changed = this.addToSet(facts.filesystem.existingFiles, child.path) || changed;
              changed =
                this.removeFromSet(facts.filesystem.nonExistentPaths, child.path) || changed;
            } else if (child.type === 'dir') {
              changed = this.addToSet(facts.filesystem.existingDirectories, child.path) || changed;
              changed =
                this.removeFromSet(facts.filesystem.nonExistentPaths, child.path) || changed;
            }
          }
        }

        // For sync results, mark the root as existing directory
        const root = data.root as string | undefined;
        if (root) {
          changed = this.addToSet(facts.filesystem.existingDirectories, root) || changed;
        }
      }
    }

    switch (toolName) {
      case 'create_file':
      case 'apply_patch': {
        const path = params.path as string;
        if (result.success) {
          changed = this.addToSet(facts.filesystem.existingFiles, path) || changed;
          changed = this.removeFromSet(facts.filesystem.nonExistentPaths, path) || changed;
        } else if (result.error?.includes('not found')) {
          changed = this.addToSet(facts.filesystem.nonExistentPaths, path) || changed;
        }
        break;
      }
      case 'read_file': {
        const path = params.path as string;
        // 🔧 修复：检查 skipped 和 exists 字段，正确记录不存在的文件
        if (result.success && !result.skipped) {
          // 真正成功读取了文件
          changed = this.addToSet(facts.filesystem.existingFiles, path) || changed;
          changed = this.removeFromSet(facts.filesystem.nonExistentPaths, path) || changed;
        } else if (result.skipped && result.exists === false) {
          // 步骤被跳过且文件不存在
          changed = this.addToSet(facts.filesystem.nonExistentPaths, path) || changed;
          changed = this.removeFromSet(facts.filesystem.existingFiles, path) || changed;
        } else if (
          result.error?.includes('not found') ||
          result.error?.includes('does not exist')
        ) {
          // 明确的文件不存在错误
          changed = this.addToSet(facts.filesystem.nonExistentPaths, path) || changed;
          changed = this.removeFromSet(facts.filesystem.existingFiles, path) || changed;
        }
        break;
      }
      case 'list_directory': {
        const path = params.path as string;
        // 🔧 修复：同样检查 skipped 字段
        if (result.success && !result.skipped && Array.isArray(result.entries)) {
          changed = this.addToSet(facts.filesystem.existingDirectories, path) || changed;

          // 🔧 关键修复：从目录内容推断文件存在性
          // list_directory 返回的 entries 是 FileInfo[] 对象数组
          // FileInfo = { name: string, path: string, type: 'file' | 'directory', size?, modifiedAt? }
          const entries = result.entries as Array<{ name: string; path: string; type: string }>;

          // 存储路径字符串用于 directoryContents
          changed =
            this.setStringArrayMap(
              facts.filesystem.directoryContents,
              path,
              entries.map((e) => e.path),
            ) || changed;

          // 将目录中的文件/子目录添加到相应的集合
          for (const entry of entries) {
            if (entry.type === 'file') {
              changed = this.addToSet(facts.filesystem.existingFiles, entry.path) || changed;
              changed =
                this.removeFromSet(facts.filesystem.nonExistentPaths, entry.path) || changed;
            } else if (entry.type === 'directory') {
              changed = this.addToSet(facts.filesystem.existingDirectories, entry.path) || changed;
              changed =
                this.removeFromSet(facts.filesystem.nonExistentPaths, entry.path) || changed;
            }
          }
        } else if (result.skipped || result.error?.includes('not found')) {
          changed = this.addToSet(facts.filesystem.nonExistentPaths, path) || changed;
        }
        break;
      }
      case 'search_code': {
        if (!result.success) {
          break;
        }

        const files = new Set<string>();

        if (Array.isArray(result.files)) {
          for (const file of result.files) {
            if (typeof file === 'string') {
              files.add(file);
            }
          }
        }

        if (Array.isArray(result.matches)) {
          for (const match of result.matches as Array<{ file?: unknown }>) {
            if (typeof match.file === 'string') {
              files.add(match.file);
            }
          }
        }

        for (const file of files) {
          changed = this.addToSet(facts.filesystem.existingFiles, file) || changed;
          changed = this.removeFromSet(facts.filesystem.nonExistentPaths, file) || changed;

          for (const parent of parentDirectoriesForPath(file)) {
            changed = this.addToSet(facts.filesystem.existingDirectories, parent) || changed;
            changed = this.removeFromSet(facts.filesystem.nonExistentPaths, parent) || changed;
          }
        }
        break;
      }
    }

    if (changed) {
      this.bumpFactsRevision(facts);
    }
  }

  /**
   * 更新依赖事实
   */
  updateDependencyFacts(
    taskId: string,
    toolName: string,
    params: Record<string, unknown>,
    result: { success?: boolean; error?: string; [key: string]: unknown },
  ): void {
    const context = this.contexts.get(taskId);
    if (!context) return;

    const { facts } = context;
    let changed = false;

    if (toolName === 'run_command') {
      const command = params.command as string;

      // 检测包管理器安装命令
      if (
        command.includes('npm install') ||
        command.includes('pnpm install') ||
        command.includes('yarn add')
      ) {
        const packageMatch = command.match(/(?:install|add)\s+(@?[\w/-]+)/);
        if (packageMatch && result.success) {
          changed = this.addToSet(facts.dependencies.installedPackages, packageMatch[1]) || changed;
          changed =
            this.removeFromSet(facts.dependencies.missingPackages, packageMatch[1]) || changed;
        }
      }

      // 检测缺失的包（从错误信息中提取）
      if (result.error) {
        const missingMatch = result.error.match(
          /Cannot find (?:module|package) ['"](@?[\w/-]+)['"]/,
        );
        if (missingMatch) {
          changed = this.addToSet(facts.dependencies.missingPackages, missingMatch[1]) || changed;
        }
      }
    }

    if (changed) {
      this.bumpFactsRevision(facts);
    }
  }

  /**
   * 更新项目状态事实
   */
  updateProjectFacts(
    taskId: string,
    toolName: string,
    params: Record<string, unknown>,
    result: { success?: boolean; error?: string; output?: string; [key: string]: unknown },
  ): void {
    const context = this.contexts.get(taskId);
    if (!context) return;

    const { facts } = context;
    let changed = false;

    if (toolName === 'run_command') {
      const command = params.command as string;

      // 检测开发服务器启动
      if (command.includes('dev') || command.includes('start')) {
        if (result.success) {
          if (!facts.project.devServerRunning) {
            facts.project.devServerRunning = true;
            changed = true;
          }
          // 尝试提取端口号
          const portMatch = result.output?.match(/(?:localhost|127\.0\.0\.1):(\d+)/);
          if (portMatch) {
            const nextPort = Number.parseInt(portMatch[1], 10);
            if (facts.project.runningPort !== nextPort) {
              facts.project.runningPort = nextPort;
              changed = true;
            }
          }
        }
      }

      // 检测构建命令
      if (command.includes('build')) {
        const nextStatus = result.success ? 'success' : 'failed';
        if (facts.project.buildStatus !== nextStatus) {
          facts.project.buildStatus = nextStatus;
          changed = true;
        }
      }
    }

    if (changed) {
      this.bumpFactsRevision(facts);
    }
  }

  /**
   * 更新模块依赖图
   */
  updateModuleDependencyGraph(
    taskId: string,
    toolName: string,
    params: Record<string, unknown>,
    result: { success?: boolean; content?: string; [key: string]: unknown },
  ): void {
    const context = this.contexts.get(taskId);
    if (!context) return;

    if (
      updateModuleDependencyGraphFromToolResult(
        context.facts.moduleDependencyGraph,
        toolName,
        params,
        result,
      )
    ) {
      this.bumpFactsRevision(context.facts);
    }
  }

  /**
   * 验证模块依赖关系
   * 返回缺失的模块引用
   */
  validateModuleDependencies(
    taskId: string,
  ): Array<{ from: string; missing: string; importPath: string }> {
    const context = this.contexts.get(taskId);
    if (!context) return [];

    const { moduleDependencyGraph, filesystem } = context.facts;
    const missingDeps: Array<{ from: string; missing: string; importPath: string }> = [];

    for (const [modulePath, deps] of moduleDependencyGraph.dependencies) {
      const moduleInfo = moduleDependencyGraph.modules.get(modulePath);
      if (!moduleInfo) continue;

      for (let i = 0; i < deps.length; i++) {
        const depPath = deps[i];
        const importPath = moduleInfo.imports[i] || depPath;

        // 检查模块是否存在
        const exists =
          moduleDependencyGraph.modules.has(depPath) ||
          filesystem.existingFiles.has(depPath) ||
          // 尝试其他扩展名
          filesystem.existingFiles.has(depPath.replace(/\.tsx$/, '.ts')) ||
          filesystem.existingFiles.has(depPath.replace(/\.tsx$/, '.js')) ||
          filesystem.existingFiles.has(depPath.replace(/\.tsx$/, '/index.tsx')) ||
          filesystem.existingFiles.has(depPath.replace(/\.tsx$/, '/index.ts'));

        if (!exists) {
          missingDeps.push({
            from: modulePath,
            missing: depPath,
            importPath,
          });
        }
      }
    }

    return missingDeps;
  }

  /**
   * 获取已创建的模块路径列表
   * 用于在代码生成时告知 LLM 哪些模块已存在
   */
  getCreatedModulePaths(taskId: string): string[] {
    const context = this.contexts.get(taskId);
    if (!context) return [];

    const { moduleDependencyGraph, filesystem } = context.facts;

    // 合并模块依赖图中的模块和文件系统中确认存在的 JS/TS 文件
    const modulePaths = new Set<string>();

    // 从模块依赖图获取
    for (const path of moduleDependencyGraph.modules.keys()) {
      modulePaths.add(path);
    }

    // 从文件系统事实获取
    for (const path of filesystem.existingFiles) {
      if (/\.(tsx?|jsx?|mjs|cjs)$/.test(path)) {
        modulePaths.add(path);
      }
    }

    return Array.from(modulePaths);
  }

  /**
   * 添加错误事实
   */
  addErrorFact(taskId: string, stepId: string, errorType: string, errorMessage: string): void {
    const context = this.contexts.get(taskId);
    if (!context) return;

    context.facts.errors.push({
      stepId,
      type: errorType,
      message: errorMessage,
      timestamp: Date.now(),
    });
    this.bumpFactsRevision(context.facts);
  }

  /**
   * 导出可序列化的事实快照（用于 A2A 跨进程传输）
   */
  exportFactsSnapshot(taskId: string): ProjectFactsSnapshot | undefined {
    const context = this.contexts.get(taskId);
    if (!context) return undefined;

    return exportProjectFactsSnapshot(context.facts);
  }

  /**
   * 合并子 Agent 反馈的事实增量包
   */
  mergeFactsUpdate(taskId: string, update: ProjectFactsUpdate): ProjectFactsMergeResult {
    const context = this.contexts.get(taskId);
    if (!context) {
      return {
        applied: false,
        staleBaseRevision: false,
        previousRevision: -1,
        nextRevision: -1,
        source: update.source,
      };
    }

    return mergeProjectFactsUpdate(context.facts, update);
  }

  /**
   * 使用完整快照覆盖当前事实（用于跨 Agent 冷启动同步）
   */
  replaceFactsFromSnapshot(taskId: string, snapshot: ProjectFactsSnapshot): void {
    const context = this.contexts.get(taskId);
    if (!context) return;

    context.facts = projectFactsFromSnapshot(snapshot);
  }

  /**
   * 序列化事实为 LLM 可读格式
   */
  serializeFactsForLLM(taskId: string): string {
    const context = this.contexts.get(taskId);
    if (!context) return '';

    return serializeProjectFactsForLLM(context.facts, {
      missingModuleReferences: this.validateModuleDependencies(taskId),
    });
  }
}

/**
 * 创建上下文管理器实例
 */
export function createContextManager(): ContextManager {
  return new ContextManager();
}
