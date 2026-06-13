import type { AgentConfig, AgentEvent, AgentEventListener } from '@frontagent/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Orchestration tests for runFrontAgentTask.
 *
 * run.ts hard-constructs its collaborators (createAgent, the MCP clients, the
 * run logger). We fake those module boundaries with vi.mock so the real
 * orchestration body runs against controllable doubles — no network, no LLM,
 * no disk. The fake agent lets a test emit a scripted AgentEvent sequence and
 * resolve/reject execute() on demand; shared spies record a global ordering
 * trace so the finally-block shutdown sequence can be asserted directly.
 *
 * This stays test-only: no production source is touched. The seams used
 * (createAgent / MCP client / run-logger / hooks module exports) already exist.
 */

// ---- shared ordering trace + controllable handles --------------------------

const order: string[] = [];

interface FakeAgent {
  emit(event: AgentEvent): void;
  config: AgentConfig;
  resolveExecute(result: unknown): void;
  rejectExecute(error: unknown): void;
  executeCalls: Array<{ task: string; options: Record<string, unknown> }>;
  snapshot: unknown;
}

let currentAgent: FakeAgent | undefined;

const createAgent = vi.fn((config: AgentConfig) => {
  const listeners: AgentEventListener[] = [];
  let resolveExec!: (value: unknown) => void;
  let rejectExec!: (reason: unknown) => void;
  const executeCalls: Array<{ task: string; options: Record<string, unknown> }> = [];
  const fake: FakeAgent = {
    config,
    executeCalls,
    snapshot: { phase: 'done', steps: [] },
    emit(event) {
      for (const listener of listeners) listener(event);
    },
    resolveExecute(result) {
      resolveExec(result);
    },
    rejectExecute(error) {
      rejectExec(error);
    },
  };
  currentAgent = fake;
  return {
    addEventListener: (listener: AgentEventListener) => listeners.push(listener),
    registerMCPClient: vi.fn(),
    registerFileTools: vi.fn(),
    registerMemoryTools: vi.fn(),
    registerShellTools: vi.fn(),
    registerWebTools: vi.fn(),
    getSessionSnapshot: () => fake.snapshot,
    execute: (task: string, options: Record<string, unknown>) => {
      executeCalls.push({ task, options });
      return new Promise((res, rej) => {
        resolveExec = res;
        rejectExec = rej;
      });
    },
  };
});

vi.mock('@frontagent/core', () => ({
  createAgent: (config: AgentConfig) => createAgent(config),
}));

// MCP clients: benign constructors, web.close() records ordering.
const webClose = vi.fn(async () => {
  order.push('web.close');
});
vi.mock('./mcp-clients.js', () => ({
  FileMCPClient: vi.fn(function FileMCPClient() {}),
  MemoryMCPClient: vi.fn(function MemoryMCPClient() {}),
  WebMCPClient: vi.fn(function WebMCPClient() {
    return { close: webClose };
  }),
}));

vi.mock('@frontagent/mcp-shell', () => ({
  createShellMCPClient: vi.fn(() => ({})),
}));

// Run logger: spy whose close() records ordering and resolves.
const loggerClose = vi.fn(async () => {
  order.push('logger.close');
});
const createRunLogger = vi.fn(() => ({
  path: '/tmp/run.log',
  console: vi.fn(),
  event: vi.fn(),
  result: vi.fn(),
  error: vi.fn(),
  close: loggerClose,
}));
vi.mock('./run-logger.js', () => ({
  createRunLogger: () => createRunLogger(),
  installRunConsoleFilter: vi.fn(() => () => {}),
}));

// Session store: saveSessionRecord records ordering + the persisted status.
const saveSessionRecord = vi.fn((_root: string, record: { status: string }) => {
  order.push(`persist:${record.status}`);
});
vi.mock('./session-store.js', () => ({
  createSessionId: () => 'fake-session-id',
  saveSessionRecord: (root: string, record: { status: string }) => saveSessionRecord(root, record),
  loadSessionRecord: vi.fn(),
  findLatestResumableSession: vi.fn(),
  listSessionRecords: vi.fn(() => []),
}));

// taskComplete hooks: each invocation returns a deferred promise so a test can
// hold the drain open and prove the finally-block awaits it before logger.close.
interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}
let pendingHookDeferreds: Deferred[] = [];
const runTaskCompleteHooks = vi.fn(() => {
  let resolveFn!: () => void;
  const promise = new Promise<void>((res) => {
    resolveFn = res;
  });
  pendingHookDeferreds.push({
    promise,
    resolve: () => {
      order.push('hook.settled');
      resolveFn();
    },
  });
  return promise;
});
vi.mock('./hooks.js', () => ({
  createAgentLifecycleHooks: vi.fn(() => undefined),
  loadHooksSettings: vi.fn(() => undefined),
  runTaskCompleteHooks: (...args: unknown[]) => runTaskCompleteHooks(...args),
  shouldEnableProjectHooks: vi.fn(() => false),
}));

// settings.js: pure project settings reads — keep them inert.
vi.mock('./settings.js', () => ({
  loadProjectSettings: vi.fn(() => ({ permissions: undefined })),
  appendAllowRuleToSettings: vi.fn(),
}));

const { runFrontAgentTask } = await import('./run.js');

function baseOptions(overrides: Record<string, unknown> = {}) {
  return {
    projectRoot: '/tmp/project',
    task: 'do a thing',
    type: 'query',
    disableRag: true,
    runLog: false,
    ...overrides,
  } as Parameters<typeof runFrontAgentTask>[0];
}

const SUCCESS_RESULT = {
  success: true,
  taskId: 't-1',
  executedSteps: [],
  duration: 5,
  validations: [],
};

beforeEach(() => {
  order.length = 0;
  pendingHookDeferreds = [];
  currentAgent = undefined;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

/** Drives a full run: starts the task, runs the driver, then resolves. */
async function runWith(
  options: Parameters<typeof runFrontAgentTask>[0],
  driver: (agent: FakeAgent) => void,
) {
  const promise = runFrontAgentTask(options);
  // Allow the synchronous setup (createAgent, listener wiring, execute call) to run.
  await Promise.resolve();
  if (!currentAgent) throw new Error('agent was not constructed');
  driver(currentAgent);
  return promise;
}

describe('runFrontAgentTask orchestration', () => {
  it('enforces the full shutdown ordering on the success path: hooks drained → logger closed → session persisted', async () => {
    const result = await runWith(baseOptions(), (agent) => {
      agent.emit({ type: 'task_completed', result: SUCCESS_RESULT } as AgentEvent);
      // The hook drain promise is now pending; resolve it slightly later so the
      // finally block must await it. Resolve after a macrotask.
      setTimeout(() => {
        for (const d of pendingHookDeferreds) d.resolve();
      }, 0);
      agent.resolveExecute(SUCCESS_RESULT);
    });

    expect(result.success).toBe(true);
    expect(runTaskCompleteHooks).toHaveBeenCalledTimes(1);
    expect(loggerClose).toHaveBeenCalledTimes(1);
    expect(webClose).toHaveBeenCalledTimes(1);

    // Issue #308 acceptance ordering: taskComplete hooks drained, THEN the run
    // logger is closed, THEN the FINAL session status is persisted. The final
    // persist is the last persist:* entry (an earlier one is written by the
    // terminal-event listener during dispatch).
    const hookIdx = order.indexOf('hook.settled');
    const closeIdx = order.indexOf('logger.close');
    const finalPersistIdx = order.lastIndexOf('persist:completed');
    expect(hookIdx).toBeGreaterThanOrEqual(0);
    expect(hookIdx).toBeLessThan(closeIdx);
    expect(closeIdx).toBeLessThan(finalPersistIdx);
  });

  it('enforces the full shutdown ordering when execute throws: hooks drained → logger closed → failed session persisted', async () => {
    const result = await runWith(baseOptions(), (agent) => {
      // task_failed fires, enqueueing a taskComplete hook, then execute rejects.
      agent.emit({ type: 'task_failed', error: 'boom', taskId: 't-err' } as AgentEvent);
      setTimeout(() => {
        for (const d of pendingHookDeferreds) d.resolve();
      }, 0);
      agent.rejectExecute(new Error('boom'));
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('boom');
    expect(runTaskCompleteHooks).toHaveBeenCalledTimes(1);
    expect(loggerClose).toHaveBeenCalledTimes(1);

    const hookIdx = order.indexOf('hook.settled');
    const closeIdx = order.indexOf('logger.close');
    const finalPersistIdx = order.lastIndexOf('persist:failed');
    expect(hookIdx).toBeLessThan(closeIdx);
    expect(closeIdx).toBeLessThan(finalPersistIdx);
  });

  it('persists a terminal failed status after close even when execute throws without emitting a terminal event', async () => {
    // No task_failed/task_completed event is emitted; execute simply rejects.
    // The finally block must still persist a terminal (failed) status so the
    // session never stays stuck at "running".
    await runWith(baseOptions(), (agent) => {
      agent.rejectExecute(new Error('crash before any terminal event'));
    });

    const statuses = saveSessionRecord.mock.calls.map((c) => c[1].status);
    expect(statuses).toEqual(['failed']);
    // And it is written after the logger closes.
    expect(order.indexOf('logger.close')).toBeLessThan(order.lastIndexOf('persist:failed'));
  });

  it('persists a terminal completed status when execute resolves successfully without emitting a terminal event', async () => {
    // execute() resolves success but emits no task_completed event. The final
    // status must be derived from the result (completed), never the failed
    // default — otherwise a successful run would be mis-persisted as failed.
    await runWith(baseOptions(), (agent) => {
      agent.resolveExecute(SUCCESS_RESULT);
    });

    const statuses = saveSessionRecord.mock.calls.map((c) => c[1].status);
    expect(statuses).toEqual(['completed']);
    expect(order.indexOf('logger.close')).toBeLessThan(order.lastIndexOf('persist:completed'));
  });

  it('persists session snapshots on planning, step, and terminal events', async () => {
    await runWith(baseOptions(), (agent) => {
      agent.emit({ type: 'planning_completed', plan: { steps: [] } } as unknown as AgentEvent);
      agent.emit({
        type: 'step_completed',
        step: { id: 's1' },
        result: {},
      } as unknown as AgentEvent);
      agent.emit({
        type: 'step_failed',
        step: { id: 's2' },
        error: 'x',
      } as unknown as AgentEvent);
      agent.emit({ type: 'task_completed', result: SUCCESS_RESULT } as AgentEvent);
      for (const d of pendingHookDeferreds) d.resolve();
      agent.resolveExecute(SUCCESS_RESULT);
    });

    const statuses = saveSessionRecord.mock.calls.map((c) => c[1].status);
    // planning_completed, step_completed, step_failed → running (listener);
    // task_completed → completed (listener); then the finally block re-persists
    // the final completed status after the logger closes.
    expect(statuses).toEqual(['running', 'running', 'running', 'completed', 'completed']);
  });

  it('persists a failed status on task_failed', async () => {
    await runWith(baseOptions(), (agent) => {
      agent.emit({ type: 'task_failed', error: 'nope', taskId: 't' } as AgentEvent);
      for (const d of pendingHookDeferreds) d.resolve();
      agent.resolveExecute(SUCCESS_RESULT);
    });

    const statuses = saveSessionRecord.mock.calls.map((c) => c[1].status);
    expect(statuses).toContain('failed');
  });

  it('routes enableProjectHooks into shouldEnableProjectHooks gating', async () => {
    const { shouldEnableProjectHooks } = await import('./hooks.js');
    await runWith(baseOptions({ enableProjectHooks: true }), (agent) => {
      agent.emit({ type: 'task_completed', result: SUCCESS_RESULT } as AgentEvent);
      for (const d of pendingHookDeferreds) d.resolve();
      agent.resolveExecute(SUCCESS_RESULT);
    });
    expect(shouldEnableProjectHooks).toHaveBeenCalledWith(true);
  });

  it('routes resumeSession into the agent execute resume option', async () => {
    const { loadSessionRecord } = await import('./session-store.js');
    (loadSessionRecord as ReturnType<typeof vi.fn>).mockReturnValue({
      sessionId: 'prior',
      createdAt: '2026-01-01T00:00:00.000Z',
      status: 'running',
      updatedAt: '2026-01-01T00:00:00.000Z',
      snapshot: { phase: 'resumed' },
    });

    const result = await runWith(baseOptions({ resumeSession: 'prior' }), (agent) => {
      agent.emit({ type: 'task_completed', result: SUCCESS_RESULT } as AgentEvent);
      for (const d of pendingHookDeferreds) d.resolve();
      agent.resolveExecute(SUCCESS_RESULT);
    });

    expect(result.success).toBe(true);
    expect(loadSessionRecord).toHaveBeenCalledWith('/tmp/project', 'prior');
    const call = currentAgent?.executeCalls[0];
    expect(call?.options.resume).toEqual({ phase: 'resumed' });
  });

  it('throws-into-result when resumeSession id cannot be found', async () => {
    const { loadSessionRecord } = await import('./session-store.js');
    (loadSessionRecord as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

    const promise = runFrontAgentTask(baseOptions({ resumeSession: 'missing' }));
    // No execute() call happens — the resume lookup throws before agent.execute.
    const result = await promise;

    expect(result.success).toBe(false);
    expect(result.error).toContain('未找到可恢复的会话');
    // Logger still closed on the error path.
    expect(loggerClose).toHaveBeenCalledTimes(1);
  });

  it('does not register memory tools when RAG is disabled', async () => {
    await runWith(baseOptions({ disableRag: true }), (agent) => {
      agent.emit({ type: 'task_completed', result: SUCCESS_RESULT } as AgentEvent);
      for (const d of pendingHookDeferreds) d.resolve();
      agent.resolveExecute(SUCCESS_RESULT);
    });
    // The fake agent's registerMemoryTools is per-instance; assert via MemoryMCPClient.
    const { MemoryMCPClient } = await import('./mcp-clients.js');
    expect(MemoryMCPClient).not.toHaveBeenCalled();
  });
});
