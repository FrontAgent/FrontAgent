/**
 * @frontagent/core - FrontAgent 核心模块
 */

export {
  A2A_PROTOCOL_NAME,
  A2A_PROTOCOL_VERSION,
  type A2AAgent,
  type A2AEnvelope,
  type A2ARequest,
  type A2AResponse,
  InMemoryA2ABus,
} from './a2a.js';
export { createAgent, FrontAgent } from './agent/index.js';
export { ContextManager, createContextManager } from './context.js';
export {
  createExecutor,
  createTraceCollector,
  Executor,
  type ExecutorConfig,
  type ExecutorStepTrace,
  type ExecutorSubStage,
  type ExecutorTraceCollector,
  type ExecutorTraceConfig,
  type ExecutorTraceSummary,
  type MCPClient,
} from './executor.js';
export {
  createLLMService,
  type GeneratedCode,
  type GeneratedPatch,
  type GeneratedPlan,
  LLMService,
} from './llm/index.js';
export type {
  MemoryConfig,
  MemoryEntry,
  MemoryIndex,
  MemoryTopic,
  MemoryTopicMeta,
  PersistenceInput,
  RecalledMemory,
  RecallQuery,
} from './memory/index.js';
export { MemoryStore } from './memory/index.js';
export { createPlanner, Planner, type PlannerConfig } from './planner.js';
export {
  type NormalizedSecurityConfig,
  normalizeSecurity,
  type SecurityEvaluationInput,
  SecurityManager,
  toApprovalRequest,
} from './security.js';
export { SkillLab } from './skill-lab/index.js';
export type {
  SkillBehaviorBenchmark,
  SkillBehaviorBenchmarkSummary,
  SkillBehaviorCheckResult,
  SkillBehaviorComparison,
  SkillBehaviorEvalCase,
  SkillBehaviorEvalCaseResult,
  SkillBehaviorEvalCheck,
  SkillBehaviorEvalSuite,
  SkillBehaviorExpectation,
  SkillBenchmarkComparison,
  SkillLabBehaviorInitResult,
  SkillLabBenchmarkResult,
  SkillLabConfig,
  SkillLabImproveOptions,
  SkillLabImproveResult,
  SkillLabInitResult,
  SkillLabPromotionResult,
  SkillLabScaffoldResult,
  SkillLabSkillSummary,
  SkillTriggerBenchmark,
  SkillTriggerBenchmarkSummary,
  SkillTriggerEvalCase,
  SkillTriggerEvalCaseResult,
  SkillTriggerEvalSuite,
} from './skill-lab/types.js';
export type {
  ExecutorActionSkill,
  ExecutorSkillRuntime,
  ExecutorSkillsLayerSnapshot,
  ExecutorStepContextSnapshot,
  PhaseInjectionSkill,
  PlannerContextSnapshot,
  PlannerSkillsLayerSnapshot,
  PlannerStepFactory,
  TaskPlanningSkill,
} from './skills/index.js';
export {
  createDefaultExecutorSkillRegistry,
  createDefaultPlannerSkillRegistry,
  type DefaultPlannerSkillCallbacks,
  ExecutorSkillRegistry,
  PlannerSkillRegistry,
} from './skills/index.js';
export {
  type CodeQualityIssue,
  type CodeQualityReviewFile,
  type CodeQualityReviewRequest,
  type CodeQualityReviewResponse,
  CodeQualitySubAgent,
  type CodeQualitySubAgentOptions,
  ProcessIsolatedCodeQualitySubAgent,
  type ProcessIsolatedCodeQualitySubAgentOptions,
} from './sub-agents/index.js';
export type {
  AgentConfig,
  AgentContext,
  AgentEvent,
  AgentEventListener,
  AgentExecutionConfig,
  AgentExecutionResult,
  AgentPlanResult,
  AgentSecurityConfig,
  ContextInfo,
  ContextRequest,
  ExecutorOutput,
  FilesenseConfig,
  HallucinationGuardConfig,
  LLMBackend,
  LLMConfig,
  LLMGenerateObjectOptions,
  LLMGenerateTextOptions,
  MCPConfig,
  Message,
  PlannerOutput,
  ProjectFactError,
  ProjectFacts,
  ProjectFactsMergeResult,
  ProjectFactsSnapshot,
  ProjectFactsUpdate,
  RagConfig,
  SkillContentConfig,
  SubAgentConfig,
  ToolCall,
  ToolResult,
} from './types.js';
