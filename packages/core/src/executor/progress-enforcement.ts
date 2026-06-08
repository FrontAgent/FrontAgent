import type { AgentTask, ExecutionStep } from '@frontagent/shared';
import type { ExecutorOutput } from '../types.js';
import type { ExecutorCollectedContext } from './types.js';

export interface ExecuteStepsWithProgressDeps {
  executeStep(
    step: ExecutionStep,
    context: { task: AgentTask; collectedContext: ExecutorCollectedContext },
  ): Promise<ExecutorOutput>;
}

export async function executeStepsWithProgressEnforcement(
  steps: ExecutionStep[],
  context: { task: AgentTask; collectedContext: ExecutorCollectedContext },
  deps: ExecuteStepsWithProgressDeps,
  onStepComplete?: (step: ExecutionStep, output: ExecutorOutput) => void,
): Promise<ExecutorOutput[]> {
  const results: ExecutorOutput[] = [];
  const completedSteps = new Set<string>();
  const pendingSteps = [...steps];

  while (pendingSteps.length > 0) {
    const executableIndex = pendingSteps.findIndex((step) =>
      step.dependencies.every((dep) => completedSteps.has(dep)),
    );

    if (executableIndex === -1) {
      throw new Error('Circular dependency detected or missing dependency');
    }

    const step = pendingSteps.splice(executableIndex, 1)[0];
    step.status = 'running';

    const output = await deps.executeStep(step, context);
    step.result = output.stepResult;
    step.status = output.stepResult.success ? 'completed' : 'failed';

    results.push(output);
    completedSteps.add(step.stepId);
    onStepComplete?.(step, output);

    if (!output.stepResult.success && output.needsRollback) {
      for (const pending of pendingSteps) {
        pending.status = 'skipped';
      }
      break;
    }
  }

  return results;
}
