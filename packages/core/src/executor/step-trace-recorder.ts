import type { ExecutionStep } from '@frontagent/shared';
import type { ExecutorOutput } from '../types.js';
import type {
  ExecutorStepTrace,
  ExecutorSubStage,
  ExecutorTraceConfig,
  ExecutorTraceStage,
} from './types.js';

export interface StepTraceRecorderOptions {
  trace?: ExecutorTraceConfig;
  taskId: string;
  step: ExecutionStep;
  nowMs(): number;
}

export interface StepTraceRecorder {
  addSubStage(name: string, durationMs: number, success?: boolean, error?: string): void;
  finish(output: ExecutorOutput): ExecutorOutput;
  markCatchIfEmpty(error: unknown): void;
  withStage<T>(name: ExecutorTraceStage['name'], fn: () => Promise<T> | T): Promise<T>;
}

function isTraceEnabled(trace?: ExecutorTraceConfig): boolean {
  return Boolean(trace?.enabled || trace?.onStepTrace);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createTraceStage(
  name: ExecutorTraceStage['name'],
  nowMs: () => number,
  startedAtMs: number,
  success: boolean,
  error?: string,
): ExecutorTraceStage {
  return {
    name,
    durationMs: nowMs() - startedAtMs,
    success,
    error,
  };
}

function isSkippedOutput(output: unknown): boolean {
  return (
    typeof output === 'object' &&
    output !== null &&
    Boolean((output as { skipped?: boolean }).skipped)
  );
}

export function createStepTraceRecorder({
  trace,
  taskId,
  step,
  nowMs,
}: StepTraceRecorderOptions): StepTraceRecorder {
  const enabled = isTraceEnabled(trace);
  const traceStartedAt = enabled ? nowMs() : 0;
  const stages: ExecutorTraceStage[] = [];
  const subStages: ExecutorSubStage[] = [];

  return {
    addSubStage(name, durationMs, success = true, error) {
      subStages.push({ name, durationMs, success, error });
    },

    finish(output) {
      if (enabled) {
        const stepResult = output.stepResult;
        const toolResult = stepResult.output as Record<string, unknown> | undefined;
        const stepTrace: ExecutorStepTrace = {
          taskId,
          stepId: step.stepId,
          action: step.action,
          tool: step.tool,
          totalMs: nowMs() - traceStartedAt,
          success: stepResult.success,
          skipped: isSkippedOutput(stepResult.output),
          error: stepResult.error,
          stages,
          toolDurationMs: toolResult?.__toolDurationMs as number | undefined,
          subStages: subStages.length > 0 ? subStages : undefined,
        };
        trace?.onStepTrace?.(stepTrace);
      }
      return output;
    },

    markCatchIfEmpty(error) {
      if (enabled && stages.length === 0) {
        stages.push(createTraceStage('catch', nowMs, traceStartedAt, false, errorMessage(error)));
      }
    },

    async withStage(name, fn) {
      if (!enabled) {
        return fn();
      }
      const stageStartedAt = nowMs();
      try {
        const result = await fn();
        stages.push(createTraceStage(name, nowMs, stageStartedAt, true));
        return result;
      } catch (error) {
        stages.push(createTraceStage(name, nowMs, stageStartedAt, false, errorMessage(error)));
        throw error;
      }
    },
  };
}
