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
  /** 执行引擎配置 */
  execution?: AgentExecutionConfig;
  /** MCP 服务器配置 */
  mcp?: MCPConfig;
  /** 幻觉防控配置 */
  hallucinationGuard?: HallucinationGuardConfig;
  /** SubAgent 配置 */
  subAgents?: SubAgentConfig;
  /** RAG 配置 */
  rag?: RagConfig;
  /** 内容层 skill 配置 */
  skillContent?: SkillContentConfig;
  /** 调试模式 */
  debug?: boolean;
}

export interface SkillContentConfig {
  /** 是否启用（默认 true） */
  enabled?: boolean;
  /** 额外的用户 skill 根目录 */
  userSkillRoots?: string[];
  /** 内置 skill 根目录 */
  builtInSkillRoots?: string[];
  /** 隐式触发时最多命中的 skill 数 */
  maxImplicitMatches?: number;
  /** 显式触发时最多命中的 skill 数 */
  maxExplicitMatches?: number;
  /** 每个 skill 最多自动读取的 references/assets 文件数 */
  maxReferenceFiles?: number;
  /** 注入 prompt 时每个 skill 文件的最大字符数 */
  maxCharsPerFile?: number;
}

/**
 * RAG 配置
 */
export interface RagConfig {
  /** 是否启用（默认 true） */
  enabled?: boolean;
  /** 远程知识库 Git 仓库地址 */
  repoUrl: string;
  /** 分支名 */
  branch?: string;
  /** 查询时默认返回条数 */
  maxResults?: number;
  /** 缓存目录（默认 projectRoot/.frontagent/rag-cache） */
  cacheDir?: string;
  /** 是否在查询时尝试同步远程仓库（默认 true） */
  syncOnQuery?: boolean;
  /** 额外排除的路径前缀；子模块路径会自动排除 */
  excludedPathPrefixes?: string[];
  /** 关键词检索候选数 */
  keywordCandidateCount?: number;
  /** 语义检索候选数 */
  semanticCandidateCount?: number;
  /** 关键词检索权重 */
  keywordWeight?: number;
  /** 语义检索权重 */
  semanticWeight?: number;
  /** 文本分块大小（字符） */
  chunkSize?: number;
  /** 分块重叠（字符） */
  chunkOverlap?: number;
  /** 单文件最大索引体积（字节） */
  maxFileSizeBytes?: number;
  /** 查询改写配置 */
  queryRewrite?: {
    /** 是否在检索前用主 LLM 优化用户查询（默认 true） */
    enabled?: boolean;
    /** 查询改写最大输出 token */
    maxTokens?: number;
    /** 查询改写温度 */
    temperature?: number;
  };
  /** 重排序器配置 */
  reranker?: {
    /** 是否启用重排序（默认 false） */
    enabled?: boolean;
    /** 重排序接口提供方 */
    provider?: 'jina-compatible';
    /** 重排序模型 */
    model?: string;
    /** 重排序接口 Base URL */
    baseURL?: string;
    /** 重排序接口 API Key */
    apiKey?: string;
    /** 送入重排序器的候选文档数 */
    candidateCount?: number;
    /** 每个候选文档送入重排序器的最大字符数 */
    maxDocumentChars?: number;
    /** 单次请求超时毫秒 */
    requestTimeoutMs?: number;
  };
  /** 语义检索配置 */
  embedding?: {
    /** 是否启用语义检索（默认 true） */
    enabled?: boolean;
    /** 嵌入接口提供方 */
    provider?: 'openai-compatible';
    /** 嵌入模型 */
    model?: string;
    /** 嵌入接口 Base URL */
    baseURL?: string;
    /** 嵌入接口 API Key */
    apiKey?: string;
    /** 向量维度 */
    dimensions?: number;
    /** 批量嵌入大小 */
    batchSize?: number;
    /** 单次请求超时毫秒 */
    requestTimeoutMs?: number;
  };
  /** 向量存储配置 */
  vectorStore?: {
    /** 向量存储提供方 */
    provider?: 'local' | 'weaviate';
    /** Weaviate 配置 */
    weaviate?: {
      /** Weaviate REST Base URL */
      baseURL?: string;
      /** Weaviate API Key */
      apiKey?: string;
      /** Collection 前缀 */
      collectionPrefix?: string;
      /** 批量写入大小 */
      batchSize?: number;
      /** 单次请求超时毫秒 */
      requestTimeoutMs?: number;
    };
  };
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
  /** Nucleus sampling，建议与 temperature 二选一使用 */
  topP?: number;
  /** 仅从 top-k 候选中采样；并非所有 provider 都支持 */
  topK?: number;
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
 * 执行引擎配置
 */
export interface AgentExecutionConfig {
  /** 执行引擎（默认 native） */
  engine?: 'native' | 'langgraph';
  /** LangGraph 专用配置 */
  langGraph?: {
    /** 是否启用 checkpoint（默认 false） */
    useCheckpoint?: boolean;
    /** 阶段错误恢复最大重试次数（默认 3） */
    maxRecoveryAttempts?: number;
    /** checkpoint thread_id 前缀 */
    threadIdPrefix?: string;
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
 * SubAgent 配置
 */
export interface SubAgentConfig {
  /** 代码质量评估子代理 */
  codeQualityEvaluator?: {
    /** 是否启用（默认 true） */
    enabled?: boolean;
    /** 隔离模式：process 为真实上下文隔离（默认 process） */
    isolationMode?: 'in_memory' | 'process';
    /** process 模式下 worker 超时毫秒（默认 120000） */
    processTimeoutMs?: number;
    /** 是否启用 LLM 评估（默认 true） */
    enableLLMReview?: boolean;
    /** LLM 评估失败时是否回退规则检查（默认 true） */
    enableRuleFallback?: boolean;
    /** 是否将 warning 作为失败处理（默认 false） */
    failOnWarnings?: boolean;
    /** 每个阶段最多评估文件数（默认 20） */
    maxFilesPerPhase?: number;
    /** 单次 LLM 评估最多文件数（默认 6） */
    maxFilesForLLM?: number;
    /** 每个文件传给 LLM 的最大字符数（默认 12000） */
    maxCharsPerFileForLLM?: number;
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
  /** 事实版本号（用于跨 Agent 合并时的冲突检测） */
  revision: number;
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
  errors: ProjectFactError[];
}

/**
 * 事实错误记录
 */
export interface ProjectFactError {
  /** 步骤ID */
  stepId: string;
  /** 错误类型 */
  type: string;
  /** 错误消息 */
  message: string;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 可序列化的项目事实快照（用于 A2A 跨进程传输）
 */
export interface ProjectFactsSnapshot {
  revision: number;
  filesystem: {
    existingFiles: string[];
    existingDirectories: string[];
    nonExistentPaths: string[];
    directoryContents: Record<string, string[]>;
  };
  dependencies: {
    installedPackages: string[];
    missingPackages: string[];
  };
  project: {
    devServerRunning: boolean;
    runningPort?: number;
    buildStatus?: 'success' | 'failed' | 'unknown';
  };
  moduleDependencyGraph: {
    modules: Record<string, ModuleInfo>;
    dependencies: Record<string, string[]>;
    reverseDependencies: Record<string, string[]>;
  };
  errors: ProjectFactError[];
}

/**
 * 子 Agent 返回给主 Agent 的事实增量包
 */
export interface ProjectFactsUpdate {
  /** 子 Agent 生成增量时所基于的事实版本 */
  baseRevision: number;
  /** 更新来源（建议传 agentId） */
  source: string;
  /** 生成时间 */
  timestamp: number;
  changes: {
    addExistingFiles?: string[];
    addExistingDirectories?: string[];
    addNonExistentPaths?: string[];
    removeNonExistentPaths?: string[];
    setDirectoryContents?: Array<{ path: string; entries: string[] }>;
    addInstalledPackages?: string[];
    addMissingPackages?: string[];
    removeMissingPackages?: string[];
    project?: {
      devServerRunning?: boolean;
      runningPort?: number;
      buildStatus?: 'success' | 'failed' | 'unknown';
    };
    upsertModules?: ModuleInfo[];
    setDependencies?: Array<{ path: string; dependencies: string[] }>;
    setReverseDependencies?: Array<{ path: string; reverseDependencies: string[] }>;
    addErrors?: ProjectFactError[];
  };
}

/**
 * 合并事实增量的结果
 */
export interface ProjectFactsMergeResult {
  applied: boolean;
  staleBaseRevision: boolean;
  previousRevision: number;
  nextRevision: number;
  source: string;
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
  /** 结构化 RAG 命中 */
  ragMatches?: RagContextMatch[];
  /** RAG 检索模式 */
  ragSearchMode?: 'hybrid' | 'keyword_only';
  /** RAG 告警 */
  ragWarnings?: string[];
  /** 命中的内容层 skill prompt 上下文 */
  skillContext?: string;
  /** 命中的内容层 skill 名称 */
  matchedSkillNames?: string[];
  /** 其他元数据 */
  metadata: Record<string, unknown>;
}

export interface RagContextMatch {
  type: string;
  title: string;
  sourceUrl: string;
  snippet: string;
  path?: string;
  score?: number;
  rerankScore?: number;
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
  | {
      type: 'rag_retrieved';
      searchMode?: 'hybrid' | 'keyword_only';
      reranked?: boolean;
      warnings?: string[];
      matches: RagContextMatch[];
    }
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
