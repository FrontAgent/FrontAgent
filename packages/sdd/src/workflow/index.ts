/**
 * Workflow 模块
 */

export { BUILT_IN_CHECKLISTS } from './checklist/built-in.js';
export type {
  ChecklistCategory,
  ChecklistEvaluator,
  ChecklistItem,
  ChecklistItemResult,
  ChecklistResult,
} from './checklist/types.js';
export {
  ChecklistValidator,
  createChecklistValidator,
} from './checklist/validator.js';
export { createWorkflowEngine, WorkflowEngine, type WorkflowEngineOptions } from './engine.js';
export {
  applyAnswersToSpec,
  type ClarifyAnswer,
  type ClarifyQuestion,
  type ClarifyRoundResult,
  generateClarifyPrompt,
  isResolved,
  parseClarifyQuestions,
} from './phases/clarify.js';
export {
  extractFilePaths,
  extractStepCount,
  generatePlanPrompt,
  type PlanInput,
  type PlanOutput,
} from './phases/plan.js';

export {
  extractSpecTitle,
  generateSpecPrompt,
  type SpecifyInput,
  type SpecifyOutput,
} from './phases/specify.js';
export {
  computeCriticalPath,
  generateTasksPrompt,
  parseTaskList,
  type TaskDecomposition,
  type TaskItem,
} from './phases/tasks.js';
export {
  evaluateVerification,
  generateVerifyPrompt,
  type VerifyInput,
  type VerifyOutput,
} from './phases/verify.js';
export type {
  ChecklistResultRef,
  PhaseGuard,
  PhaseGuardResult,
  PhaseGuardType,
  PhaseTransition,
  WorkflowConfig,
  WorkflowPhase,
  WorkflowState,
} from './types.js';
export { DEFAULT_WORKFLOW_CONFIG } from './types.js';
