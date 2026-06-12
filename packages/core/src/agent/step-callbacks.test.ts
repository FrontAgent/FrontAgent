import type { AgentTask, ExecutionPlan, ExecutionStep, ValidationResult } from '@frontagent/shared';
import { describe, expect, it, vi } from 'vitest';
import type { ExecutorOutput } from '../types.js';
import {
  createOnPhaseComplete,
  createOnPhaseError,
  createOnStepComplete,
} from './step-callbacks.js';

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

function makeExecutionPlan(steps: ExecutionStep[] = []): ExecutionPlan {
  return {
    steps,
    estimatedDuration: 1,
    requiredTools: ['create_file'],
    risks: [],
  };
}

function makeOutput(stepResult: {
  success: boolean;
  output?: unknown;
  error?: string;
}): ExecutorOutput {
  return {
    stepResult,
    validation: { valid: true, errors: [], warnings: [] },
    needsRollback: false,
  } as ExecutorOutput;
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
    validateModuleDependencies: vi.fn(
      () => [] as Array<{ from: string; importPath: string; missing: string }>,
    ),
    serializeFactsForLLM: vi.fn(() => ''),
    exportFactsSnapshot: vi.fn(() => ({})),
  };

  return {
    contextManager,
    executor: {
      callTool: vi.fn(async () => ({ success: true, content: '{"dependencies":{}}' })),
    },
    llmService: { analyzeErrorsAndGenerateRecovery: vi.fn() },
    emit: vi.fn(),
    emitStatus: vi.fn(),
    debugLog: vi.fn(),
    debugWarn: vi.fn(),
    throwIfAborted: vi.fn(),
    subAgentConfig: undefined as
      | { codeQualityEvaluator?: { failOnWarnings?: boolean } }
      | undefined,
    phaseCheckDeps: {
      config: { projectRoot: '/repo', llm: { provider: 'openai', model: 'gpt-4' } },
      executor: { callTool: vi.fn(async () => ({ success: true, output: '' })) },
      contextManager,
      sddConfig: undefined,
      a2aBus: undefined as
        | { hasAgent: ReturnType<typeof vi.fn>; request: ReturnType<typeof vi.fn> }
        | undefined,
      codeQualitySubAgent: undefined as { agentId: string } | undefined,
      debugLog: vi.fn(),
      debugWarn: vi.fn(),
      enqueueFactsUpdate: vi.fn(),
    },
  };
}

describe('createOnStepComplete', () => {
  function setup(stepOverrides: Partial<ExecutionStep> = {}) {
    const deps = makeDeps();
    const task = makeTask();
    const step = makeStep(stepOverrides);
    const validations: ValidationResult[] = [];
    const files = new Map<string, string>();
    const onStepComplete = createOnStepComplete(
      // biome-ignore lint/suspicious/noExplicitAny: structural fake for contract test
      deps as any,
      task,
      { collectedContext: { files } },
      validations,
    );
    return { deps, task, step, validations, files, onStepComplete };
  }

  it('emits step_completed and caches created file content from the tool output', () => {
    const { deps, task, step, validations, files, onStepComplete } = setup();
    const output = makeOutput({ success: true, output: { content: 'export const a = 1;' } });

    onStepComplete(step, output);

    expect(deps.emit).toHaveBeenCalledWith({
      type: 'step_completed',
      step,
      result: output.stepResult,
    });
    expect(deps.emit).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'step_failed' }));
    expect(files.get('src/a.ts')).toBe('export const a = 1;');
    expect(validations).toEqual([output.validation]);
    expect(deps.contextManager.addExecutedStep).toHaveBeenCalledWith(task.id, step);
    expect(deps.contextManager.addErrorFact).not.toHaveBeenCalled();
  });

  it('forwards the tool result merged with success/error to every facts updater', () => {
    const { deps, task, step, onStepComplete } = setup();

    onStepComplete(step, makeOutput({ success: true, output: { content: 'x' } }));

    const expected = expect.objectContaining({ content: 'x', success: true });
    expect(deps.contextManager.updateFileSystemFacts).toHaveBeenCalledWith(
      task.id,
      step.tool,
      step.params,
      expected,
    );
    expect(deps.contextManager.updateDependencyFacts).toHaveBeenCalledWith(
      task.id,
      step.tool,
      step.params,
      expected,
    );
    expect(deps.contextManager.updateProjectFacts).toHaveBeenCalledWith(
      task.id,
      step.tool,
      step.params,
      expected,
    );
    expect(deps.contextManager.updateModuleDependencyGraph).toHaveBeenCalledWith(
      task.id,
      step.tool,
      step.params,
      expected,
    );
  });

  it('still forwards merged results to the facts updaters when the step failed', () => {
    const { deps, task, step, onStepComplete } = setup();

    onStepComplete(step, makeOutput({ success: false, error: 'boom' }));

    expect(deps.contextManager.updateFileSystemFacts).toHaveBeenCalledWith(
      task.id,
      step.tool,
      step.params,
      expect.objectContaining({ success: false, error: 'boom' }),
    );
  });

  it('falls back to step params content when create_file output has no content', () => {
    const { files, step, onStepComplete } = setup();

    onStepComplete(step, makeOutput({ success: true, output: {} }));

    expect(files.get('src/a.ts')).toBe('export const a = 1;');
  });

  it('caches read_file content under the requested path', () => {
    const { files, step, onStepComplete } = setup({
      action: 'read_file',
      tool: 'read_file',
      params: { path: 'src/read.ts' },
    });

    onStepComplete(step, makeOutput({ success: true, output: { content: 'read content' } }));

    expect(files.get('src/read.ts')).toBe('read content');
  });

  it('does not cache read_file results without content', () => {
    const { files, step, onStepComplete } = setup({
      action: 'read_file',
      tool: 'read_file',
      params: { path: 'src/read.ts' },
    });

    onStepComplete(step, makeOutput({ success: true, output: {} }));

    expect(files.size).toBe(0);
  });

  it('emits step_failed, records an error fact, and still records validation and executed step on failure', () => {
    const { deps, task, step, validations, files, onStepComplete } = setup();
    const output = makeOutput({ success: false, error: 'disk full' });

    onStepComplete(step, output);

    expect(deps.emit).toHaveBeenCalledWith({ type: 'step_failed', step, error: 'disk full' });
    expect(deps.emit).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'step_completed' }));
    expect(deps.contextManager.addErrorFact).toHaveBeenCalledWith(
      task.id,
      step.stepId,
      step.action,
      'disk full',
    );
    expect(validations).toEqual([output.validation]);
    expect(deps.contextManager.addExecutedStep).toHaveBeenCalledWith(task.id, step);
    expect(files.size).toBe(0);
  });

  it('falls back to "Unknown error" when a failed step has no error message', () => {
    const { deps, task, step, onStepComplete } = setup();

    onStepComplete(step, makeOutput({ success: false }));

    expect(deps.emit).toHaveBeenCalledWith({ type: 'step_failed', step, error: 'Unknown error' });
    expect(deps.contextManager.addErrorFact).toHaveBeenCalledWith(
      task.id,
      step.stepId,
      step.action,
      'Unknown error',
    );
  });

  it('records filesense navigation and emits filesense_navigated when context holds navigation data', () => {
    const { deps, task, step, onStepComplete } = setup({
      action: 'read_file',
      tool: 'filesense_navigate',
      params: { intent: 'locate', paths: ['src'] },
    });
    deps.contextManager.getContext.mockReturnValue({
      collectedContext: {
        filesenseNavigation: {
          intent: 'locate',
          paths: ['src'],
          scanned: { entries: 12, elapsedMs: 34, truncated: false },
          candidates: [{ path: 'src/a.ts', type: 'file', reason: 'match', score: 0.9 }],
          warnings: ['partial scan'],
        },
      },
    });

    onStepComplete(step, makeOutput({ success: true, output: { data: { tree: [] } } }));

    expect(deps.contextManager.updateFilesenseNavigation).toHaveBeenCalledWith(task.id, {
      intent: 'locate',
      paths: ['src'],
      data: { tree: [] },
    });
    expect(deps.emit).toHaveBeenCalledWith({
      type: 'filesense_navigated',
      intent: 'locate',
      paths: ['src'],
      entries: 12,
      elapsedMs: 34,
      truncated: false,
      candidateCount: 1,
      warnings: ['partial scan'],
    });
  });

  it('does not emit filesense_navigated when no navigation context was stored', () => {
    const { deps, step, onStepComplete } = setup({
      action: 'read_file',
      tool: 'filesense_navigate',
      params: { intent: 'locate' },
    });
    deps.contextManager.getContext.mockReturnValue(undefined);

    onStepComplete(step, makeOutput({ success: true, output: {} }));

    expect(deps.contextManager.updateFilesenseNavigation).toHaveBeenCalled();
    expect(deps.emit).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'filesense_navigated' }),
    );
  });

  it('skips filesense navigation handling entirely when the step failed', () => {
    const { deps, step, onStepComplete } = setup({
      action: 'read_file',
      tool: 'filesense_navigate',
      params: { intent: 'locate' },
    });

    onStepComplete(step, makeOutput({ success: false, error: 'scan failed' }));

    expect(deps.contextManager.updateFilesenseNavigation).not.toHaveBeenCalled();
    expect(deps.emit).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'filesense_navigated' }),
    );
  });
});

describe('createOnPhaseError', () => {
  function makeRecoveryPlan(
    overrides: Partial<{
      analysis: string;
      canRecover: boolean;
      recommendation: string;
      recoverySteps: Array<{
        description: string;
        action: string;
        tool: string;
        params: Record<string, unknown>;
        phase?: string;
      }>;
    }> = {},
  ) {
    return {
      analysis: 'analysis',
      canRecover: false,
      recommendation: 'stop',
      recoverySteps: [],
      ...overrides,
    };
  }

  it('checks the abort signal before any recovery work', async () => {
    const deps = makeDeps();
    deps.throwIfAborted.mockImplementation(() => {
      throw new Error('aborted');
    });
    const signal = new AbortController().signal;
    // biome-ignore lint/suspicious/noExplicitAny: structural fake for contract test
    const onPhaseError = createOnPhaseError(deps as any, makeTask(), signal);

    await expect(onPhaseError('实现', [])).rejects.toThrow('aborted');

    expect(deps.throwIfAborted).toHaveBeenCalledWith(signal);
    expect(deps.llmService.analyzeErrorsAndGenerateRecovery).not.toHaveBeenCalled();
  });

  it('appends at most five missing module dependencies and sends the full failure list to the LLM', async () => {
    const deps = makeDeps();
    const task = makeTask();
    deps.contextManager.validateModuleDependencies.mockReturnValue(
      Array.from({ length: 6 }, (_, i) => ({
        from: `src/from-${i}.ts`,
        importPath: `./missing-${i}`,
        missing: `src/missing-${i}.ts`,
      })),
    );
    deps.llmService.analyzeErrorsAndGenerateRecovery.mockResolvedValue(makeRecoveryPlan());

    const errors = [{ step: makeStep(), error: 'original failure' }];
    // biome-ignore lint/suspicious/noExplicitAny: structural fake for contract test
    await createOnPhaseError(deps as any, task)('实现', errors);

    expect(errors).toHaveLength(6);
    expect(errors[1].error).toBe('Missing module: ./missing-0 (resolved: src/missing-0.ts)');
    expect(errors[5].error).toBe('Missing module: ./missing-4 (resolved: src/missing-4.ts)');

    const request = deps.llmService.analyzeErrorsAndGenerateRecovery.mock.calls[0][0];
    expect(request.task).toBe(task.description);
    expect(request.phase).toBe('实现');
    expect(request.failedSteps).toHaveLength(6);
    expect(request.failedSteps[0]).toEqual({
      description: 'Create file',
      action: 'create_file',
      params: { path: 'src/a.ts', content: 'export const a = 1;' },
      error: 'original failure',
    });
    expect(request.context).toBe('无可用的项目状态信息');
  });

  it('passes serialized facts as the LLM context when available', async () => {
    const deps = makeDeps();
    deps.contextManager.serializeFactsForLLM.mockReturnValue('facts: hello');
    deps.llmService.analyzeErrorsAndGenerateRecovery.mockResolvedValue(makeRecoveryPlan());

    // biome-ignore lint/suspicious/noExplicitAny: structural fake for contract test
    await createOnPhaseError(deps as any, makeTask())('实现', []);

    expect(deps.llmService.analyzeErrorsAndGenerateRecovery).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'facts: hello' }),
    );
  });

  it('returns no recovery steps and warns when the LLM cannot recover', async () => {
    const deps = makeDeps();
    deps.llmService.analyzeErrorsAndGenerateRecovery.mockResolvedValue(
      makeRecoveryPlan({ canRecover: false }),
    );

    // biome-ignore lint/suspicious/noExplicitAny: structural fake for contract test
    const result = await createOnPhaseError(deps as any, makeTask())('实现', [
      { step: makeStep(), error: 'boom' },
    ]);

    expect(result).toEqual([]);
    expect(deps.debugWarn).toHaveBeenCalledWith('[Agent] Cannot recover from errors in phase 实现');
  });

  it('maps recovery steps to pending execution steps with generated ids and sequential dependencies', async () => {
    const deps = makeDeps();
    deps.llmService.analyzeErrorsAndGenerateRecovery.mockResolvedValue(
      makeRecoveryPlan({
        canRecover: true,
        recoverySteps: [
          {
            description: 'install dep',
            action: 'run_command',
            tool: 'run_command',
            params: { command: 'npm i left-pad' },
            phase: '实现',
          },
          {
            description: 'create module',
            action: 'create_file',
            tool: 'create_file',
            params: { path: 'src/x.ts' },
            phase: '实现',
          },
        ],
      }),
    );

    // biome-ignore lint/suspicious/noExplicitAny: structural fake for contract test
    const result = await createOnPhaseError(deps as any, makeTask())('实现', []);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      description: 'install dep',
      action: 'run_command',
      tool: 'run_command',
      params: { command: 'npm i left-pad' },
      dependencies: [],
      validation: [],
      status: 'pending',
      phase: '实现',
    });
    expect(result[0].stepId).toMatch(/^recovery-step_/);
    expect(result[1].stepId).toMatch(/^recovery-step_/);
    expect(result[1].stepId).not.toBe(result[0].stepId);
    expect(result[1].dependencies).toEqual([result[0].stepId]);
    expect(deps.emitStatus).toHaveBeenCalledWith('恢复计划生成完成：实现', '恢复步骤 2 个');
  });
});

describe('createOnPhaseComplete', () => {
  function setupPhaseComplete(
    options: { files?: Map<string, string>; planSteps?: ExecutionStep[] } = {},
  ) {
    const deps = makeDeps();
    const task = makeTask();
    const files = options.files ?? new Map<string, string>();
    const onPhaseComplete = createOnPhaseComplete(
      // biome-ignore lint/suspicious/noExplicitAny: structural fake for contract test
      deps as any,
      task,
      makeExecutionPlan(options.planSteps ?? []),
      { collectedContext: { files } },
    );
    return { deps, task, files, onPhaseComplete };
  }

  it('checks the abort signal before running any checks', async () => {
    const { deps, onPhaseComplete } = setupPhaseComplete();
    deps.throwIfAborted.mockImplementation(() => {
      throw new Error('aborted');
    });

    await expect(onPhaseComplete('实现', [])).rejects.toThrow('aborted');

    expect(deps.emit).not.toHaveBeenCalled();
  });

  it('skips all checks for non-implementation phases and emits phase_completed with counts', async () => {
    const { deps, onPhaseComplete } = setupPhaseComplete();
    const phaseResults = [
      makeOutput({ success: true }),
      makeOutput({ success: true }),
      makeOutput({ success: false, error: 'x' }),
    ];

    const errors = await onPhaseComplete('review', phaseResults);

    expect(errors).toEqual([]);
    expect(deps.emit).toHaveBeenCalledWith({
      type: 'phase_completed',
      phase: 'review',
      successCount: 2,
      failureCount: 1,
    });
    expect(deps.contextManager.validateModuleDependencies).not.toHaveBeenCalled();
    expect(deps.executor.callTool).not.toHaveBeenCalled();
    expect(deps.phaseCheckDeps.executor.callTool).not.toHaveBeenCalled();
  });

  it('runs checks for implementation phases, refreshes package.json, and returns no errors when clean', async () => {
    const { deps, task, files, onPhaseComplete } = setupPhaseComplete();
    deps.executor.callTool.mockResolvedValue({
      success: true,
      content: '{"dependencies":{}}',
    });

    const errors = await onPhaseComplete('实现', [makeOutput({ success: true })]);

    expect(errors).toEqual([]);
    expect(deps.contextManager.validateModuleDependencies).toHaveBeenCalledWith(task.id);
    expect(deps.executor.callTool).toHaveBeenCalledWith('read_file', { path: 'package.json' });
    expect(files.get('package.json')).toBe('{"dependencies":{}}');
    // no tsconfig.json collected -> the tsc command must never run
    expect(deps.phaseCheckDeps.executor.callTool).not.toHaveBeenCalled();
    expect(deps.emit).toHaveBeenCalledWith({
      type: 'phase_completed',
      phase: '实现',
      successCount: 1,
      failureCount: 0,
    });
  });

  it('tolerates a package.json refresh failure via debugWarn and still completes the phase', async () => {
    const { deps, files, onPhaseComplete } = setupPhaseComplete();
    deps.executor.callTool.mockRejectedValue(new Error('fs down'));

    const errors = await onPhaseComplete('实现', []);

    expect(errors).toEqual([]);
    expect(files.has('package.json')).toBe(false);
    expect(deps.debugWarn).toHaveBeenCalledWith(
      '[Agent] Failed to refresh package.json:',
      expect.any(Error),
    );
    expect(deps.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'phase_completed', phase: '实现' }),
    );
  });

  it('reports at most five missing module dependencies as failed pseudo-steps', async () => {
    const { deps, onPhaseComplete } = setupPhaseComplete();
    deps.contextManager.validateModuleDependencies.mockReturnValue(
      Array.from({ length: 6 }, (_, i) => ({
        from: `src/from-${i}.ts`,
        importPath: `./missing-${i}`,
        missing: `src/missing-${i}.ts`,
      })),
    );

    const errors = await onPhaseComplete('实现', []);

    expect(errors).toHaveLength(5);
    expect(errors[0].step.stepId).toBe('module-validation-src-missing-0-ts');
    expect(errors[0].step.params).toEqual({ path: 'src/missing-0.ts' });
    expect(errors[0].error).toBe('Missing module: ./missing-0 (resolved path: src/missing-0.ts)');
    expect(deps.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'phase_completed', phase: '实现' }),
    );
  });

  it('reports missing npm dependencies detected from collected source files', async () => {
    const files = new Map<string, string>([['src/app.ts', "import _ from 'lodash';\n"]]);
    const { deps, onPhaseComplete } = setupPhaseComplete({ files });
    deps.executor.callTool.mockResolvedValue({
      success: true,
      content: '{"dependencies":{"react":"^18.0.0"}}',
    });

    const errors = await onPhaseComplete('实现', []);

    expect(errors).toHaveLength(1);
    expect(errors[0].step.stepId).toBe('install-missing-deps');
    expect(errors[0].step.params).toEqual({ command: 'npm install lodash' });
    expect(errors[0].error).toBe('Missing npm dependencies: lodash');
  });

  it('runs the TypeScript check only when tsconfig.json was collected and reports parsed errors', async () => {
    const files = new Map<string, string>([['tsconfig.json', '{}']]);
    const { deps, task, onPhaseComplete } = setupPhaseComplete({ files });
    deps.phaseCheckDeps.executor.callTool.mockResolvedValue({
      success: false,
      output: "src/app.ts(3,7): error TS2304: Cannot find name 'foo'.",
    });

    const errors = await onPhaseComplete('实现', []);

    expect(deps.phaseCheckDeps.executor.callTool).toHaveBeenCalledWith('run_command', {
      command: 'npx tsc --noEmit 2>&1',
      cwd: '/repo',
    });
    expect(deps.contextManager.addErrorFact).toHaveBeenCalledWith(
      task.id,
      'type-check',
      'typescript',
      "Cannot find name 'foo'.",
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].step.stepId).toBe('typescript-type-check');
    expect(errors[0].step.params).toEqual({ command: 'npx tsc --noEmit' });
    expect(errors[0].error).toContain('TypeScript compilation failed with 1 error(s)');
    expect(errors[0].error).toContain("Cannot find name 'foo'.");
  });

  it('adds no type check error when tsc output is clean', async () => {
    const files = new Map<string, string>([['tsconfig.json', '{}']]);
    const { deps, onPhaseComplete } = setupPhaseComplete({ files });
    deps.phaseCheckDeps.executor.callTool.mockResolvedValue({ success: true, output: '' });

    const errors = await onPhaseComplete('实现', []);

    expect(errors).toEqual([]);
  });

  function setupQualityReview(
    issues: Array<{
      filePath: string;
      line?: number;
      rule: string;
      message: string;
      severity: 'error' | 'warning';
    }>,
  ) {
    const planStep = makeStep({
      stepId: 'gen-1',
      action: 'create_file',
      tool: 'create_file',
      params: { path: 'src/widget.tsx' },
      status: 'completed',
      phase: '实现',
    });
    const files = new Map<string, string>([['src/widget.tsx', 'export const w = 1;']]);
    const { deps, onPhaseComplete } = setupPhaseComplete({ files, planSteps: [planStep] });
    deps.phaseCheckDeps.codeQualitySubAgent = { agentId: 'code-quality' };
    deps.phaseCheckDeps.a2aBus = {
      hasAgent: vi.fn(() => true),
      request: vi.fn(async () => ({
        success: true,
        payload: { issues, summary: 'reviewed 1 file' },
      })),
    };
    deps.phaseCheckDeps.executor.callTool.mockResolvedValue({
      success: true,
      content: 'export const w = 1;',
    });
    return { deps, onPhaseComplete };
  }

  it('does not block on warning-severity quality issues when failOnWarnings is not enabled', async () => {
    const { onPhaseComplete } = setupQualityReview([
      {
        filePath: 'src/widget.tsx',
        line: 1,
        rule: 'no-console',
        message: 'avoid console',
        severity: 'warning',
      },
    ]);

    const errors = await onPhaseComplete('实现', []);

    expect(errors).toEqual([]);
  });

  it('blocks on warnings when subAgentConfig.codeQualityEvaluator.failOnWarnings is true', async () => {
    const { deps, onPhaseComplete } = setupQualityReview([
      {
        filePath: 'src/widget.tsx',
        line: 1,
        rule: 'no-console',
        message: 'avoid console',
        severity: 'warning',
      },
    ]);
    deps.subAgentConfig = { codeQualityEvaluator: { failOnWarnings: true } };

    const errors = await onPhaseComplete('实现', []);

    expect(errors).toHaveLength(1);
    expect(errors[0].step.stepId).toMatch(/^code-quality-review_/);
    expect(errors[0].step.params).toEqual({ command: 'subagent:code-quality-review' });
    expect(errors[0].error).toContain('Code quality review found 1 blocking issue(s)');
    expect(errors[0].error).toContain('- src/widget.tsx:1 [no-console] avoid console');
  });

  it('always blocks on error-severity quality issues and omits non-blocking warnings from the report', async () => {
    const { onPhaseComplete } = setupQualityReview([
      {
        filePath: 'src/widget.tsx',
        rule: 'no-secrets',
        message: 'hardcoded token',
        severity: 'error',
      },
      {
        filePath: 'src/widget.tsx',
        line: 2,
        rule: 'no-console',
        message: 'avoid console',
        severity: 'warning',
      },
    ]);

    const errors = await onPhaseComplete('实现', []);

    expect(errors).toHaveLength(1);
    expect(errors[0].error).toContain('Code quality review found 1 blocking issue(s)');
    expect(errors[0].error).toContain('- src/widget.tsx [no-secrets] hardcoded token');
    expect(errors[0].error).not.toContain('no-console');
  });
});
