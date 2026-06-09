import type { AgentTask, ExecutionPlan, ExecutionStep, ValidationResult } from '@frontagent/shared';
import { describe, expect, it, vi } from 'vitest';
import type { ExecutorOutput } from '../types.js';
import { createExecutionCallbacks } from './execution-callbacks.js';

function makeTask(): AgentTask {
  return {
    id: 'task-1',
    type: 'code',
    description: 'Build feature',
    context: { workingDirectory: '/repo' },
  };
}

function makeStep(overrides: Partial<ExecutionStep> = {}): ExecutionStep {
  return {
    stepId: 'step-1',
    description: 'Create file',
    action: 'create_file',
    tool: 'create_file',
    params: { path: 'src/a.ts', content: 'export const a = 1;' },
    dependencies: [],
    validation: [],
    status: 'pending',
    phase: 'build',
    ...overrides,
  };
}

function makeExecutionPlan(step: ExecutionStep): ExecutionPlan {
  return {
    steps: [step],
    estimatedDuration: 1,
    requiredTools: ['create_file'],
    risks: [],
  };
}

function makeDeps() {
  const contextManager = {
    updateFileSystemFacts: vi.fn(),
    updateDependencyFacts: vi.fn(),
    updateProjectFacts: vi.fn(),
    updateModuleDependencyGraph: vi.fn(),
    updateFilesenseNavigation: vi.fn(),
    getContext: vi.fn(),
    addErrorFact: vi.fn(),
    addExecutedStep: vi.fn(),
    validateModuleDependencies: vi.fn(() => []),
    serializeFactsForLLM: vi.fn(() => ''),
  };

  return {
    contextManager,
    executor: { callTool: vi.fn() },
    llmService: { analyzeErrorsAndGenerateRecovery: vi.fn() },
    emit: vi.fn(),
    emitStatus: vi.fn(),
    debugLog: vi.fn(),
    debugWarn: vi.fn(),
    throwIfAborted: vi.fn(),
    phaseCheckDeps: {
      config: { projectRoot: '/repo', llm: { provider: 'openai', model: 'gpt-4' } },
      executor: { callTool: vi.fn() },
      contextManager,
      sddConfig: undefined,
      a2aBus: undefined,
      codeQualitySubAgent: undefined,
      debugLog: vi.fn(),
      debugWarn: vi.fn(),
      enqueueFactsUpdate: vi.fn(),
    },
  };
}

describe('createExecutionCallbacks', () => {
  it('emits the same step and phase started events as FrontAgent executeSteps wiring', () => {
    const deps = makeDeps();
    const task = makeTask();
    const step = makeStep();
    const validations: ValidationResult[] = [];

    const callbacks = createExecutionCallbacks({
      deps,
      task,
      executionPlan: makeExecutionPlan(step),
      executionContext: { collectedContext: { files: new Map<string, string>() } },
      validations,
    });

    callbacks.onStepStarted(step);
    callbacks.onPhaseStarted('build', 1);

    expect(deps.emit).toHaveBeenCalledWith({ type: 'step_started', step });
    expect(deps.emit).toHaveBeenCalledWith({
      type: 'phase_started',
      phase: 'build',
      stepCount: 1,
    });
  });

  it('delegates step completion side effects to the existing step callback behavior', () => {
    const deps = makeDeps();
    const task = makeTask();
    const step = makeStep();
    const validations: ValidationResult[] = [];
    const files = new Map<string, string>();

    const callbacks = createExecutionCallbacks({
      deps,
      task,
      executionPlan: makeExecutionPlan(step),
      executionContext: { collectedContext: { files } },
      validations,
    });

    const output = {
      stepId: step.stepId,
      stepResult: {
        success: true,
        output: { content: 'export const a = 1;' },
      },
      validation: { valid: true, errors: [], warnings: [] },
    } as ExecutorOutput;

    callbacks.onStepComplete(step, output);

    expect(files.get('src/a.ts')).toBe('export const a = 1;');
    expect(validations).toEqual([output.validation]);
    expect(deps.contextManager.addExecutedStep).toHaveBeenCalledWith(task.id, step);
    expect(deps.emit).toHaveBeenCalledWith({
      type: 'step_completed',
      step,
      result: output.stepResult,
    });
  });
});
