import type { AgentTask, ExecutionStep } from '@frontagent/shared';
import { describe, expect, it, vi } from 'vitest';
import type { ExecutorActionSkill } from '../skills/index.js';
import { createExecutor, Executor } from './executor.js';
import { ExecutorToolCallHandler } from './tool-call-handler.js';
import type { ExecutorCollectedContext, ExecutorConfig } from './types.js';

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
    hallucinationGuard: {
      validateFilePath: vi.fn(),
      validateCode: vi.fn(),
    } as unknown as ExecutorConfig['hallucinationGuard'],
    llmService: {
      name: 'test',
      generateText: vi.fn(),
      generateObject: vi.fn(),
    } as unknown as ExecutorConfig['llmService'],
    ...overrides,
  };
}

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 't1',
    type: 'create',
    description: 'test',
    ...overrides,
  };
}

function makeCollectedContext(
  overrides: Partial<ExecutorCollectedContext> = {},
): ExecutorCollectedContext {
  return {
    files: new Map(),
    ...overrides,
  };
}

function makeExecutionContext(
  overrides: {
    task?: Partial<AgentTask>;
    collectedContext?: Partial<ExecutorCollectedContext>;
  } = {},
): {
  task: AgentTask;
  collectedContext: ExecutorCollectedContext;
} {
  return {
    task: makeTask(overrides.task),
    collectedContext: makeCollectedContext(overrides.collectedContext),
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
        action: 'read_file',
      } satisfies ExecutorActionSkill;
      executor.registerActionSkill(skill);
      const snapshot = executor.getActionSkillSnapshot();
      expect(snapshot.actionSkills.length).toBeGreaterThan(0);
    });
  });

  describe('callTool', () => {
    it('passes approved security args to the MCP client and emits ask then allow decisions', async () => {
      const approvalHandler = vi.fn().mockResolvedValue(true);
      const decisions: Array<{ decision: string; reasonCode: string; approvalId?: string }> = [];
      const callTool = vi.fn().mockResolvedValue({ success: true });
      const executor = new Executor(
        makeConfig({
          security: { mode: 'strict', interactive: true, auditEnabled: true },
          approvalHandler,
          onSecurityDecision: (decision) => decisions.push(decision),
        }),
      );
      executor.registerMCPClient('files', {
        callTool,
        listTools: vi.fn().mockResolvedValue([]),
      });
      executor.registerToolMapping('create_file', 'files');

      const result = await executor.callTool('create_file', {
        path: 'src/new.ts',
        content: 'export {}',
      });

      expect(result).toEqual(expect.objectContaining({ success: true }));
      expect(approvalHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          decision: 'ask',
          reasonCode: 'strict_file_write_requires_approval',
          toolName: 'create_file',
        }),
      );
      expect(callTool).toHaveBeenCalledWith(
        'create_file',
        expect.objectContaining({
          path: 'src/new.ts',
          content: 'export {}',
          __frontagentSecurityApproved: true,
        }),
      );
      expect(decisions.map((decision) => decision.decision)).toEqual(['ask', 'allow']);
      expect(decisions[1]).toEqual(
        expect.objectContaining({
          reasonCode: 'approved_by_user',
          approvalId: expect.any(String),
        }),
      );
    });

    it('fails closed without invoking the MCP client when approval is unavailable', async () => {
      const decisions: Array<{ decision: string; reasonCode: string }> = [];
      const callTool = vi.fn().mockResolvedValue({ success: true });
      const executor = new Executor(
        makeConfig({
          security: { mode: 'strict', interactive: false, auditEnabled: true },
          onSecurityDecision: (decision) => decisions.push(decision),
        }),
      );
      executor.registerMCPClient('files', {
        callTool,
        listTools: vi.fn().mockResolvedValue([]),
      });
      executor.registerToolMapping('create_file', 'files');

      const result = await executor.callTool('create_file', {
        path: 'src/new.ts',
        content: 'export {}',
      });

      expect(result).toEqual({
        success: false,
        error: 'Approval is required but no interactive approval channel is available.',
      });
      expect(callTool).not.toHaveBeenCalled();
      expect(decisions).toEqual([
        expect.objectContaining({
          decision: 'ask',
          reasonCode: 'strict_file_write_requires_approval',
        }),
        expect.objectContaining({
          decision: 'deny',
          reasonCode: 'security_approval_unavailable',
        }),
      ]);
    });

    it('updates browser context only after successful navigation results', async () => {
      const callTool = vi
        .fn()
        .mockResolvedValueOnce({ success: false, error: 'navigation failed' })
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: true });
      const executor = new Executor(
        makeConfig({
          security: { mode: 'balanced', interactive: false, auditEnabled: true },
        }),
      );
      executor.registerMCPClient('browser', {
        callTool,
        listTools: vi.fn().mockResolvedValue([]),
      });
      executor.registerToolMapping('browser_navigate', 'browser');
      executor.registerToolMapping('browser_click', 'browser');

      const failedNavigate = await executor.callTool('browser_navigate', {
        url: 'http://localhost:5173',
      });
      const clickAfterFailure = await executor.callTool('browser_click', { selector: '#submit' });
      const successfulNavigate = await executor.callTool('browser_navigate', {
        url: 'http://localhost:5173',
      });
      const clickAfterSuccess = await executor.callTool('browser_click', { selector: '#submit' });

      expect(failedNavigate).toEqual(expect.objectContaining({ success: false }));
      expect(clickAfterFailure).toEqual(
        expect.objectContaining({
          success: false,
          error: 'Approval is required but no interactive approval channel is available.',
        }),
      );
      expect(successfulNavigate).toEqual(expect.objectContaining({ success: true }));
      expect(clickAfterSuccess).toEqual(expect.objectContaining({ success: true }));
      expect(callTool).toHaveBeenCalledTimes(3);
      expect(callTool).toHaveBeenNthCalledWith(3, 'browser_click', { selector: '#submit' });
    });
  });

  describe('ExecutorToolCallHandler', () => {
    it('classifies object results with success false as unsuccessful', () => {
      const handler = new ExecutorToolCallHandler({
        config: makeConfig(),
        mcpClients: new Map(),
        toolToClient: new Map(),
        nowMs: () => 0,
        getCurrentBrowserUrl: () => undefined,
      });

      expect(handler.isSuccessfulToolResult({ success: false })).toBe(false);
      expect(handler.isSuccessfulToolResult({ success: true })).toBe(true);
      expect(handler.isSuccessfulToolResult({})).toBe(true);
      expect(handler.isSuccessfulToolResult('ok')).toBe(true);
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

      const result = await executor.executeStep(step, makeExecutionContext());

      expect(result.stepResult.success).toBe(true);
      expect(result.stepResult.output).toEqual(expect.objectContaining({ skipped: true }));
    });

    it('returns the skipped output shape for invalid params', async () => {
      const executor = new Executor(makeConfig({ debug: false }));
      const step = makeStep({
        action: 'read_file',
        tool: 'read_file',
        params: {},
      });

      const result = await executor.executeStep(step, makeExecutionContext());

      expect(result.stepResult).toEqual(
        expect.objectContaining({
          success: true,
          output: {
            skipped: true,
            reason: 'read_file requires non-empty path parameter',
          },
        }),
      );
      expect(result.validation).toEqual({ pass: true, results: [] });
      expect(result.needsRollback).toBe(false);
    });

    it('skips step with empty path', async () => {
      const executor = new Executor(makeConfig({ debug: false }));
      const step = makeStep({
        action: 'read_file',
        tool: 'read_file',
        params: { path: '' },
      });

      const result = await executor.executeStep(step, makeExecutionContext());

      expect(result.stepResult.success).toBe(true);
      expect(result.stepResult.output).toEqual(expect.objectContaining({ skipped: true }));
    });

    it('returns exists false when pre-validation skips a missing read file', async () => {
      const executor = new Executor(
        makeConfig({
          debug: false,
          hallucinationGuard: {
            validateFilePath: vi.fn().mockResolvedValue({
              pass: false,
              type: 'file_not_found',
              severity: 'block',
              message: 'File src/missing.ts does not exist',
            }),
            validateCode: vi.fn(),
          } as unknown as ExecutorConfig['hallucinationGuard'],
        }),
      );
      const step = makeStep({
        action: 'read_file',
        tool: 'read_file',
        params: { path: 'src/missing.ts' },
      });

      const result = await executor.executeStep(step, makeExecutionContext());

      expect(result.stepResult).toEqual(
        expect.objectContaining({
          success: true,
          output: {
            skipped: true,
            reason: 'File src/missing.ts does not exist',
            exists: false,
          },
        }),
      );
      expect(result.validation).toEqual({ pass: true, results: [] });
      expect(result.needsRollback).toBe(false);
    });

    it('returns the skipped output shape for skippable tool errors', async () => {
      const executor = new Executor(
        makeConfig({
          debug: false,
          hallucinationGuard: {
            validateFilePath: vi.fn().mockResolvedValue({
              pass: true,
              type: 'file_exists',
              severity: 'info',
            }),
            validateCode: vi.fn(),
          } as unknown as ExecutorConfig['hallucinationGuard'],
        }),
      );
      executor.registerMCPClient('test-client', {
        callTool: vi.fn().mockResolvedValue({ success: false, error: 'Not a directory' }),
        listTools: vi.fn().mockResolvedValue([]),
      });
      executor.registerToolMapping('read_file', 'test-client');
      const step = makeStep({
        action: 'read_file',
        tool: 'read_file',
        params: { path: 'src/a.ts' },
      });

      const result = await executor.executeStep(step, makeExecutionContext());

      expect(result.stepResult).toEqual(
        expect.objectContaining({
          success: true,
          output: {
            skipped: true,
            reason: 'Not a directory',
          },
        }),
      );
      expect(result.validation).toEqual({ pass: true, results: [] });
      expect(result.needsRollback).toBe(false);
    });

    it('returns validation result structure', async () => {
      const executor = new Executor(makeConfig());
      const step = makeStep({
        action: 'read_file',
        tool: 'read_file',
        params: {},
      });

      const result = await executor.executeStep(step, makeExecutionContext());

      expect(result).toHaveProperty('stepResult');
      expect(result).toHaveProperty('validation');
      expect(result).toHaveProperty('needsRollback');
    });
  });

  describe('executeSteps', () => {
    it('returns empty results for empty steps', async () => {
      const executor = new Executor(makeConfig());
      const results = await executor.executeSteps([], makeExecutionContext());
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

      await expect(executor.executeSteps([step], makeExecutionContext())).rejects.toThrow(
        'Circular dependency detected or missing dependency',
      );
    });

    it('calls onStepComplete callback', async () => {
      const executor = new Executor(makeConfig());
      const step = makeStep({
        action: 'read_file',
        tool: 'read_file',
        params: {},
      });

      const onStepComplete = vi.fn();

      await executor.executeSteps([step], makeExecutionContext(), onStepComplete);

      expect(onStepComplete).toHaveBeenCalledWith(step, expect.any(Object));
    });
  });

  describe('executeStepsWithErrorFeedback', () => {
    it('returns empty results for empty steps', async () => {
      const executor = new Executor(makeConfig());
      const results = await executor.executeStepsWithErrorFeedback([], makeExecutionContext());
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
        makeExecutionContext(),
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
          makeExecutionContext(),
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

      await executor.executeStepsWithErrorFeedback([step], makeExecutionContext());

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

      await executor.executeStepsWithErrorFeedback([step], makeExecutionContext());

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
