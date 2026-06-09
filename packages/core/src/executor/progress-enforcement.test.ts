import type { ExecutionStep } from '@frontagent/shared';
import { describe, expect, it, vi } from 'vitest';
import type { ExecutorOutput } from '../types.js';
import { executeStepsWithProgressEnforcement } from './progress-enforcement.js';

function makeStep(overrides: Partial<ExecutionStep> = {}): ExecutionStep {
  return {
    stepId: 'step-1',
    description: 'Test step',
    action: 'read_file',
    tool: 'read_file',
    params: {},
    dependencies: [],
    validation: [],
    status: 'pending',
    phase: 'build',
    ...overrides,
  };
}

function makeOutput(overrides: Partial<ExecutorOutput> = {}): ExecutorOutput {
  return {
    stepResult: {
      success: true,
      output: {},
      duration: 1,
    },
    validation: { pass: true, results: [] },
    needsRollback: false,
    ...overrides,
  };
}

describe('executeStepsWithProgressEnforcement', () => {
  it('executes dependency-ready steps and reports completion in execution order', async () => {
    const first = makeStep({ stepId: 's1' });
    const second = makeStep({ stepId: 's2', dependencies: ['s1'] });
    const executeStep = vi.fn().mockResolvedValue(makeOutput());
    const onStepComplete = vi.fn();

    const results = await executeStepsWithProgressEnforcement(
      [second, first],
      {
        task: { id: 't1', type: 'create', description: 'test' },
        collectedContext: { files: new Map() },
      },
      { executeStep },
      onStepComplete,
    );

    expect(results).toHaveLength(2);
    expect(executeStep.mock.calls.map(([step]) => step.stepId)).toEqual(['s1', 's2']);
    expect(first.status).toBe('completed');
    expect(second.status).toBe('completed');
    expect(onStepComplete.mock.calls.map(([step]) => step.stepId)).toEqual(['s1', 's2']);
  });

  it('marks remaining pending steps as skipped when rollback is needed', async () => {
    const failed = makeStep({ stepId: 's1' });
    const pending = makeStep({ stepId: 's2', dependencies: ['s1'] });
    const failingOutput = makeOutput({
      stepResult: {
        success: false,
        error: 'failed',
        duration: 1,
      },
      validation: { pass: false, results: [], blockedBy: ['failed'] },
      needsRollback: true,
    });
    const executeStep = vi.fn().mockResolvedValue(failingOutput);

    const results = await executeStepsWithProgressEnforcement(
      [failed, pending],
      {
        task: { id: 't1', type: 'create', description: 'test' },
        collectedContext: { files: new Map() },
      },
      { executeStep },
    );

    expect(results).toEqual([failingOutput]);
    expect(failed.status).toBe('failed');
    expect(pending.status).toBe('skipped');
  });

  it('throws when no pending step has satisfied dependencies', async () => {
    const step = makeStep({ stepId: 's1', dependencies: ['missing'] });

    await expect(
      executeStepsWithProgressEnforcement(
        [step],
        {
          task: { id: 't1', type: 'create', description: 'test' },
          collectedContext: { files: new Map() },
        },
        { executeStep: vi.fn() },
      ),
    ).rejects.toThrow('Circular dependency detected or missing dependency');
  });
});
