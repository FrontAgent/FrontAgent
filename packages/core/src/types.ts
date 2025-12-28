/**
 * Agent Core 类型定义
 */

import type {
  AgentTask,
  ExecutionPlan,
  ExecutionStep,
  StepResult,
  SDDConfig,
  ValidationResult
} from '@frontagent/shared';

/**
 * Agent 配置
 */
export interface AgentConfig {
  /** 项目根目录 */
  projectRoot: string;
  /** SDD 配置文件路径 */
  sddPath?: string;
  /** LLM 配置 */
  llm: LLMConfig;
  /** MCP 服务器配置 */
  mcp?: MCPConfig;
  /** 幻觉防控配置 */
  hallucinationGuard?: HallucinationGuardConfig;
  /** 调试模式 */
  debug?: boolean;
}

/**
 * LLM 配置
 */
export interface LLMConfig {
  /** 提供商 */
  provider: 'openai' | 'anthropic';
  /** 模型名称 */
  model: string;
  /** API Key (可选，默认从环境变量读取) */
  apiKey?: string;
  /** 自定义 API 基础 URL (用于代理或兼容 API) */
  baseURL?: string;
  /** 最大 token 数 */
  maxTokens?: number;
  /** 温度 */
  temperature?: number;
}

/**
 * MCP 配置
 */
export interface MCPConfig {
  /** 文件服务器配置 */
  fileServer?: {
    enabled: boolean;
    command?: string;
    args?: string[];
  };
  /** Web 服务器配置 */
  webServer?: {
    enabled: boolean;
    command?: string;
    args?: string[];
    headless?: boolean;
  };
}

/**
 * 幻觉防控配置
 */
export interface HallucinationGuardConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 启用的检查类型 */
  checks?: {
    fileExistence?: boolean;
    importValidity?: boolean;
    syntaxValidity?: boolean;
    sddCompliance?: boolean;
  };
}

/**
 * Agent 运行时上下文
 */
export interface AgentContext {
  /** 当前任务 */
  task: AgentTask;
  /** 执行计划 */
  plan?: ExecutionPlan;
  /** 已执行的步骤 */
  executedSteps: ExecutionStep[];
  /** SDD 配置 */
  sddConfig?: SDDConfig;
  /** 收集的上下文信息 */
  collectedContext: ContextInfo;
  /** 会话消息历史 */
  messages: Message[];
  /** 项目事实 - 从工具执行中提取的结构化信息 */
  facts: ProjectFacts;
}

/**
 * 模块信息 - 追踪已创建的模块及其导入导出
 */
export interface ModuleInfo {
  /** 模块路径（相对于项目根目录） */
  path: string;
  /** 模块类型 */
  type: 'component' | 'page' | 'store' | 'api' | 'util' | 'config' | 'style' | 'other';
  /** 导出的符号 */
  exports: string[];
  /** 默认导出的名称 */
  defaultExport?: string;
  /** 导入的模块（相对路径或包名） */
  imports: string[];
  /** 创建时间戳 */
  createdAt: number;
}

/**
 * 模块依赖图 - 追踪模块间的依赖关系
 */
export interface ModuleDependencyGraph {
  /** 所有已创建的模块 */
  modules: Map<string, ModuleInfo>;
  /** 依赖关系：模块路径 -> 被依赖的模块路径列表 */
  dependencies: Map<string, string[]>;
  /** 反向依赖：模块路径 -> 依赖该模块的模块列表 */
  reverseDependencies: Map<string, string[]>;
}

/**
 * 项目事实 - 从工具执行中提取的结构化信息
 */
export interface ProjectFacts {
  /** 文件系统状态 */
  filesystem: {
    /** 已确认存在的文件 */
    existingFiles: Set<string>;
    /** 已确认存在的目录 */
    existingDirectories: Set<string>;
    /** 已确认不存在的文件/目录 */
    nonExistentPaths: Set<string>;
    /** 目录内容映射 */
    directoryContents: Map<string, string[]>;
  };
  /** 依赖状态 */
  dependencies: {
    /** 已安装的包 */
    installedPackages: Set<string>;
    /** 缺失的包 */
    missingPackages: Set<string>;
  };
  /** 项目状态 */
  project: {
    /** 开发服务器是否运行 */
    devServerRunning: boolean;
    /** 运行的端口 */
    runningPort?: number;
    /** 构建状态 */
    buildStatus?: 'success' | 'failed' | 'unknown';
  };
  /** 模块依赖图 */
  moduleDependencyGraph: ModuleDependencyGraph;
  /** 错误历史 */
  errors: Array<{
    /** 步骤ID */
    stepId: string;
    /** 错误类型 */
    type: string;
    /** 错误消息 */
    message: string;
    /** 时间戳 */
    timestamp: number;
  }>;
}

/**
 * 上下文信息
 */
export interface ContextInfo {
  /** 已读取的文件 */
  files: Map<string, string>;
  /** 页面结构（如果有） */
  pageStructure?: unknown;
  /** RAG 检索结果 */
  ragResults?: string[];
  /** 其他元数据 */
  metadata: Record<string, unknown>;
}

/**
 * 消息类型
 */
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolName?: string;
}

/**
 * 工具调用
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * 工具执行结果
 */
export interface ToolResult {
  callId: string;
  name: string;
  result: unknown;
  error?: string;
}

/**
 * Planner 输出
 */
export interface PlannerOutput {
  /** 是否需要更多信息 */
  needsMoreContext: boolean;
  /** 需要的上下文类型 */
  contextRequests?: ContextRequest[];
  /** 执行计划 */
  plan?: ExecutionPlan;
  /** 拒绝原因（如果任务被拒绝） */
  rejectionReason?: string;
}

/**
 * 上下文请求
 */
export interface ContextRequest {
  type: 'read_file' | 'search_code' | 'get_page' | 'rag_query';
  params: Record<string, unknown>;
}

/**
 * Executor 输出
 */
export interface ExecutorOutput {
  /** 步骤执行结果 */
  stepResult: StepResult;
  /** 验证结果 */
  validation: ValidationResult;
  /** 是否需要回滚 */
  needsRollback: boolean;
  /** 后续步骤调整建议 */
  adjustments?: string[];
}

/**
 * Agent 执行结果
 */
export interface AgentExecutionResult {
  /** 是否成功 */
  success: boolean;
  /** 任务 ID */
  taskId: string;
  /** 执行的步骤 */
  executedSteps: ExecutionStep[];
  /** 最终输出 */
  output?: string;
  /** 错误信息 */
  error?: string;
  /** 执行时长（毫秒） */
  duration: number;
  /** 验证结果 */
  validations: ValidationResult[];
}

/**
 * Agent 事件
 */
export type AgentEvent =
  | { type: 'task_started'; task: AgentTask }
  | { type: 'planning_started' }
  | { type: 'planning_completed'; plan: ExecutionPlan }
  | { type: 'step_started'; step: ExecutionStep }
  | { type: 'step_completed'; step: ExecutionStep; result: StepResult }
  | { type: 'step_failed'; step: ExecutionStep; error: string }
  | { type: 'validation_failed'; result: ValidationResult }
  | { type: 'rollback_started'; snapshotId: string }
  | { type: 'rollback_completed'; snapshotId: string }
  | { type: 'task_completed'; result: AgentExecutionResult }
  | { type: 'task_failed'; error: string };

/**
 * 事件监听器
 */
export type AgentEventListener = (event: AgentEvent) => void;

