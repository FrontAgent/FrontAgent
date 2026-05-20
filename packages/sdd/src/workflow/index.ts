/**
 * Workflow 模块
 */

export { WorkflowEngine, createWorkflowEngine, type WorkflowEngineOptions } from './engine.js';

export type {
  WorkflowPhase,
  WorkflowState,
  WorkflowConfig,
  PhaseGuard,
  PhaseGuardResult,
  PhaseTransition,
  ChecklistResultRef,
  PhaseGuardType,
} from './types.js';

export { DEFAULT_WORKFLOW_CONFIG } from './types.js';

export {
  ChecklistValidator,
  createChecklistValidator,
} from './checklist/validator.js';

export type {
  ChecklistItem,
  ChecklistItemResult,
  ChecklistResult,
  ChecklistEvaluator,
  ChecklistCategory,
} from './checklist/types.js';

export { BUILT_IN_CHECKLISTS } from './checklist/built-in.js';

export {
  generateSpecPrompt,
  extractSpecTitle,
  type SpecifyInput,
  type SpecifyOutput,
} from './phases/specify.js';

export {
  generateClarifyPrompt,
  parseClarifyQuestions,
  isResolved,
  applyAnswersToSpec,
  type ClarifyQuestion,
  type ClarifyAnswer,
  type ClarifyRoundResult,
} from './phases/clarify.js';

export {
  generatePlanPrompt,
  extractStepCount,
  extractFilePaths,
  type PlanInput,
  type PlanOutput,
} from './phases/plan.js';

export {
  generateTasksPrompt,
  parseTaskList,
  computeCriticalPath,
  type TaskItem,
  type TaskDecomposition,
} from './phases/tasks.js';

export {
  generateVerifyPrompt,
  evaluateVerification,
  type VerifyInput,
  type VerifyOutput,
} from './phases/verify.js';
