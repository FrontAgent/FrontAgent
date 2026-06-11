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

  it('redirects direct process.stdout writes during the run to stderr in JSON mode', async () => {
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    const originalStdoutWrite = process.stdout.write;
    const originalStderrWrite = process.stderr.write;
    process.stdout.write = ((chunk: unknown) => {
      stdoutChunks.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    process.stderr.write = ((chunk: unknown) => {
      stderrChunks.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;

    try {
      const sink: string[] = [];
      const deps = {
        runTask: vi.fn(async () => {
          // 模拟 runtime/工具/第三方库绕过 console 的直接 stdout 写入
          process.stdout.write('runtime noise that would break jq\n');
          console.log('console noise');
          return makeResult();
        }),
        stdout: (line: string) => sink.push(line),
        stderr: (line: string) => sink.push(`[err] ${line}`),
      } as unknown as HeadlessRunDeps;

      const exitCode = await runHeadlessCommand('build it', { output: 'json' }, deps);

      expect(exitCode).toBe(0);
      // 运行期的直接 stdout 写入被转到 stderr，stdout 上没有任何运行期输出
      expect(stdoutChunks).toHaveLength(0);
      expect(stderrChunks.join('')).toContain('runtime noise that would break jq');
      // 最终结果文档仍是唯一一份 JSON
      expect(sink.filter((line) => !line.startsWith('[err]'))).toHaveLength(1);
      expect(JSON.parse(sink[0]).success).toBe(true);
      // 流在返回前恢复
      expect(process.stdout.write).not.toBe(originalStdoutWrite); // 仍是本测试的桩
    } finally {
      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;
    }
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

  it('passes the same raw sdd option and projectRoot as the interactive path', async () => {
    const { deps, runTask } = makeDeps(makeResult());

    await runHeadlessCommand('build it', { output: 'json', sdd: 'configs/sdd.yaml' }, deps);

    // 与交互路径 run.tsx 一致：原样传 options.sdd，
    // 由 runtime 的 runFrontAgentTask 统一 resolve(projectRoot, sddPath ?? 'sdd.yaml')
    const taskOptions = runTask.mock.calls[0][0] as {
      sddPath?: string;
      projectRoot?: string;
    };
    expect(taskOptions.sddPath).toBe('configs/sdd.yaml');
    expect(taskOptions.projectRoot).toBe(process.cwd());
  });

  it('does not leak CLI-only options into the runtime call', async () => {
    const { deps, runTask } = makeDeps(makeResult());

    await runHeadlessCommand(
      'build it',
      { nonInteractive: true, output: 'json', sdd: 'sdd.yaml', model: 'gpt-test' },
      deps,
    );

    const taskOptions = runTask.mock.calls[0][0] as Record<string, unknown>;
    expect(taskOptions).not.toHaveProperty('nonInteractive');
    expect(taskOptions).not.toHaveProperty('output');
    expect(taskOptions).not.toHaveProperty('sdd');
    // runtime 真正消费的字段仍然在
    expect(taskOptions.model).toBe('gpt-test');
    expect(taskOptions.sddPath).toBe('sdd.yaml');
  });

  it('fails fast with exit code 1 on an invalid --output value', async () => {
    const { deps, runTask, stdoutLines, stderrLines } = makeDeps(makeResult());

    const exitCode = await runHeadlessCommand('build it', { output: 'jsn' }, deps);

    expect(exitCode).toBe(1);
    expect(runTask).not.toHaveBeenCalled();
    expect(stdoutLines).toHaveLength(0);
    expect(stderrLines[0]).toContain('无效的 --output 取值');
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
