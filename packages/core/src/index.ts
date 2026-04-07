/**
 * @frontagent/core - FrontAgent 核心模块
 */

export { FrontAgent, createAgent } from './agent.js';
export { Planner, createPlanner, type PlannerConfig } from './planner.js';
export { Executor, createExecutor, type ExecutorConfig, type MCPClient } from './executor.js';
export { ContextManager, createContextManager } from './context.js';
export {
  A2A_PROTOCOL_NAME,
  A2A_PROTOCOL_VERSION,
  InMemoryA2ABus,
  type A2AEnvelope,
  type A2ARequest,
  type A2AResponse,
  type A2AAgent
} from './a2a.js';
export {
  CodeQualitySubAgent,
  type CodeQualitySubAgentOptions,
  ProcessIsolatedCodeQualitySubAgent,
  type ProcessIsolatedCodeQualitySubAgentOptions,
  type CodeQualityReviewFile,
  type CodeQualityIssue,
  type CodeQualityReviewRequest,
  type CodeQualityReviewResponse
} from './sub-agents/index.js';
export {
  LLMService,
  createLLMService,
  type GeneratedPlan,
  type GeneratedCode,
  type GeneratedPatch
} from './llm.js';
export { MemoryStore } from './memory/index.js';
export type {
  MemoryConfig,
  MemoryIndex,
  MemoryTopicMeta,
  MemoryTopic,
  MemoryEntry,
  PersistenceInput,
  RecallQuery,
  RecalledMemory,
} from './memory/index.js';
export { SkillLab } from './skill-lab/index.js';
export {
  PlannerSkillRegistry,
  createDefaultPlannerSkillRegistry,
  ExecutorSkillRegistry,
  createDefaultExecutorSkillRegistry,
  type DefaultPlannerSkillCallbacks,
} from './skills/index.js';
export type {
  PlannerContextSnapshot,
  PlannerStepFactory,
  TaskPlanningSkill,
  PhaseInjectionSkill,
  PlannerSkillsLayerSnapshot,
  ExecutorActionSkill,
  ExecutorSkillRuntime,
  ExecutorSkillsLayerSnapshot,
  ExecutorStepContextSnapshot,
} from './skills/index.js';

export type {
  AgentConfig,
  AgentExecutionConfig,
  LLMConfig,
  MCPConfig,
  RagConfig,
  SkillContentConfig,
  HallucinationGuardConfig,
  SubAgentConfig,
  AgentContext,
  ContextInfo,
  Message,
  ToolCall,
  ToolResult,
  PlannerOutput,
  ContextRequest,
  ExecutorOutput,
  AgentExecutionResult,
  AgentEvent,
  AgentEventListener,
  ProjectFactError,
  ProjectFacts,
  ProjectFactsSnapshot,
  ProjectFactsUpdate,
  ProjectFactsMergeResult
} from './types.js';
export type {
  SkillLabConfig,
  SkillLabSkillSummary,
  SkillTriggerEvalCase,
  SkillTriggerEvalSuite,
  SkillBehaviorExpectation,
  SkillBehaviorEvalCheck,
  SkillBehaviorEvalCase,
  SkillBehaviorEvalSuite,
  SkillTriggerEvalCaseResult,
  SkillTriggerBenchmark,
  SkillTriggerBenchmarkSummary,
  SkillBehaviorCheckResult,
  SkillBehaviorEvalCaseResult,
  SkillBehaviorBenchmark,
  SkillBehaviorBenchmarkSummary,
  SkillLabInitResult,
  SkillLabBehaviorInitResult,
  SkillLabScaffoldResult,
  SkillLabBenchmarkResult,
  SkillLabImproveOptions,
  SkillLabImproveResult,
  SkillLabPromotionResult,
  SkillBenchmarkComparison,
  SkillBehaviorComparison,
} from './skill-lab/types.js';
