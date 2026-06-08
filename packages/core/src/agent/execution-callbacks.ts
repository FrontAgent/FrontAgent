import type { AgentTask, ExecutionPlan, ExecutionStep, ValidationResult } from '@frontagent/shared';
import type { ContextManager } from '../context.js';
import type { ExecutorOutput } from '../types.js';
import {
  createOnPhaseComplete,
  createOnPhaseError,
  createOnStepComplete,
  type StepCallbackDeps,
} from './step-callbacks.js';

type AgentExecutionContext = NonNullable<ReturnType<ContextManager['getContext']>>;

export interface CreateExecutionCallbacksInput {
  deps: StepCallbackDeps;
  task: AgentTask;
  executionPlan: ExecutionPlan;
  executionContext: AgentExecutionContext;
  validations: ValidationResult[];
  signal?: AbortSignal;
}

export interface ExecutionCallbacks {
  onStepStarted(step: ExecutionStep): void;
  onStepComplete(step: ExecutionStep, output: ExecutorOutput): void;
  onPhaseStarted(phase: string, stepCount: number): void;
  onPhaseError(
    phase: string,
    errors: Array<{ step: ExecutionStep; error: string }>,
  ): Promise<ExecutionStep[]>;
  onPhaseComplete(
    phase: string,
    phaseResults: ExecutorOutput[],
  ): Promise<Array<{ step: ExecutionStep; error: string }>>;
}

export function createExecutionCallbacks({
  deps,
  task,
  executionPlan,
  executionContext,
  validations,
  signal,
}: CreateExecutionCallbacksInput): ExecutionCallbacks {
  return {
    onStepStarted: (step) => {
      deps.emit({ type: 'step_started', step });
    },
    onStepComplete: createOnStepComplete(deps, task, executionContext, validations),
    onPhaseStarted: (phase, stepCount) => {
      deps.emit({ type: 'phase_started', phase, stepCount });
    },
    onPhaseError: createOnPhaseError(deps, task, signal),
    onPhaseComplete: createOnPhaseComplete(deps, task, executionPlan, executionContext, signal),
  };
}
