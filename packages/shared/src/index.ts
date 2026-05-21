/**
 * @frontagent/shared - Shared types and utilities
 */

// Logger
export { getLogLevel, type LogLevel, logger, setLogLevel } from './logger.js';
// Security - Shell analysis
export type {
  DangerousShellCommandResult,
  ShellCommandAnalysis,
} from './security/shell-analysis.js';
export {
  analyzeShellCommand,
  detectDangerousShellCommand,
  isCommonValidationCommand,
  isInstallCommand,
} from './security/shell-analysis.js';
// Security types
export type {
  ApprovalRequest,
  SecurityConfig,
  SecurityDecision,
  SecurityDecisionOutcome,
  SecurityMode,
  SecurityRiskLevel,
  SecurityRuleProvenance,
  SecurityRuleSource,
} from './security/types.js';
// Types - MCP
export type {
  FilePatch,
  LintError,
  MCPPropertySchema,
  MCPToolDefinition,
  PatchResult,
  TypeError,
} from './types/mcp.js';
// Types - Page structure
export type { AXNode, BoundingBox, DOMNode, InteractiveElement } from './types/page.js';
// Types - SDD
export type {
  ApprovalRule,
  CodeQualityConfig,
  DirectoryRule,
  DirectoryStructureConfig,
  ModificationRules,
  ModuleBoundary,
  NamingConventions,
  ProjectConfig,
  SDDConfig,
  TechStackConfig,
} from './types/sdd.js';
// Types - Task & Execution
export type {
  ActionType,
  AgentTask,
  ConstraintViolation,
  ExecutionPhase,
  ExecutionPlan,
  ExecutionStep,
  RollbackStrategy,
  StepResult,
  StepStatus,
  TaskContext,
  TaskType,
  ValidationRule,
  ValidationType,
  ViolationSeverity,
} from './types/task.js';
// Types - Validation / Hallucination
export type { HallucinationCheckResult, ValidationResult } from './types/validation.js';
// Utilities
export {
  DEFAULT_LLM_MAX_TOKENS,
  DEFAULT_LLM_TEMPERATURE,
  deepMerge,
  delay,
  escapeRegex,
  generateId,
  matchGlob,
  normalizePath,
  safeJsonParse,
} from './utils.js';
