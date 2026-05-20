/**
 * @frontagent/shared - Shared types and utilities
 */

// Types - Task & Execution
export type {
  TaskType,
  StepStatus,
  ViolationSeverity,
  ActionType,
  ValidationType,
  AgentTask,
  TaskContext,
  ExecutionPlan,
  ExecutionPhase,
  ExecutionStep,
  StepResult,
  RollbackStrategy,
  ValidationRule,
  ConstraintViolation,
} from './types/task.js';

// Types - SDD
export type {
  SDDConfig,
  ProjectConfig,
  TechStackConfig,
  DirectoryStructureConfig,
  DirectoryRule,
  ModuleBoundary,
  NamingConventions,
  CodeQualityConfig,
  ModificationRules,
  ApprovalRule,
} from './types/sdd.js';

// Types - MCP
export type {
  MCPToolDefinition,
  MCPPropertySchema,
  FilePatch,
  PatchResult,
  LintError,
  TypeError,
} from './types/mcp.js';

// Types - Page structure
export type { DOMNode, AXNode, InteractiveElement, BoundingBox } from './types/page.js';

// Types - Validation / Hallucination
export type { HallucinationCheckResult, ValidationResult } from './types/validation.js';

// Security types
export type {
  SecurityMode,
  SecurityDecisionOutcome,
  SecurityRiskLevel,
  SecurityRuleSource,
  SecurityRuleProvenance,
  SecurityConfig,
  SecurityDecision,
  ApprovalRequest,
} from './security/types.js';

// Security - Shell analysis
export type {
  ShellCommandAnalysis,
  DangerousShellCommandResult,
} from './security/shell-analysis.js';
export {
  analyzeShellCommand,
  detectDangerousShellCommand,
  isCommonValidationCommand,
  isInstallCommand,
} from './security/shell-analysis.js';

// Utilities
export {
  DEFAULT_LLM_TEMPERATURE,
  DEFAULT_LLM_MAX_TOKENS,
  generateId,
  delay,
  safeJsonParse,
  deepMerge,
  normalizePath,
  matchGlob,
} from './utils.js';
