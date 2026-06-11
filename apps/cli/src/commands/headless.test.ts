import type { AgentEvent, AgentExecutionResult } from '@frontagent/runtime-node';
import { describe, expect, it, vi } from 'vitest';
import {
  buildHeadlessPayload,
  collectDeniedApproval,
  type DeniedApproval,
  type HeadlessRunDeps,
  runHeadlessCommand,
} from './headless.js';

function makeResult(overrides: Partial<AgentExecutionResult> = {}): AgentExecutionResult {
  return {
    success: true,
    taskId: 'task-1',
    executedSteps: [
      {
        stepId: 's1',
        description: 'read file',
        action: 'read_file',
        tool: 'read_file',
        params: {},
        dependencies: [],
        validation: [],
        status: 'completed',
      },
    ],
    output: 'all done',
    duration: 1234,
    validations: [],
    ...overrides,
  };
}

function makeDeps(result: AgentExecutionResult | Error) {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  const runTask = vi.fn(async (options: { onEvent?: (event: AgentEvent) => void }) => {
    if (result instanceof Error) throw result;
    options.onEvent?.({
      type: 'security_decision',
      decision: {
        decision: 'deny',
        riskLevel: 'high',
        reasonCode: 'security_approval_unavailable',
        message: 'Approval is required but no interactive approval channel is available.',
        toolName: 'run_command',
        argsSummary: 'run_command: rm -rf dist',
        provenance: [],
      },
    });
    return result;
  });

  const deps = {
    runTask,
    stdout: (line: string) => stdoutLines.push(line),
    stderr: (line: string) => stderrLines.push(line),
  } as unknown as HeadlessRunDeps;

  return { deps, runTask, stdoutLines, stderrLines };
}

describe('buildHeadlessPayload', () => {
  it('maps the execution result into a machine-parseable document', () => {
    const denied: DeniedApproval[] = [
      { toolName: 'run_command', reasonCode: 'security_approval_unavailable', message: 'denied' },
    ];
    const payload = buildHeadlessPayload(makeResult(), denied, '/tmp/run.log');

    expect(payload).toMatchObject({
      success: true,
      taskId: 'task-1',
      output: 'all done',
      durationMs: 1234,
      runLogPath: '/tmp/run.log',
    });
    expect(payload.steps).toEqual([
      {
        stepId: 's1',
        description: 'read file',
        action: 'read_file',
        tool: 'read_file',
        status: 'completed',
        error: undefined,
      },
    ]);
    expect(payload.deniedApprovals).toBe(denied);
  });
});

describe('collectDeniedApproval', () => {
  it('collects only fail-closed approval denials', () => {
    const sink: DeniedApproval[] = [];
    const base = {
      riskLevel: 'high' as const,
      message: 'msg',
      toolName: 'run_command',
      argsSummary: 'x',
      provenance: [],
    };

    collectDeniedApproval(
      {
        type: 'security_decision',
        decision: { ...base, decision: 'deny', reasonCode: 'security_approval_unavailable' },
      },
      sink,
    );
    collectDeniedApproval(
      {
        type: 'security_decision',
        decision: { ...base, decision: 'deny', reasonCode: 'dangerous_shell_command' },
      },
      sink,
    );
    collectDeniedApproval(
      {
        type: 'security_decision',
        decision: { ...base, decision: 'allow', reasonCode: 'read_tool_allowed' },
      },
      sink,
    );

    expect(sink).toHaveLength(1);
    expect(sink[0].toolName).toBe('run_command');
  });
});

describe('runHeadlessCommand', () => {
  it('emits one JSON document on stdout and returns exit code 0 on success', async () => {
    const { deps, runTask, stdoutLines } = makeDeps(makeResult());

    const exitCode = await runHeadlessCommand('build it', { output: 'json' }, deps);

    expect(exitCode).toBe(0);
    expect(stdoutLines).toHaveLength(1);
    const payload = JSON.parse(stdoutLines[0]);
    expect(payload.success).toBe(true);
    expect(payload.deniedApprovals).toHaveLength(1);
    // 不提供审批通道：敏感调用 fail-closed
    expect(runTask.mock.calls[0][0].onApprovalRequest).toBeUndefined();
  });

  it('returns exit code 1 when the task fails', async () => {
    const { deps, stdoutLines } = makeDeps(makeResult({ success: false, error: 'step failed' }));

    const exitCode = await runHeadlessCommand('build it', { output: 'json' }, deps);

    expect(exitCode).toBe(1);
    expect(JSON.parse(stdoutLines[0]).error).toBe('step failed');
  });

  it('returns exit code 1 and a JSON error document when the runner throws', async () => {
    const { deps, stdoutLines } = makeDeps(new Error('boom'));

    const exitCode = await runHeadlessCommand('build it', { output: 'json' }, deps);

    expect(exitCode).toBe(1);
    const payload = JSON.parse(stdoutLines[0]);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('boom');
  });

  it('prints a human summary in text mode', async () => {
    const { deps, stdoutLines, stderrLines } = makeDeps(makeResult());

    const exitCode = await runHeadlessCommand('build it', { output: 'text' }, deps);

    expect(exitCode).toBe(0);
    expect(stdoutLines[0]).toContain('任务执行成功');
    expect(stdoutLines[1]).toBe('all done');
    expect(stderrLines[0]).toContain('run_command');
  });
});
