/**
 * @frontagent/sdd - SDD 控制层
 *
 * 提供 SDD (Specification Driven Development) 的解析、验证和约束生成功能
 * 融合 Spec Kit + Superpowers + OpenSpec 的规格驱动工作流引擎
 */

// Re-export shared types
export type {
  ApprovalRule,
  CodeQualityConfig,
  ConstraintViolation,
  DirectoryRule,
  DirectoryStructureConfig,
  ModificationRules,
  ModuleBoundary,
  NamingConventions,
  ProjectConfig,
  SDDConfig,
  TechStackConfig,
} from '@frontagent/shared';
// Artifacts — 产物持久化
export {
  type Artifact,
  type ArtifactMeta,
  type ArtifactRef,
  type ArtifactStatus,
  type ArtifactStore,
  type ArtifactType,
  createFileArtifactStore,
  FileArtifactStore,
} from './artifacts/index.js';
// Constitution — 项目原则层 (Tier 1)
export {
  type BehaviorDirective,
  type Constitution,
  ConstitutionParser,
  ConstitutionPromptGenerator,
  createConstitutionParser,
  createConstitutionPromptGenerator,
  type Principle,
  type PrinciplePriority,
  type ReviewCriterion,
} from './constitution/index.js';
export { createSDDParser, type ParseResult, SDDParser } from './parser.js';
export {
  createPromptGenerator,
  type PromptGeneratorOptions,
  SDDPromptGenerator,
} from './prompt-generator.js';
// Quality — 计划质量 + 一致性分析
export {
  BUILT_IN_RULES,
  ConsistencyAnalyzer,
  type ConsistencyCheckInput,
  type ConsistencyIssue,
  type ConsistencyResult,
  createConsistencyAnalyzer,
  createPlanQualityValidator,
  GRANULARITY_RULE,
  HAS_CONCRETE_OUTPUT_RULE,
  NO_PLACEHOLDERS_RULE,
  type PlanQualityResult,
  type PlanQualityRule,
  PlanQualityValidator,
  type PlanQualityViolation,
  SINGLE_ACTION_RULE,
  type TaskStep,
} from './quality/index.js';
export { defaultSDDConfig, SDDSchema } from './schema.js';
export {
  type AgentAction,
  createSDDValidator,
  SDDValidator,
  type ValidationResult,
} from './validator.js';
// Verification — 验证纪律
export {
  createVerificationCollector,
  createVerificationEvaluator,
  DEFAULT_VERIFICATION_POLICY,
  type EvidenceType,
  VerificationCollector,
  VerificationEvaluator,
  type VerificationEvidence,
  type VerificationPolicy,
  type VerificationResult,
} from './verification/index.js';

// Workflow — 规格驱动工作流引擎 (Tier 3)
export {
  applyAnswersToSpec,
  BUILT_IN_CHECKLISTS,
  type ChecklistCategory,
  type ChecklistEvaluator,
  type ChecklistItem,
  type ChecklistItemResult,
  type ChecklistResult,
  type ChecklistResultRef,
  ChecklistValidator,
  type ClarifyAnswer,
  type ClarifyQuestion,
  type ClarifyRoundResult,
  computeCriticalPath,
  createChecklistValidator,
  createWorkflowEngine,
  DEFAULT_WORKFLOW_CONFIG,
  evaluateVerification,
  extractFilePaths,
  extractSpecTitle,
  extractStepCount,
  generateClarifyPrompt,
  generatePlanPrompt,
  generateSpecPrompt,
  generateTasksPrompt,
  generateVerifyPrompt,
  isResolved,
  type PhaseGuard,
  type PhaseGuardResult,
  type PhaseTransition,
  type PlanInput,
  type PlanOutput,
  parseClarifyQuestions,
  parseTaskList,
  type SpecifyInput,
  type SpecifyOutput,
  type TaskDecomposition,
  type TaskItem,
  type VerifyInput,
  type VerifyOutput,
  type WorkflowConfig,
  WorkflowEngine,
  type WorkflowEngineOptions,
  type WorkflowPhase,
  type WorkflowState,
} from './workflow/index.js';
