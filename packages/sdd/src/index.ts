/**
 * @frontagent/sdd - SDD 控制层
 *
 * 提供 SDD (Specification Driven Development) 的解析、验证和约束生成功能
 * 融合 Spec Kit + Superpowers + OpenSpec 的规格驱动工作流引擎
 */

export { SDDParser, createSDDParser, type ParseResult } from './parser.js';
export {
  SDDValidator,
  createSDDValidator,
  type AgentAction,
  type ValidationResult,
} from './validator.js';
export {
  SDDPromptGenerator,
  createPromptGenerator,
  type PromptGeneratorOptions,
} from './prompt-generator.js';
export { SDDSchema, defaultSDDConfig } from './schema.js';

// Re-export shared types
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
  ConstraintViolation,
} from '@frontagent/shared';

// Constitution — 项目原则层 (Tier 1)
export {
  ConstitutionParser,
  createConstitutionParser,
  ConstitutionPromptGenerator,
  createConstitutionPromptGenerator,
  type Constitution,
  type Principle,
  type BehaviorDirective,
  type ReviewCriterion,
  type PrinciplePriority,
} from './constitution/index.js';

// Artifacts — 产物持久化
export {
  FileArtifactStore,
  createFileArtifactStore,
  type Artifact,
  type ArtifactMeta,
  type ArtifactRef,
  type ArtifactType,
  type ArtifactStatus,
  type ArtifactStore,
} from './artifacts/index.js';

// Verification — 验证纪律
export {
  VerificationCollector,
  createVerificationCollector,
  VerificationEvaluator,
  createVerificationEvaluator,
  DEFAULT_VERIFICATION_POLICY,
  type VerificationEvidence,
  type VerificationResult,
  type VerificationPolicy,
  type EvidenceType,
} from './verification/index.js';

// Quality — 计划质量 + 一致性分析
export {
  PlanQualityValidator,
  createPlanQualityValidator,
  ConsistencyAnalyzer,
  createConsistencyAnalyzer,
  NO_PLACEHOLDERS_RULE,
  GRANULARITY_RULE,
  SINGLE_ACTION_RULE,
  HAS_CONCRETE_OUTPUT_RULE,
  BUILT_IN_RULES,
  type TaskStep,
  type PlanQualityViolation,
  type PlanQualityResult,
  type PlanQualityRule,
  type ConsistencyCheckInput,
  type ConsistencyIssue,
  type ConsistencyResult,
} from './quality/index.js';

// Workflow — 规格驱动工作流引擎 (Tier 3)
export {
  WorkflowEngine,
  createWorkflowEngine,
  ChecklistValidator,
  createChecklistValidator,
  BUILT_IN_CHECKLISTS,
  DEFAULT_WORKFLOW_CONFIG,
  generateSpecPrompt,
  generateClarifyPrompt,
  generatePlanPrompt,
  generateTasksPrompt,
  generateVerifyPrompt,
  evaluateVerification,
  parseClarifyQuestions,
  isResolved,
  applyAnswersToSpec,
  extractSpecTitle,
  extractStepCount,
  extractFilePaths,
  parseTaskList,
  computeCriticalPath,
  type WorkflowEngineOptions,
  type WorkflowPhase,
  type WorkflowState,
  type WorkflowConfig,
  type PhaseGuard,
  type PhaseGuardResult,
  type PhaseTransition,
  type ChecklistResultRef,
  type ChecklistItem,
  type ChecklistItemResult,
  type ChecklistResult,
  type ChecklistEvaluator,
  type ChecklistCategory,
  type SpecifyInput,
  type SpecifyOutput,
  type ClarifyQuestion,
  type ClarifyAnswer,
  type ClarifyRoundResult,
  type PlanInput,
  type PlanOutput,
  type TaskItem,
  type TaskDecomposition,
  type VerifyInput,
  type VerifyOutput,
} from './workflow/index.js';
