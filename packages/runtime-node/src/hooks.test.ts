import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAgentLifecycleHooks,
  type HookExecution,
  loadHooksSettings,
  runHookCommand,
  runTaskCompleteHooks,
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

  it('kills the command on timeout', async () => {
    const result = await runHookCommand('sleep 5', {}, 200, process.cwd());
    expect(result.timedOut).toBe(true);
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
