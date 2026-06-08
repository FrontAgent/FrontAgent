import type { ExecutionStep } from '@frontagent/shared';
import { describe, expect, it, vi } from 'vitest';
import { createExecutor, Executor } from './executor.js';
import type { ExecutorConfig } from './types.js';

function makeStep(overrides: Partial<ExecutionStep> = {}): ExecutionStep {
  return {
    stepId: 'step-1',
    description: 'Test step',
    action: 'create_file',
    tool: 'create_file',
    params: { path: 'src/a.ts', content: 'export {}' },
    dependencies: [],
    validation: [],
    status: 'pending',
    phase: 'build',
    ...overrides,
  };
}

function makeConfig(overrides: Partial<ExecutorConfig> = {}): ExecutorConfig {
  return {
    projectRoot: '/test',
    hallucinationGuard: { enabled: false } as any,
    llmService: { name: 'test', generateText: vi.fn(), generateObject: vi.fn() } as any,
    ...overrides,
  };
}

describe('Executor', () => {
  describe('constructor', () => {
    it('creates executor with config', () => {
      const executor = new Executor(makeConfig({ debug: true }));
      expect(executor).toBeDefined();
    });

    it('creates executor with parallel execution', () => {
      const executor = new Executor(makeConfig({ parallelExecution: true }));
      expect(executor).toBeDefined();
    });

    it('creates executor with langgraph config', () => {
      const executor = new Executor(
        makeConfig({
          executionEngine: 'langgraph',
          langGraph: { enabled: true, maxRecoveryAttempts: 5 },
        }),
      );
      expect(executor).toBeDefined();
    });
  });

  describe('registerMCPClient', () => {
    it('registers an MCP client', () => {
      const executor = new Executor(makeConfig());
      const client = {
        callTool: vi.fn().mockResolvedValue({}),
        listTools: vi.fn().mockResolvedValue([]),
      };
      executor.registerMCPClient('test-client', client);
    });
  });

  describe('registerToolMapping', () => {
    it('registers a tool mapping', () => {
      const executor = new Executor(makeConfig());
      executor.registerToolMapping('my-tool', 'test-client');
    });
  });

  describe('registerActionSkill', () => {
    it('registers an action skill', () => {
      const executor = new Executor(makeConfig());
      const skill = {
        name: 'test-skill',
        match: vi.fn().mockReturnValue(true),
        execute: vi.fn().mockResolvedValue({ success: true, output: 'ok', duration: 10 }),
      };
      executor.registerActionSkill(skill as any);
      const snapshot = executor.getActionSkillSnapshot();
      expect(snapshot.actionSkills.length).toBeGreaterThan(0);
    });
  });

  describe('getActionSkillSnapshot', () => {
    it('returns a snapshot of registered skills', () => {
      const executor = new Executor(makeConfig());
      const snapshot = executor.getActionSkillSnapshot();
      expect(snapshot).toBeDefined();
      expect(snapshot.actionSkills).toBeInstanceOf(Array);
      expect(snapshot.byAction).toBeDefined();
    });
  });

  describe('executeStep', () => {
    it('skips step with invalid params (missing path)', async () => {
      const executor = new Executor(makeConfig({ debug: false }));
      const step = makeStep({
        action: 'read_file',
        tool: 'read_file',
        params: {},
      });

      const result = await executor.executeStep(step, {
        task: { id: 't1', type: 'create', description: 'test' } as any,
        collectedContext: { files: new Map(), metadata: {} } as any,
      });

      expect(result.stepResult.success).toBe(true);
      expect(result.stepResult.output).toEqual(expect.objectContaining({ skipped: true }));
    });

    it('skips step with empty path', async () => {
      const executor = new Executor(makeConfig({ debug: false }));
      const step = makeStep({
        action: 'read_file',
        tool: 'read_file',
        params: { path: '' },
      });

      const result = await executor.executeStep(step, {
        task: { id: 't1', type: 'create', description: 'test' } as any,
        collectedContext: { files: new Map(), metadata: {} } as any,
      });

      expect(result.stepResult.success).toBe(true);
      expect(result.stepResult.output).toEqual(expect.objectContaining({ skipped: true }));
    });

    it('returns validation result structure', async () => {
      const executor = new Executor(makeConfig());
      const step = makeStep({
        action: 'read_file',
        tool: 'read_file',
        params: {},
      });

      const result = await executor.executeStep(step, {
        task: { id: 't1', type: 'create', description: 'test' } as any,
        collectedContext: { files: new Map(), metadata: {} } as any,
      });

      expect(result).toHaveProperty('stepResult');
      expect(result).toHaveProperty('validation');
      expect(result).toHaveProperty('needsRollback');
    });
  });

  describe('executeSteps', () => {
    it('returns empty results for empty steps', async () => {
      const executor = new Executor(makeConfig());
      const results = await executor.executeSteps([], {
        task: { id: 't1', type: 'create', description: 'test' } as any,
        collectedContext: { files: new Map(), metadata: {} } as any,
      });
      expect(results).toEqual([]);
    });

    it('throws on missing dependency', async () => {
      const executor = new Executor(makeConfig());
      const step = makeStep({
        stepId: 's1',
        dependencies: ['missing-dep'],
        action: 'read_file',
        tool: 'read_file',
        params: { path: 'a.ts' },
      });

      await expect(
        executor.executeSteps([step], {
          task: { id: 't1', type: 'create', description: 'test' } as any,
          collectedContext: { files: new Map(), metadata: {} } as any,
        }),
      ).rejects.toThrow('Circular dependency detected or missing dependency');
    });

    it('calls onStepComplete callback', async () => {
      const executor = new Executor(makeConfig());
      const step = makeStep({
        action: 'read_file',
        tool: 'read_file',
        params: {},
      });

      const onStepComplete = vi.fn();

      await executor.executeSteps(
        [step],
        {
          task: { id: 't1', type: 'create', description: 'test' } as any,
          collectedContext: { files: new Map(), metadata: {} } as any,
        },
        onStepComplete,
      );

      expect(onStepComplete).toHaveBeenCalledWith(step, expect.any(Object));
    });
  });

  describe('executeStepsWithErrorFeedback', () => {
    it('returns empty results for empty steps', async () => {
      const executor = new Executor(makeConfig());
      const results = await executor.executeStepsWithErrorFeedback([], {
        task: { id: 't1', type: 'create', description: 'test' } as any,
        collectedContext: { files: new Map(), metadata: {} } as any,
      });
      expect(results).toEqual([]);
    });

    it('calls onStepStart and onStepComplete callbacks', async () => {
      const executor = new Executor(makeConfig());
      const step = makeStep({
        action: 'read_file',
        tool: 'read_file',
        params: {},
      });

      const onStepStart = vi.fn();
      const onStepComplete = vi.fn();

      await executor.executeStepsWithErrorFeedback(
        [step],
        {
          task: { id: 't1', type: 'create', description: 'test' } as any,
          collectedContext: { files: new Map(), metadata: {} } as any,
        },
        onStepStart,
        onStepComplete,
      );

      expect(onStepStart).toHaveBeenCalledWith(step);
      expect(onStepComplete).toHaveBeenCalledWith(step, expect.any(Object));
    });

    it('respects AbortSignal', async () => {
      const executor = new Executor(makeConfig());
      const controller = new AbortController();
      const step = makeStep({
        action: 'read_file',
        tool: 'read_file',
        params: {},
      });

      controller.abort();

      await expect(
        executor.executeStepsWithErrorFeedback(
          [step],
          {
            task: { id: 't1', type: 'create', description: 'test' } as any,
            collectedContext: { files: new Map(), metadata: {} } as any,
          },
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          controller.signal,
        ),
      ).rejects.toThrow();
    });

    it('marks step as skipped with unmet dependencies', async () => {
      const executor = new Executor(makeConfig());
      const step = makeStep({
        stepId: 's1',
        dependencies: ['missing-dep'],
        action: 'read_file',
        tool: 'read_file',
        params: { path: 'a.ts' },
      });

      await executor.executeStepsWithErrorFeedback([step], {
        task: { id: 't1', type: 'create', description: 'test' } as any,
        collectedContext: { files: new Map(), metadata: {} } as any,
      });

      expect(step.status).toBe('skipped');
    });
  });

  describe('trace', () => {
    it('calls onStepTrace when trace is enabled', async () => {
      const onStepTrace = vi.fn();
      const executor = new Executor(
        makeConfig({
          trace: { enabled: true, onStepTrace },
        }),
      );
      const step = makeStep({
        action: 'read_file',
        tool: 'read_file',
        params: {},
      });

      await executor.executeStepsWithErrorFeedback([step], {
        task: { id: 't1', type: 'create', description: 'test' } as any,
        collectedContext: { files: new Map(), metadata: {} } as any,
      });

      expect(onStepTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 't1',
          stepId: 'step-1',
          action: 'read_file',
          tool: 'read_file',
        }),
      );
    });
  });

  describe('createExecutor factory', () => {
    it('returns an Executor instance', () => {
      const executor = createExecutor(makeConfig());
      expect(executor).toBeInstanceOf(Executor);
    });
  });
});
