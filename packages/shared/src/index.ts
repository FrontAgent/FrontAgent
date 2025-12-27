/**
 * FrontAgent 共享类型和工具
 */

// ============================================================================
// 基础类型定义
// ============================================================================

/**
 * Agent 任务类型
 */
export type TaskType = 
  | 'create'    // 创建新文件/组件
  | 'modify'    // 修改现有代码
  | 'debug'     // 调试问题
  | 'query'     // 查询信息
  | 'refactor'  // 重构代码
  | 'test';     // 测试相关

/**
 * 执行步骤状态
 */
export type StepStatus = 
  | 'pending'     // 待执行
  | 'running'     // 执行中
  | 'completed'   // 已完成
  | 'failed'      // 失败
  | 'skipped'     // 跳过
  | 'rolled_back'; // 已回滚

/**
 * 约束违规级别
 */
export type ViolationSeverity = 'error' | 'warning' | 'info';

// ============================================================================
// Agent 核心类型
// ============================================================================

/**
 * Agent 任务输入
 */
export interface AgentTask {
  id: string;
  type: TaskType;
  description: string;
  context?: TaskContext;
  constraints?: string[];
}

/**
 * 任务上下文
 */
export interface TaskContext {
  /** 当前工作目录 */
  workingDirectory: string;
  /** 相关文件列表 */
  relevantFiles?: string[];
  /** 浏览器 URL (如需要 Web 感知) */
  browserUrl?: string;
  /** 额外上下文信息 */
  metadata?: Record<string, unknown>;
}

/**
 * 执行计划
 */
export interface ExecutionPlan {
  taskId: string;
  summary: string;
  steps: ExecutionStep[];
  estimatedDuration?: number;
  rollbackStrategy: RollbackStrategy;
}

/**
 * 执行步骤
 */
export interface ExecutionStep {
  stepId: string;
  description: string;
  action: ActionType;
  tool: string;
  params: Record<string, unknown>;
  dependencies: string[];
  validation: ValidationRule[];
  status: StepStatus;
  result?: StepResult;
}

/**
 * 动作类型
 */
export type ActionType =
  | 'read_file'
  | 'list_directory'
  | 'write_file'
  | 'apply_patch'
  | 'create_file'
  | 'delete_file'
  | 'search_code'
  | 'get_ast'
  | 'browser_navigate'
  | 'browser_click'
  | 'browser_type'
  | 'browser_screenshot'
  | 'get_page_structure';

/**
 * 步骤执行结果
 */
export interface StepResult {
  success: boolean;
  output?: unknown;
  error?: string;
  duration: number;
  snapshotId?: string;
}

/**
 * 回滚策略
 */
export interface RollbackStrategy {
  enabled: boolean;
  snapshotBeforeExecution: boolean;
  rollbackOnFailure: boolean;
  maxRollbackSteps: number;
}

/**
 * 验证规则
 */
export interface ValidationRule {
  type: ValidationType;
  params?: Record<string, unknown>;
  required: boolean;
}

export type ValidationType = 
  | 'file_exists'
  | 'syntax_valid'
  | 'lint_pass'
  | 'type_check_pass'
  | 'tests_pass'
  | 'sdd_compliant';

// ============================================================================
// SDD 相关类型
// ============================================================================

/**
 * SDD 配置
 */
export interface SDDConfig {
  version: string;
  project: ProjectConfig;
  techStack: TechStackConfig;
  directoryStructure: DirectoryStructureConfig;
  moduleBoundaries: ModuleBoundary[];
  namingConventions: NamingConventions;
  codeQuality: CodeQualityConfig;
  modificationRules: ModificationRules;
}

export interface ProjectConfig {
  name: string;
  type: string;
  description?: string;
}

export interface TechStackConfig {
  framework: string;
  version: string;
  language: string;
  styling?: string;
  stateManagement?: string;
  forbiddenPackages: string[];
}

export interface DirectoryStructureConfig {
  [path: string]: DirectoryRule;
}

export interface DirectoryRule {
  pattern?: string;
  maxLines?: number;
  requiredExports?: string[];
  forbidden?: string[];
  mustBePure?: boolean;
}

export interface ModuleBoundary {
  from: string;
  canImport: string[];
  cannotImport: string[];
}

export interface NamingConventions {
  components: string;
  hooks: string;
  utils: string;
  constants: string;
  types: string;
}

export interface CodeQualityConfig {
  maxFunctionLines: number;
  maxFileLines: number;
  maxParameters: number;
  requireJsdoc: boolean;
  forbiddenPatterns: string[];
}

export interface ModificationRules {
  protectedFiles: string[];
  protectedDirectories: string[];
  requireApproval: ApprovalRule[];
}

export interface ApprovalRule {
  pattern: string;
  reason: string;
}

// ============================================================================
// 约束违规类型
// ============================================================================

export interface ConstraintViolation {
  type: ViolationSeverity;
  rule: string;
  message: string;
  location?: string;
  suggestion?: string;
}

// ============================================================================
// MCP 工具相关类型
// ============================================================================

/**
 * MCP 工具定义
 */
export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, MCPPropertySchema>;
    required?: string[];
  };
}

export interface MCPPropertySchema {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
  items?: MCPPropertySchema;
  properties?: Record<string, MCPPropertySchema>;
}

/**
 * 文件补丁操作
 */
export interface FilePatch {
  operation: 'replace' | 'insert' | 'delete';
  startLine: number;
  endLine?: number;
  content?: string;
}

/**
 * 补丁应用结果
 */
export interface PatchResult {
  success: boolean;
  diff: string;
  validation: {
    syntaxValid: boolean;
    lintErrors: LintError[];
    typeErrors: TypeError[];
  };
  snapshotId: string;
}

export interface LintError {
  line: number;
  column: number;
  message: string;
  rule: string;
  severity: 'error' | 'warning';
}

export interface TypeError {
  line: number;
  column: number;
  message: string;
  code: number;
}

// ============================================================================
// 页面结构类型
// ============================================================================

/**
 * DOM 节点
 */
export interface DOMNode {
  tag: string;
  id?: string;
  className?: string;
  text?: string;
  attributes: Record<string, string>;
  children: DOMNode[];
  boundingBox?: BoundingBox;
}

/**
 * Accessibility Tree 节点
 */
export interface AXNode {
  role: string;
  name?: string;
  value?: string;
  description?: string;
  focused?: boolean;
  disabled?: boolean;
  children?: AXNode[];
}

/**
 * 可交互元素
 */
export interface InteractiveElement {
  selector: string;
  type: 'button' | 'link' | 'input' | 'select' | 'textarea' | 'checkbox' | 'radio';
  text?: string;
  ariaLabel?: string;
  boundingBox: BoundingBox;
  enabled: boolean;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============================================================================
// 幻觉防控类型
// ============================================================================

/**
 * 幻觉检查结果
 */
export interface HallucinationCheckResult {
  pass: boolean;
  type: string;
  severity: 'block' | 'warn' | 'info';
  message?: string;
  details?: unknown;
}

/**
 * 校验结果汇总
 */
export interface ValidationResult {
  pass: boolean;
  results: HallucinationCheckResult[];
  blockedBy?: string[];
  warnings?: string[];
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 生成唯一 ID
 */
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

/**
 * 延迟执行
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 安全的 JSON 解析
 */
export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * 深度合并对象
 */
export function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = result[key];
      if (
        sourceValue !== null &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue !== null &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        result[key] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        ) as T[Extract<keyof T, string>];
      } else {
        result[key] = sourceValue as T[Extract<keyof T, string>];
      }
    }
  }
  return result;
}

/**
 * 路径规范化
 */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

/**
 * 检查路径是否匹配 glob 模式
 */
export function matchGlob(path: string, pattern: string): boolean {
  const regexPattern = pattern
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/{{GLOBSTAR}}/g, '.*');
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(normalizePath(path));
}

