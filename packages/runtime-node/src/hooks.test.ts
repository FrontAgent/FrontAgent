import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAgentLifecycleHooks,
  DEFAULT_HOOK_TIMEOUT_MS,
  type HookExecution,
  loadHooksSettings,
  MAX_HOOK_TIMEOUT_MS,
  MIN_HOOK_TIMEOUT_MS,
  normalizeHookTimeout,
  runHookCommand,
  runTaskCompleteHooks,
  shouldEnableProjectHooks,
} from './hooks.js';

describe('loadHooksSettings', () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'fa-hooks-'));
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('returns undefined when settings or hooks section is missing', () => {
    expect(loadHooksSettings(projectRoot)).toBeUndefined();
    mkdirSync(join(projectRoot, '.frontagent'), { recursive: true });
    writeFileSync(join(projectRoot, '.frontagent', 'settings.json'), '{}');
    expect(loadHooksSettings(projectRoot)).toBeUndefined();
  });

  it('loads the hooks section from settings.json', () => {
    mkdirSync(join(projectRoot, '.frontagent'), { recursive: true });
    writeFileSync(
      join(projectRoot, '.frontagent', 'settings.json'),
      JSON.stringify({ hooks: { preToolUse: 'exit 0', timeoutMs: 500 } }),
    );
    expect(loadHooksSettings(projectRoot)).toEqual({ preToolUse: 'exit 0', timeoutMs: 500 });
  });
});

describe('normalizeHookTimeout', () => {
  it('falls back to the default for invalid values and clamps the range', () => {
    for (const invalid of ['500', 0, -1, Number.NaN, Number.POSITIVE_INFINITY, null, {}]) {
      expect(normalizeHookTimeout(invalid)).toBe(DEFAULT_HOOK_TIMEOUT_MS);
    }
    expect(normalizeHookTimeout(1)).toBe(MIN_HOOK_TIMEOUT_MS);
    expect(normalizeHookTimeout(10_000_000)).toBe(MAX_HOOK_TIMEOUT_MS);
    expect(normalizeHookTimeout(5000)).toBe(5000);
  });
});

describe('shouldEnableProjectHooks', () => {
  it('requires explicit opt-in via option or environment', () => {
    expect(shouldEnableProjectHooks(undefined, {})).toBe(false);
    expect(shouldEnableProjectHooks(false, {})).toBe(false);
    expect(shouldEnableProjectHooks(true, {})).toBe(true);
    expect(shouldEnableProjectHooks(undefined, { FRONTAGENT_ENABLE_PROJECT_HOOKS: '1' })).toBe(
      true,
    );
    expect(shouldEnableProjectHooks(undefined, { FRONTAGENT_ENABLE_PROJECT_HOOKS: 'true' })).toBe(
      true,
    );
    expect(shouldEnableProjectHooks(undefined, { FRONTAGENT_ENABLE_PROJECT_HOOKS: '0' })).toBe(
      false,
    );
  });
});

describe('runHookCommand', () => {
  it('captures exit code and stderr', async () => {
    const ok = await runHookCommand('exit 0', { event: 'preToolUse' }, 5000, process.cwd());
    expect(ok.exitCode).toBe(0);
    expect(ok.timedOut).toBe(false);

    const fail = await runHookCommand(
      'echo "blocked by policy" >&2; exit 3',
      { event: 'preToolUse' },
      5000,
      process.cwd(),
    );
    expect(fail.exitCode).toBe(3);
    expect(fail.stderr).toContain('blocked by policy');
  });

  it('feeds the JSON payload on stdin', async () => {
    const result = await runHookCommand(
      'grep -q "\\"toolName\\":\\"run_command\\"" && exit 0 || exit 9',
      { event: 'preToolUse', toolName: 'run_command', args: {} },
      5000,
      process.cwd(),
    );
    expect(result.exitCode).toBe(0);
  });

  it('caps stderr accumulation while the command is still running', async () => {
    // 持续产出 ~2MB stderr 的命令：采集必须在 data handler 内有界
    const result = await runHookCommand(
      'i=0; while [ $i -lt 2000 ]; do printf "%01000d" 0 >&2; i=$((i+1)); done; exit 3',
      {},
      10_000,
      process.cwd(),
    );

    expect(result.exitCode).toBe(3);
    expect(result.stderr.length).toBeLessThanOrEqual(4000);
  });

  it('kills the command on timeout', async () => {
    const result = await runHookCommand('sleep 5', {}, 200, process.cwd());
    expect(result.timedOut).toBe(true);
  });

  it('kills the whole process group on timeout so descendants stop too', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fa-hook-kill-'));
    const marker = join(dir, 'survivor.txt');
    try {
      const result = await runHookCommand(
        `(sleep 1; echo survived > "${marker}") & sleep 5`,
        {},
        200,
        dir,
      );
      expect(result.timedOut).toBe(true);

      // 后代若未被随进程组终止，会在 ~1s 后写出 marker 文件
      await new Promise((resolveSleep) => setTimeout(resolveSleep, 1500));
      expect(existsSync(marker)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('createAgentLifecycleHooks', () => {
  it('returns undefined without pre/post commands', () => {
    expect(createAgentLifecycleHooks({ projectRoot: '/tmp' })).toBeUndefined();
    expect(
      createAgentLifecycleHooks({ projectRoot: '/tmp', settings: { taskComplete: 'exit 0' } }),
    ).toBeUndefined();
  });

  it('blocks on non-zero preToolUse exit with stderr as the reason', async () => {
    const executions: Array<{ event: string; execution: HookExecution }> = [];
    const hooks = createAgentLifecycleHooks({
      projectRoot: process.cwd(),
      settings: { preToolUse: 'echo "forbidden tool" >&2; exit 1' },
      onHookExecuted: (event, execution) => executions.push({ event, execution }),
    });

    const decision = await hooks?.preToolUse?.({
      event: 'preToolUse',
      toolName: 'run_command',
      args: { command: 'ls' },
    });

    expect(decision?.block).toBe(true);
    expect(decision?.reason).toContain('forbidden tool');
    expect(executions).toHaveLength(1);
    expect(executions[0].event).toBe('preToolUse');
  });

  it('allows when all preToolUse commands exit zero', async () => {
    const hooks = createAgentLifecycleHooks({
      projectRoot: process.cwd(),
      settings: { preToolUse: ['exit 0', 'exit 0'] },
    });

    const decision = await hooks?.preToolUse?.({
      event: 'preToolUse',
      toolName: 'read_file',
      args: { path: 'a.ts' },
    });

    expect(decision).toEqual({ block: false });
  });

  it('fails open when the hook command cannot start (infra failure)', async () => {
    const onHookExecuted = vi.fn();
    const hooks = createAgentLifecycleHooks({
      projectRoot: process.cwd(),
      settings: { preToolUse: 'whatever' },
      onHookExecuted,
      // 模拟 spawn 失败：exitCode null 且非超时
      runCommand: async (command) => ({
        command,
        exitCode: null,
        stderr: 'spawn ENOENT',
        timedOut: false,
        durationMs: 1,
      }),
    });

    const decision = await hooks?.preToolUse?.({
      event: 'preToolUse',
      toolName: 'run_command',
      args: {},
    });

    // 基础设施故障不是策略拒绝：fail-open 且已记录
    expect(decision).toEqual({ block: false });
    expect(onHookExecuted).toHaveBeenCalledOnce();
  });

  it('blocks when a preToolUse command times out', async () => {
    const hooks = createAgentLifecycleHooks({
      projectRoot: process.cwd(),
      settings: { preToolUse: 'sleep 5', timeoutMs: 200 },
    });

    const decision = await hooks?.preToolUse?.({
      event: 'preToolUse',
      toolName: 'run_command',
      args: {},
    });

    expect(decision?.block).toBe(true);
    expect(decision?.reason).toContain('超时');
  });

  it('still blocks on non-zero exit when the log callback throws', async () => {
    const hooks = createAgentLifecycleHooks({
      projectRoot: process.cwd(),
      settings: { preToolUse: 'echo "forbidden" >&2; exit 1' },
      onHookExecuted: () => {
        throw new Error('run log write failed');
      },
    });

    const decision = await hooks?.preToolUse?.({
      event: 'preToolUse',
      toolName: 'run_command',
      args: {},
    });

    // 记录回调抛错不能把策略阻断变成 fail-open
    expect(decision?.block).toBe(true);
    expect(decision?.reason).toContain('forbidden');
  });

  it('still blocks on timeout when the log callback throws', async () => {
    const hooks = createAgentLifecycleHooks({
      projectRoot: process.cwd(),
      settings: { preToolUse: 'sleep 5', timeoutMs: 200 },
      onHookExecuted: () => {
        throw new Error('run log write failed');
      },
    });

    const decision = await hooks?.preToolUse?.({
      event: 'preToolUse',
      toolName: 'run_command',
      args: {},
    });

    expect(decision?.block).toBe(true);
    expect(decision?.reason).toContain('超时');
  });

  it('runs postToolUse commands without blocking semantics', async () => {
    const onHookExecuted = vi.fn();
    const hooks = createAgentLifecycleHooks({
      projectRoot: process.cwd(),
      settings: { postToolUse: 'exit 1' },
      onHookExecuted,
    });

    await expect(
      hooks?.postToolUse?.({
        event: 'postToolUse',
        toolName: 'run_command',
        args: {},
        success: true,
      }),
    ).resolves.toBeUndefined();
    expect(onHookExecuted).toHaveBeenCalledOnce();
  });
});

describe('runTaskCompleteHooks', () => {
  it('runs taskComplete commands and records executions', async () => {
    const onHookExecuted = vi.fn();
    await runTaskCompleteHooks(
      {
        projectRoot: process.cwd(),
        settings: { taskComplete: ['exit 0', 'exit 1'] },
        onHookExecuted,
      },
      { event: 'taskComplete', taskId: 't1', success: true },
    );

    expect(onHookExecuted).toHaveBeenCalledTimes(2);
    expect(onHookExecuted.mock.calls[0][0]).toBe('taskComplete');
  });
});
