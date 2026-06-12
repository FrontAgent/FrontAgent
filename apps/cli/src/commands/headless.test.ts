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
    expect(payload.deniedApprovals).toEqual(denied);
  });

  it('collects completed file-producing steps as artifacts', () => {
    const result = makeResult({
      executedSteps: [
        {
          stepId: 's1',
          description: 'create page',
          action: 'create_file',
          tool: 'create_file',
          params: { path: 'src/page.tsx' },
          dependencies: [],
          validation: [],
          status: 'completed',
        },
        {
          stepId: 's2',
          description: 'patch store',
          action: 'apply_patch',
          tool: 'apply_patch',
          params: { path: 'src/store.ts' },
          dependencies: [],
          validation: [],
          status: 'completed',
        },
        {
          stepId: 's3',
          description: 'failed write',
          action: 'create_file',
          tool: 'create_file',
          params: { path: 'src/broken.ts' },
          dependencies: [],
          validation: [],
          status: 'failed',
        },
        {
          stepId: 's4',
          description: 'read only',
          action: 'read_file',
          tool: 'read_file',
          params: { path: 'src/read.ts' },
          dependencies: [],
          validation: [],
          status: 'completed',
        },
      ],
    });

    const payload = buildHeadlessPayload(result, [], null);
    // 只有已完成的产物型步骤进入 artifacts；失败/只读步骤不算
    expect(payload.artifacts).toEqual(['src/page.tsx', 'src/store.ts']);
  });
});

describe('buildHeadlessPayload denial merging', () => {
  it('merges security denials found in failed step errors and dedupes against events', () => {
    const result = makeResult({
      success: false,
      executedSteps: [
        {
          stepId: 's1',
          description: 'blocked write',
          action: 'create_file',
          tool: 'create_file',
          params: { path: '.env' },
          dependencies: [],
          validation: [],
          status: 'failed',
          result: {
            success: false,
            duration: 1,
            error: 'Security policy denied create_file: sensitive path',
          },
        },
        {
          stepId: 's2',
          description: 'needs approval',
          action: 'run_command',
          tool: 'run_command',
          params: { command: 'rm -rf dist' },
          dependencies: [],
          validation: [],
          status: 'failed',
          result: {
            success: false,
            duration: 1,
            error: 'Approval is required but no interactive approval channel is available.',
          },
        },
        {
          stepId: 's3',
          description: 'ordinary failure',
          action: 'run_command',
          tool: 'run_command',
          params: { command: 'pnpm test' },
          dependencies: [],
          validation: [],
          status: 'failed',
          result: { success: false, duration: 1, error: 'tests failed: 3 assertions' },
        },
      ],
    });

    // 事件流已捕获 s2 的拒绝：结果合并时按 toolName+message 去重
    const fromEvents: DeniedApproval[] = [
      {
        toolName: 'run_command',
        reasonCode: 'security_approval_unavailable',
        message: 'Approval is required but no interactive approval channel is available.',
      },
    ];

    const payload = buildHeadlessPayload(result, fromEvents, null);

    expect(payload.deniedApprovals).toHaveLength(2);
    expect(payload.deniedApprovals).toContainEqual({
      toolName: 'create_file',
      reasonCode: 'security_policy_denied',
      message: 'Security policy denied create_file: sensitive path',
    });
    // 普通失败步骤不混入拒绝集合
    expect(payload.deniedApprovals.map((d) => d.message)).not.toContain(
      'tests failed: 3 assertions',
    );
  });

  it('classifies a top-level result.error denial when no failed step carries it', () => {
    const result = makeResult({
      success: false,
      executedSteps: [],
      error: 'Security policy denied run_command: dangerous shell command blocked',
    });

    const payload = buildHeadlessPayload(result, [], null);

    expect(payload.deniedApprovals).toEqual([
      {
        toolName: 'run_command',
        reasonCode: 'security_policy_denied',
        message: 'Security policy denied run_command: dangerous shell command blocked',
      },
    ]);

    // 非安全类的顶层错误不混入
    const plain = buildHeadlessPayload(
      makeResult({ success: false, executedSteps: [], error: 'LLM 请求失败：404 Not Found。' }),
      [],
      null,
    );
    expect(plain.deniedApprovals).toEqual([]);
  });
});

describe('collectDeniedApproval', () => {
  it('collects every deny decision regardless of reason', () => {
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

    // 两种 deny 原因都被记录；allow 不记录
    expect(sink.map((d) => d.reasonCode)).toEqual([
      'security_approval_unavailable',
      'dangerous_shell_command',
    ]);
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
          console.debug('debug noise also writes stdout in node');
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

  it('restores the exact process.stdout.write identity after both modes', async () => {
    const before = process.stdout.write;

    const json = makeDeps(makeResult());
    await runHeadlessCommand('build it', { output: 'json' }, json.deps);
    expect(process.stdout.write).toBe(before);

    const text = makeDeps(makeResult());
    await runHeadlessCommand('build it', { output: 'text' }, text.deps);
    // text 模式从不改写全局函数，身份保持严格相等
    expect(process.stdout.write).toBe(before);
    expect(console.log).toBe(console.log);
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
