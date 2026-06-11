import type { AgentTask, ExecutionStep } from '@frontagent/shared';
import { describe, expect, it, vi } from 'vitest';
import type { ExecutorOutput } from '../types.js';
import { PhaseRunner, type PhaseRunnerDeps } from './phase-runner.js';
import type { ExecutorCollectedContext, PhaseExecutionGroup } from './types.js';

function makeStep(overrides: Partial<ExecutionStep> = {}): ExecutionStep {
  return {
    stepId: 'step-1',
    description: 'Test step',
    action: 'create',
    tool: 'test-tool',
    params: {},
    dependencies: [],
    validation: [],
    status: 'pending',
    phase: 'build',
    ...overrides,
  };
}

function makeOutput(success = true): ExecutorOutput {
  return {
    stepResult: { success, duration: 10, output: 'ok' },
    validation: { pass: true, results: [] },
    needsRollback: false,
  };
}

function makePhaseGroup(steps: ExecutionStep[]): PhaseExecutionGroup {
  return {
    phase: 'build',
    steps,
    dependencies: new Set(),
    firstSeenIndex: 0,
    priority: 0,
  };
}

function makeContext() {
  return {
    task: { id: 't1', type: 'create' as const, description: 'test' } as AgentTask,
    collectedContext: {
      files: new Map<string, string>(),
    } as ExecutorCollectedContext,
  };
}

function makeDeps(overrides: Partial<PhaseRunnerDeps> = {}): PhaseRunnerDeps {
  return {
    executeStep: vi.fn().mockResolvedValue(makeOutput()),
    debugLog: vi.fn(),
    debugWarn: vi.fn(),
    debugError: vi.fn(),
    throwIfAborted: vi.fn(),
    getMaxRecoveryAttempts: () => 3,
    createRecoveryFingerprint: (errors) => errors.map((e) => e.error).join(','),
    parallelExecution: false,
    ...overrides,
  };
}

describe('PhaseRunner', () => {
  describe('executeSinglePhaseWithRecovery', () => {
    it('executes steps sequentially by default', async () => {
      const step1 = makeStep({ stepId: 's1', dependencies: [] });
      const step2 = makeStep({ stepId: 's2', dependencies: ['s1'] });
      const deps = makeDeps();
      const runner = new PhaseRunner(deps);
      const results: ExecutorOutput[] = [];

      await runner.executeSinglePhaseWithRecovery(
        makePhaseGroup([step1, step2]),
        makeContext(),
        new Set(),
        results,
        {},
      );

      expect(deps.executeStep).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(2);
      expect(step1.status).toBe('completed');
      expect(step2.status).toBe('completed');
    });

    it('skips already-completed steps on resume and unblocks their dependents (sequential)', async () => {
      const done = makeStep({ stepId: 's1', status: 'completed' });
      const next = makeStep({ stepId: 's2', dependencies: ['s1'] });
      const deps = makeDeps();
      const runner = new PhaseRunner(deps);
      const completedStepIds = new Set<string>();

      await runner.executeSinglePhaseWithRecovery(
        makePhaseGroup([done, next]),
        makeContext(),
        completedStepIds,
        [],
        {},
      );

      expect(deps.executeStep).toHaveBeenCalledTimes(1);
      expect(deps.executeStep).toHaveBeenCalledWith(next, expect.anything());
      expect(done.status).toBe('completed');
      expect(next.status).toBe('completed');
      expect(completedStepIds.has('s1')).toBe(true);
    });

    it('skips already-completed steps on resume and unblocks their dependents (parallel)', async () => {
      const done = makeStep({ stepId: 's1', status: 'completed' });
      const next = makeStep({ stepId: 's2', dependencies: ['s1'] });
      const deps = makeDeps({ parallelExecution: true });
      const runner = new PhaseRunner(deps);

      await runner.executeSinglePhaseWithRecovery(
        makePhaseGroup([done, next]),
        makeContext(),
        new Set(),
        [],
        {},
      );

      expect(deps.executeStep).toHaveBeenCalledTimes(1);
      expect(next.status).toBe('completed');
    });

    it('skips steps with unmet dependencies', async () => {
      const step = makeStep({ stepId: 's1', dependencies: ['missing-dep'] });
      const deps = makeDeps();
      const runner = new PhaseRunner(deps);

      await runner.executeSinglePhaseWithRecovery(
        makePhaseGroup([step]),
        makeContext(),
        new Set(),
        [],
        {},
      );

      expect(deps.executeStep).not.toHaveBeenCalled();
      expect(step.status).toBe('skipped');
    });

    it('marks failed steps and records errors', async () => {
      const step = makeStep({ stepId: 's1' });
      const deps = makeDeps({
        executeStep: vi.fn().mockResolvedValue(makeOutput(false)),
      });
      const runner = new PhaseRunner(deps);

      await runner.executeSinglePhaseWithRecovery(
        makePhaseGroup([step]),
        makeContext(),
        new Set(),
        [],
        {},
      );

      expect(step.status).toBe('failed');
    });

    it('calls onPhaseStart and onPhaseComplete callbacks', async () => {
      const step = makeStep({ stepId: 's1' });
      const deps = makeDeps();
      const runner = new PhaseRunner(deps);
      const callbacks = {
        onPhaseStart: vi.fn(),
        onPhaseComplete: vi.fn().mockResolvedValue([]),
      };

      await runner.executeSinglePhaseWithRecovery(
        makePhaseGroup([step]),
        makeContext(),
        new Set(),
        [],
        callbacks,
      );

      expect(callbacks.onPhaseStart).toHaveBeenCalledWith('build', 1);
      expect(callbacks.onPhaseComplete).toHaveBeenCalledWith('build', expect.any(Array));
    });

    it('calls onStepStart and onStepComplete callbacks', async () => {
      const step = makeStep({ stepId: 's1' });
      const deps = makeDeps();
      const runner = new PhaseRunner(deps);
      const callbacks = {
        onStepStart: vi.fn(),
        onStepComplete: vi.fn(),
      };

      await runner.executeSinglePhaseWithRecovery(
        makePhaseGroup([step]),
        makeContext(),
        new Set(),
        [],
        callbacks,
      );

      expect(callbacks.onStepStart).toHaveBeenCalledWith(step);
      expect(callbacks.onStepComplete).toHaveBeenCalledWith(step, expect.any(Object));
    });

    it('respects AbortSignal', async () => {
      const step = makeStep({ stepId: 's1' });
      const controller = new AbortController();
      const deps = makeDeps({
        throwIfAborted: vi.fn().mockImplementation(() => {
          if (controller.signal.aborted) throw new Error('Aborted');
        }),
      });
      const runner = new PhaseRunner(deps);

      controller.abort();

      await expect(
        runner.executeSinglePhaseWithRecovery(
          makePhaseGroup([step]),
          makeContext(),
          new Set(),
          [],
          { signal: controller.signal },
        ),
      ).rejects.toThrow('Aborted');
    });
  });

  describe('parallel execution', () => {
    it('executes independent steps in parallel', async () => {
      const step1 = makeStep({ stepId: 's1', dependencies: [] });
      const step2 = makeStep({ stepId: 's2', dependencies: [] });
      const deps = makeDeps({ parallelExecution: true });
      const runner = new PhaseRunner(deps);

      await runner.executeSinglePhaseWithRecovery(
        makePhaseGroup([step1, step2]),
        makeContext(),
        new Set(),
        [],
        {},
      );

      expect(deps.executeStep).toHaveBeenCalledTimes(2);
      expect(step1.status).toBe('completed');
      expect(step2.status).toBe('completed');
    });

    it('respects dependencies in parallel mode', async () => {
      const step1 = makeStep({ stepId: 's1', dependencies: [] });
      const step2 = makeStep({ stepId: 's2', dependencies: ['s1'] });
      const completedOrder: string[] = [];
      const deps = makeDeps({
        parallelExecution: true,
        executeStep: vi.fn().mockImplementation(async (step: ExecutionStep) => {
          await new Promise((r) => setTimeout(r, 5));
          completedOrder.push(step.stepId);
          return makeOutput();
        }),
      });
      const runner = new PhaseRunner(deps);

      await runner.executeSinglePhaseWithRecovery(
        makePhaseGroup([step1, step2]),
        makeContext(),
        new Set(),
        [],
        {},
      );

      expect(completedOrder).toEqual(['s1', 's2']);
    });

    it('skips steps with unmet dependencies in parallel mode', async () => {
      const step = makeStep({ stepId: 's1', dependencies: ['missing'] });
      const deps = makeDeps({ parallelExecution: true });
      const runner = new PhaseRunner(deps);

      await runner.executeSinglePhaseWithRecovery(
        makePhaseGroup([step]),
        makeContext(),
        new Set(),
        [],
        {},
      );

      expect(deps.executeStep).not.toHaveBeenCalled();
      expect(step.status).toBe('skipped');
    });
  });

  describe('recovery', () => {
    it('runs recovery when onPhaseComplete returns errors', async () => {
      const step = makeStep({ stepId: 's1' });
      const recoveryStep = makeStep({ stepId: 'recovery-1', description: 'Recovery step' });
      const deps = makeDeps();
      const runner = new PhaseRunner(deps);
      const callbacks = {
        onPhaseComplete: vi
          .fn()
          .mockResolvedValueOnce([{ step, error: 'failed' }])
          .mockResolvedValueOnce([]),
        onPhaseError: vi.fn().mockResolvedValue([recoveryStep]),
      };

      await runner.executeSinglePhaseWithRecovery(
        makePhaseGroup([step]),
        makeContext(),
        new Set(),
        [],
        callbacks,
      );

      expect(callbacks.onPhaseError).toHaveBeenCalledWith('build', expect.any(Array));
      expect(deps.executeStep).toHaveBeenCalledTimes(2); // original + recovery
    });

    it('stops recovery after max attempts', async () => {
      const step = makeStep({ stepId: 's1' });
      const deps = makeDeps({ getMaxRecoveryAttempts: () => 1 });
      const runner = new PhaseRunner(deps);
      const callbacks = {
        onPhaseComplete: vi.fn().mockResolvedValue([{ step, error: 'persistent error' }]),
        onPhaseError: vi.fn().mockResolvedValue([makeStep({ stepId: 'recovery-1' })]),
      };

      await runner.executeSinglePhaseWithRecovery(
        makePhaseGroup([step]),
        makeContext(),
        new Set(),
        [],
        callbacks,
      );

      // Recovery runs once (max=1), then stops
      expect(callbacks.onPhaseError).toHaveBeenCalledTimes(1);
    });

    it('stops recovery on repeated fingerprint', async () => {
      const step = makeStep({ stepId: 's1' });
      const deps = makeDeps({
        getMaxRecoveryAttempts: () => 10,
        createRecoveryFingerprint: () => 'same-fingerprint',
      });
      const runner = new PhaseRunner(deps);
      const callbacks = {
        onPhaseComplete: vi.fn().mockResolvedValue([{ step, error: 'error' }]),
        onPhaseError: vi.fn().mockResolvedValue([makeStep({ stepId: 'recovery-1' })]),
      };

      await runner.executeSinglePhaseWithRecovery(
        makePhaseGroup([step]),
        makeContext(),
        new Set(),
        [],
        callbacks,
      );

      // Should stop after detecting repeated fingerprint
      expect(callbacks.onPhaseError).toHaveBeenCalledTimes(1);
    });

    it('stops recovery when onPhaseError returns empty array', async () => {
      const step = makeStep({ stepId: 's1' });
      const deps = makeDeps();
      const runner = new PhaseRunner(deps);
      const callbacks = {
        onPhaseComplete: vi.fn().mockResolvedValue([{ step, error: 'error' }]),
        onPhaseError: vi.fn().mockResolvedValue([]),
      };

      await runner.executeSinglePhaseWithRecovery(
        makePhaseGroup([step]),
        makeContext(),
        new Set(),
        [],
        callbacks,
      );

      expect(callbacks.onPhaseError).toHaveBeenCalledTimes(1);
    });
  });
});
