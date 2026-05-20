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
  | 'create' // 创建新文件/组件
  | 'modify' // 修改现有代码
  | 'debug' // 调试问题
  | 'query' // 查询信息
  | 'refactor' // 重构代码
  | 'test'; // 测试相关

/**
 * 执行步骤状态
 */
export type StepStatus =
  | 'pending' // 待执行
  | 'running' // 执行中
  | 'completed' // 已完成
  | 'failed' // 失败
  | 'skipped' // 跳过
  | 'rolled_back'; // 已回滚

/**
 * 约束违规级别
 */
export type ViolationSeverity = 'error' | 'warning' | 'info';

/**
 * Security posture for model-triggered tool execution.
 */
export type SecurityMode = 'balanced' | 'strict' | 'developer';

export type SecurityDecisionOutcome = 'allow' | 'ask' | 'deny';

export type SecurityRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type SecurityRuleSource = 'builtin' | 'sdd' | 'runtime';

export interface SecurityRuleProvenance {
  source: SecurityRuleSource;
  ruleId: string;
  mutable?: boolean;
  details?: string;
}

export interface SecurityConfig {
  /** Default: balanced */
  mode?: SecurityMode;
  /** Whether a human approval surface is available. Default: false */
  interactive?: boolean;
  /** Whether security decisions should be emitted for audit/debug. Default: true */
  auditEnabled?: boolean;
}

export interface SecurityDecision {
  decision: SecurityDecisionOutcome;
  riskLevel: SecurityRiskLevel;
  reasonCode: string;
  message: string;
  toolName: string;
  argsSummary: string;
  provenance: SecurityRuleProvenance[];
  approvalId?: string;
}

export interface ApprovalRequest extends SecurityDecision {
  decision: 'ask';
  approvalId: string;
  createdAt: string;
}

export interface ShellCommandAnalysis {
  command: string;
  structurallyTrusted: boolean;
  needsShell: boolean;
  argv: string[];
  commandName?: string;
  reasonCode?: string;
  reason?: string;
}

export interface DangerousShellCommandResult {
  dangerous: boolean;
  reasonCode?: string;
  reason?: string;
}

const SHELL_OPERATOR_PATTERNS: Array<{ pattern: RegExp; reasonCode: string; reason: string }> = [
  {
    pattern: /\|\|?/,
    reasonCode: 'shell_operator',
    reason: 'Shell pipes require full-command review.',
  },
  {
    pattern: /&&/,
    reasonCode: 'shell_operator',
    reason: 'Compound shell operators require full-command review.',
  },
  {
    pattern: /[<>]/,
    reasonCode: 'shell_redirect',
    reason: 'Shell redirects can read or write paths outside argument parsing.',
  },
  {
    pattern: /;/,
    reasonCode: 'shell_sequence',
    reason: 'Command sequences are context-coupled and require review.',
  },
  {
    pattern: /\r|\n/,
    reasonCode: 'shell_multiline',
    reason: 'Multiline shell commands require review.',
  },
  {
    pattern: /\$\(/,
    reasonCode: 'shell_substitution',
    reason: 'Command substitution requires review.',
  },
  {
    pattern: /`/,
    reasonCode: 'shell_substitution',
    reason: 'Backtick command substitution requires review.',
  },
];

function splitSimpleShellCommand(command: string): { tokens: string[]; error?: string } {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | undefined;
  let escaping = false;

  for (const char of command) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === '\\' && quote !== "'") {
      escaping = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = undefined;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (escaping) {
    current += '\\';
  }

  if (quote) {
    return { tokens: [], error: 'Unclosed shell quote.' };
  }

  if (current) {
    tokens.push(current);
  }

  return { tokens };
}

export function analyzeShellCommand(command: string): ShellCommandAnalysis {
  const trimmed = command.trim();
  if (!trimmed) {
    return {
      command,
      structurallyTrusted: false,
      needsShell: false,
      argv: [],
      reasonCode: 'empty_command',
      reason: 'Command is empty.',
    };
  }

  for (const operator of SHELL_OPERATOR_PATTERNS) {
    if (operator.pattern.test(trimmed)) {
      return {
        command,
        structurallyTrusted: false,
        needsShell: true,
        argv: [],
        reasonCode: operator.reasonCode,
        reason: operator.reason,
      };
    }
  }

  const parsed = splitSimpleShellCommand(trimmed);
  if (parsed.error) {
    return {
      command,
      structurallyTrusted: false,
      needsShell: true,
      argv: [],
      reasonCode: 'shell_parse_error',
      reason: parsed.error,
    };
  }

  const [commandName, ...rest] = parsed.tokens;
  if (!commandName) {
    return {
      command,
      structurallyTrusted: false,
      needsShell: false,
      argv: [],
      reasonCode: 'empty_command',
      reason: 'Command is empty.',
    };
  }

  if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(commandName)) {
    return {
      command,
      structurallyTrusted: false,
      needsShell: true,
      argv: parsed.tokens,
      reasonCode: 'shell_env_assignment',
      reason: 'Inline environment assignments require shell semantics.',
    };
  }

  return {
    command,
    structurallyTrusted: true,
    needsShell: false,
    argv: [commandName, ...rest],
    commandName,
  };
}

function commandIncludesPipeToInterpreter(command: string): boolean {
  return /\b(curl|wget)\b[\s\S]*\|[\s\S]*\b(sh|bash|zsh|node|python|python3|ruby|perl)\b/i.test(
    command,
  );
}

function hasRecursiveFlag(argv: string[]): boolean {
  return argv.some((arg) => /^-[A-Za-z]*[Rr][A-Za-z]*$/.test(arg) || arg === '--recursive');
}

export function detectDangerousShellCommand(
  command: string,
  analysis: ShellCommandAnalysis = analyzeShellCommand(command),
): DangerousShellCommandResult {
  const normalized = command.trim();

  if (commandIncludesPipeToInterpreter(normalized)) {
    return {
      dangerous: true,
      reasonCode: 'shell_pipe_to_interpreter',
      reason: 'Piping downloaded content into an interpreter is blocked.',
    };
  }

  const commandName = analysis.commandName ?? analysis.argv[0];
  if (!commandName) {
    return { dangerous: false };
  }

  const base = commandName.split('/').pop() ?? commandName;
  const args = analysis.argv.slice(1);

  if (['sudo', 'su', 'doas'].includes(base)) {
    return {
      dangerous: true,
      reasonCode: 'shell_privilege_escalation',
      reason: 'Privilege escalation commands are blocked.',
    };
  }

  if (
    base === 'rm' &&
    args.some((arg) =>
      /^-[A-Za-z]*r[A-Za-z]*f[A-Za-z]*$|^-[A-Za-z]*f[A-Za-z]*r[A-Za-z]*$/i.test(arg),
    )
  ) {
    return {
      dangerous: true,
      reasonCode: 'shell_dangerous_delete',
      reason: 'Recursive forced deletion is blocked.',
    };
  }

  if (base === 'rm' && args.some((arg) => arg === '/' || arg === '~' || arg === '$HOME')) {
    return {
      dangerous: true,
      reasonCode: 'shell_dangerous_delete',
      reason: 'Deletion targeting a root or home directory is blocked.',
    };
  }

  if (['chmod', 'chown', 'chgrp'].includes(base) && hasRecursiveFlag(args)) {
    return {
      dangerous: true,
      reasonCode: 'shell_recursive_permission_change',
      reason: 'Recursive permission or ownership changes are blocked.',
    };
  }

  if (base === 'find' && args.includes('-delete')) {
    return {
      dangerous: true,
      reasonCode: 'shell_find_delete',
      reason: 'find -delete is blocked.',
    };
  }

  return { dangerous: false };
}

export function isCommonValidationCommand(analysis: ShellCommandAnalysis): boolean {
  if (!analysis.structurallyTrusted) return false;

  const [commandName, firstArg] = analysis.argv;
  const base = commandName?.split('/').pop();
  if (!base) return false;

  if (base === 'git') {
    return ['status', 'diff', 'show', 'log', 'rev-parse'].includes(firstArg ?? '');
  }

  if (['pnpm', 'npm', 'yarn', 'bun'].includes(base)) {
    return ['test', 'typecheck', 'build', 'lint'].includes(firstArg ?? '');
  }

  return false;
}

export function isInstallCommand(analysis: ShellCommandAnalysis): boolean {
  if (!analysis.structurallyTrusted) return false;

  const [commandName, firstArg] = analysis.argv;
  const base = commandName?.split('/').pop();
  if (!base) return false;

  if (base === 'npx') return true;
  if (base === 'npm') return ['install', 'i', 'add'].includes(firstArg ?? '');
  if (base === 'pnpm') return ['install', 'i', 'add'].includes(firstArg ?? '');
  if (base === 'yarn') return ['install', 'add'].includes(firstArg ?? '');
  if (base === 'bun') return ['install', 'add'].includes(firstArg ?? '');

  return false;
}

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
  /** 计划的阶段划分（可选） */
  phases?: ExecutionPhase[];
  estimatedDuration?: number;
  rollbackStrategy: RollbackStrategy;
}

/**
 * 执行阶段
 */
export interface ExecutionPhase {
  /** 阶段ID */
  phaseId: string;
  /** 阶段名称 */
  name: string;
  /** 阶段描述 */
  description: string;
  /** 该阶段包含的步骤索引 */
  stepIndices: number[];
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
  /** 所属阶段（可选） */
  phase?: string;
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
  | 'run_command'
  | 'browser_navigate'
  | 'browser_click'
  | 'browser_type'
  | 'browser_screenshot'
  | 'get_page_structure'
  | 'filesense_sync_and_summarize'
  | 'filesense_query'
  | 'filesense_navigate';

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
  // 可选字段：允许扩展
  requiredPackages?: string[];
  uiLibrary?: string;
  uiLibraryVersion?: string;
  routing?: string;
  buildTool?: string;
  [key: string]: any; // 允许任意扩展字段
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
  error?: string;
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

export const DEFAULT_LLM_TEMPERATURE = 0.2;
export const DEFAULT_LLM_MAX_TOKENS = 4096;

/**
 * 生成唯一 ID
 */
export function generateId(prefix = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

/**
 * 延迟执行
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      if (sourceValue === undefined) continue;
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
          sourceValue as Record<string, unknown>,
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
    .replace(/\*\*/g, '\0GLOBSTAR\0')
    .replace(/\*/g, '\0STAR\0')
    .replace(/\?/g, '\0QUESTION\0')
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\0GLOBSTAR\0/g, '.*')
    .replace(/\0STAR\0/g, '[^/]*')
    .replace(/\0QUESTION\0/g, '[^/]');
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(normalizePath(path));
}
