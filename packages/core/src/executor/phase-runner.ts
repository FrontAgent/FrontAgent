import type { AgentTask, ExecutionStep } from '@frontagent/shared';
import type { ExecutorOutput } from '../types.js';
import type { ExecutorCollectedContext, PhaseExecutionGroup } from './types.js';

export interface PhaseRunnerDeps {
  executeStep(
    step: ExecutionStep,
    context: { task: AgentTask; collectedContext: ExecutorCollectedContext },
  ): Promise<ExecutorOutput>;
  debugLog(...args: unknown[]): void;
  debugWarn(...args: unknown[]): void;
  debugError(...args: unknown[]): void;
  throwIfAborted(signal?: AbortSignal): void;
  getMaxRecoveryAttempts(): number;
  createRecoveryFingerprint(errors: Array<{ step: ExecutionStep; error: string }>): string;
  parallelExecution: boolean;
}

export type PhaseCallbacks = {
  onStepStart?: (step: ExecutionStep) => void;
  onStepComplete?: (step: ExecutionStep, output: ExecutorOutput) => void;
  onPhaseStart?: (phase: string, stepCount: number) => void;
  onPhaseError?: (
    phase: string,
    errors: Array<{ step: ExecutionStep; error: string }>,
  ) => Promise<ExecutionStep[]>;
  onPhaseComplete?: (
    phase: string,
    results: ExecutorOutput[],
  ) => Promise<Array<{ step: ExecutionStep; error: string }>>;
  signal?: AbortSignal;
};

export class PhaseRunner {
  constructor(private deps: PhaseRunnerDeps) {}

  async executeSinglePhaseWithRecovery(
    phaseGroup: PhaseExecutionGroup,
    context: { task: AgentTask; collectedContext: ExecutorCollectedContext },
    completedStepIds: Set<string>,
    allResults: ExecutorOutput[],
    callbacks: PhaseCallbacks,
  ): Promise<void> {
    const { onStepStart, onStepComplete, onPhaseStart, onPhaseError, onPhaseComplete, signal } =
      callbacks;
    const phase = phaseGroup.phase;
    const phaseSteps = phaseGroup.steps;

    this.deps.debugLog('[Executor] ========================================');
    this.deps.debugLog(`[Executor] Starting phase: ${phase} (${phaseSteps.length} steps)`);

    onPhaseStart?.(phase, phaseSteps.length);
    this.deps.debugLog(
      `[Executor] 🔗 Phase dependencies: [${Array.from(phaseGroup.dependencies).join(', ') || 'none'}]`,
    );
    this.deps.debugLog('[Executor] 📋 Steps in this phase:');
    for (const s of phaseSteps) {
      this.deps.debugLog(
        `[Executor]    - ${s.stepId}: ${s.description} (deps: [${s.dependencies.join(', ') || 'none'}])`,
      );
    }
    this.deps.debugLog(
      `[Executor] 📊 Already completed steps: [${Array.from(completedStepIds).join(', ') || 'none'}]`,
    );
    this.deps.debugLog('[Executor] ----------------------------------------');

    const phaseResults: ExecutorOutput[] = [];
    const phaseErrors: Array<{ step: ExecutionStep; error: string }> = [];

    if (this.deps.parallelExecution) {
      await this.executePhaseParallel(
        phaseSteps,
        context,
        completedStepIds,
        allResults,
        phaseResults,
        phaseErrors,
        onStepStart,
        onStepComplete,
        signal,
      );
    } else {
      await this.executePhaseSequential(
        phaseSteps,
        context,
        completedStepIds,
        allResults,
        phaseResults,
        phaseErrors,
        onStepStart,
        onStepComplete,
        signal,
      );
    }

    if (onPhaseComplete) {
      try {
        this.deps.throwIfAborted(signal);
        const additionalErrors = await onPhaseComplete(phase, phaseResults);
        if (additionalErrors.length > 0) {
          this.deps.debugLog(
            `[Executor] Phase ${phase} validation found ${additionalErrors.length} additional issues`,
          );
          phaseErrors.push(...additionalErrors);
        }
      } catch (error) {
        this.deps.debugError('[Executor] Phase complete validation failed:', error);
      }
    }

    await this.runPhaseRecovery(
      phase,
      phaseSteps,
      phaseErrors,
      context,
      completedStepIds,
      allResults,
      onStepStart,
      onStepComplete,
      onPhaseError,
      onPhaseComplete,
      signal,
    );

    const phaseStats = {
      total: phaseSteps.length,
      completed: phaseSteps.filter((s) => s.status === 'completed').length,
      failed: phaseSteps.filter((s) => s.status === 'failed').length,
      skipped: phaseSteps.filter((s) => s.status === 'skipped').length,
    };
    this.deps.debugLog('[Executor] ----------------------------------------');
    this.deps.debugLog(`[Executor] Phase ${phase} completed`);
    this.deps.debugLog(
      `[Executor] 📊 Phase stats: ${phaseStats.completed}/${phaseStats.total} completed, ${phaseStats.failed} failed, ${phaseStats.skipped} skipped`,
    );
    this.deps.debugLog('[Executor] ========================================');
  }

  // PLACEHOLDER_PARALLEL

  private async executePhaseParallel(
    phaseSteps: ExecutionStep[],
    context: { task: AgentTask; collectedContext: ExecutorCollectedContext },
    completedStepIds: Set<string>,
    allResults: ExecutorOutput[],
    phaseResults: ExecutorOutput[],
    phaseErrors: Array<{ step: ExecutionStep; error: string }>,
    onStepStart?: (step: ExecutionStep) => void,
    onStepComplete?: (step: ExecutionStep, output: ExecutorOutput) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const pending = [...phaseSteps];

    while (pending.length > 0) {
      this.deps.throwIfAborted(signal);

      const ready = pending.filter((step) =>
        step.dependencies.every((dep) => completedStepIds.has(dep)),
      );

      if (ready.length === 0) {
        const skippable = pending.filter((step) =>
          step.dependencies.some((dep) => !completedStepIds.has(dep)),
        );
        for (const s of skippable) {
          this.deps.debugWarn(`[Executor] ⏭️  Skipping step ${s.stepId}: dependencies not met`);
          s.status = 'skipped';
          pending.splice(pending.indexOf(s), 1);
        }
        if (pending.length > 0 && skippable.length === 0) {
          this.deps.debugError(
            `[Executor] Circular dependency detected within phase ${phaseSteps[0]?.phase}`,
          );
          break;
        }
        continue;
      }

      for (const s of ready) pending.splice(pending.indexOf(s), 1);

      const results = await Promise.allSettled(
        ready.map(async (step) => {
          step.status = 'running';
          onStepStart?.(step);
          const output = await this.deps.executeStep(step, context);
          return { step, output };
        }),
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { step, output } = result.value;
          step.result = output.stepResult;
          step.status = output.stepResult.success ? 'completed' : 'failed';
          phaseResults.push(output);
          allResults.push(output);
          if (output.stepResult.success) {
            completedStepIds.add(step.stepId);
          } else {
            phaseErrors.push({ step, error: output.stepResult.error || 'Unknown error' });
          }
          onStepComplete?.(step, output);
        }
      }
    }
  }

  private async executePhaseSequential(
    phaseSteps: ExecutionStep[],
    context: { task: AgentTask; collectedContext: ExecutorCollectedContext },
    completedStepIds: Set<string>,
    allResults: ExecutorOutput[],
    phaseResults: ExecutorOutput[],
    phaseErrors: Array<{ step: ExecutionStep; error: string }>,
    onStepStart?: (step: ExecutionStep) => void,
    onStepComplete?: (step: ExecutionStep, output: ExecutorOutput) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    for (const step of phaseSteps) {
      this.deps.throwIfAborted(signal);
      const dependenciesMet = step.dependencies.every((dep) => completedStepIds.has(dep));
      if (!dependenciesMet) {
        const missingDeps = step.dependencies.filter((dep) => !completedStepIds.has(dep));
        this.deps.debugWarn(`[Executor] ⏭️  Skipping step ${step.stepId}: dependencies not met`);
        this.deps.debugWarn(`[Executor]    Step description: ${step.description}`);
        this.deps.debugWarn(
          `[Executor]    Required dependencies: [${step.dependencies.join(', ')}]`,
        );
        this.deps.debugWarn(`[Executor]    Missing dependencies: [${missingDeps.join(', ')}]`);
        this.deps.debugWarn(
          `[Executor]    Completed steps: [${Array.from(completedStepIds).join(', ')}]`,
        );
        step.status = 'skipped';
        continue;
      }

      step.status = 'running';
      onStepStart?.(step);
      const output = await this.deps.executeStep(step, context);
      step.result = output.stepResult;
      step.status = output.stepResult.success ? 'completed' : 'failed';

      phaseResults.push(output);
      allResults.push(output);

      if (output.stepResult.success) {
        completedStepIds.add(step.stepId);
      } else {
        phaseErrors.push({ step, error: output.stepResult.error || 'Unknown error' });
      }

      if (onStepComplete) {
        onStepComplete(step, output);
      }
    }
  }

  // PLACEHOLDER_RECOVERY

  private async runPhaseRecovery(
    phase: string,
    phaseSteps: ExecutionStep[],
    phaseErrors: Array<{ step: ExecutionStep; error: string }>,
    context: { task: AgentTask; collectedContext: ExecutorCollectedContext },
    completedStepIds: Set<string>,
    allResults: ExecutorOutput[],
    onStepStart?: (step: ExecutionStep) => void,
    onStepComplete?: (step: ExecutionStep, output: ExecutorOutput) => void,
    onPhaseError?: (
      phase: string,
      errors: Array<{ step: ExecutionStep; error: string }>,
    ) => Promise<ExecutionStep[]>,
    onPhaseComplete?: (
      phase: string,
      results: ExecutorOutput[],
    ) => Promise<Array<{ step: ExecutionStep; error: string }>>,
    signal?: AbortSignal,
  ): Promise<void> {
    const maxRecoveryAttempts = this.deps.getMaxRecoveryAttempts();
    const seenRecoveryFingerprints = new Set<string>();
    let recoveryAttempt = 0;
    let currentErrors = phaseErrors;

    while (currentErrors.length > 0 && onPhaseError && recoveryAttempt < maxRecoveryAttempts) {
      this.deps.throwIfAborted(signal);
      const recoveryFingerprint = this.deps.createRecoveryFingerprint(currentErrors);
      if (seenRecoveryFingerprints.has(recoveryFingerprint)) {
        this.deps.debugWarn(
          '[Executor] Repeated recovery error fingerprint detected, stopping recovery attempts',
        );
        break;
      }
      seenRecoveryFingerprints.add(recoveryFingerprint);

      recoveryAttempt++;
      this.deps.debugLog(
        `[Executor] Phase ${phase} has ${currentErrors.length} errors, recovery attempt ${recoveryAttempt}/${maxRecoveryAttempts}...`,
      );

      try {
        const recoverySteps = await onPhaseError(phase, currentErrors);
        if (recoverySteps.length === 0) {
          this.deps.debugLog('[Executor] No recovery steps generated, stopping recovery attempts');
          break;
        }

        this.deps.debugLog(
          `[Executor] Inserting ${recoverySteps.length} recovery steps for phase ${phase}`,
        );

        for (const recoveryStep of recoverySteps) {
          recoveryStep.phase = phase;
          phaseSteps.push(recoveryStep);
        }

        for (const recoveryStep of recoverySteps) {
          this.deps.throwIfAborted(signal);
          recoveryStep.status = 'running';
          onStepStart?.(recoveryStep);
          const output = await this.deps.executeStep(recoveryStep, context);
          recoveryStep.result = output.stepResult;
          recoveryStep.status = output.stepResult.success ? 'completed' : 'failed';
          allResults.push(output);
          if (output.stepResult.success) {
            completedStepIds.add(recoveryStep.stepId);
          }
          if (onStepComplete) {
            onStepComplete(recoveryStep, output);
          }
        }

        if (onPhaseComplete) {
          this.deps.debugLog(
            `[Executor] Re-running phase completion checks after recovery attempt ${recoveryAttempt}...`,
          );
          const previousErrors = currentErrors;
          currentErrors = [];

          try {
            this.deps.throwIfAborted(signal);
            const verificationErrors = await onPhaseComplete(phase, allResults);
            currentErrors = verificationErrors;

            if (currentErrors.length === 0) {
              this.deps.debugLog('[Executor] ✅ Recovery successful! All errors fixed.');
              for (const errorInfo of previousErrors) {
                if (errorInfo.step.status === 'failed') {
                  errorInfo.step.status = 'completed';
                  completedStepIds.add(errorInfo.step.stepId);
                }
              }

              const skippedSteps = phaseSteps.filter((s) => s.status === 'skipped');
              if (skippedSteps.length > 0) {
                this.deps.debugLog(
                  `[Executor] 🔄 Re-checking ${skippedSteps.length} skipped steps after recovery...`,
                );
                for (const skippedStep of skippedSteps) {
                  this.deps.throwIfAborted(signal);
                  const dependenciesMet = skippedStep.dependencies.every((dep) =>
                    completedStepIds.has(dep),
                  );
                  if (dependenciesMet) {
                    skippedStep.status = 'running';
                    onStepStart?.(skippedStep);
                    const output = await this.deps.executeStep(skippedStep, context);
                    skippedStep.result = output.stepResult;
                    skippedStep.status = output.stepResult.success ? 'completed' : 'failed';
                    allResults.push(output);
                    if (output.stepResult.success) {
                      completedStepIds.add(skippedStep.stepId);
                    } else {
                      currentErrors.push({
                        step: skippedStep,
                        error: output.stepResult.error || 'Unknown error',
                      });
                    }
                    if (onStepComplete) {
                      onStepComplete(skippedStep, output);
                    }
                  }
                }
              }

              if (currentErrors.length === 0) break;
              this.deps.debugLog(
                `[Executor] ⚠️  ${currentErrors.length} error(s) after re-execution, continuing recovery...`,
              );
            } else {
              this.deps.debugLog(
                `[Executor] ⚠️  Still have ${currentErrors.length} error(s) after recovery attempt ${recoveryAttempt}`,
              );
              if (recoveryAttempt >= maxRecoveryAttempts) {
                this.deps.debugWarn(
                  `[Executor] ❌ Max recovery attempts (${maxRecoveryAttempts}) reached. Stopping recovery.`,
                );
              }
            }
          } catch (error) {
            this.deps.debugError('[Executor] Verification check failed:', error);
            break;
          }
        } else {
          break;
        }
      } catch (error) {
        this.deps.debugError('[Executor] Failed to generate/execute recovery plan:', error);
        break;
      }
    }
  }
}
