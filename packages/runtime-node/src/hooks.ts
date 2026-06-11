import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AgentLifecycleHooks } from '@frontagent/core';

/**
 * 生命周期 hooks（.frontagent/settings.json 的 hooks 段）
 *
 * 每个事件配置一条或多条 shell 命令；事件载荷以 JSON 写入 stdin。
 * preToolUse 命令非零退出或超时会拦截该工具调用，并把 stderr 作为原因
 * 反馈给 agent；postToolUse / taskComplete 失败仅记录，不中断任务。
 */

export interface HooksSettings {
  preToolUse?: string | string[];
  postToolUse?: string | string[];
  taskComplete?: string | string[];
  /** 单条 hook 命令的超时毫秒（默认 10000） */
  timeoutMs?: number;
}

export const DEFAULT_HOOK_TIMEOUT_MS = 10_000;
export const MIN_HOOK_TIMEOUT_MS = 100;
export const MAX_HOOK_TIMEOUT_MS = 600_000;

/**
 * 校验 settings 中的 timeoutMs：必须是有限正数，并 clamp 到合理区间；
 * 非法值回退默认，避免 0/负数/NaN 让 preToolUse 立即超时拦截所有调用。
 */
export function normalizeHookTimeout(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_HOOK_TIMEOUT_MS;
  }
  return Math.min(Math.max(Math.floor(value), MIN_HOOK_TIMEOUT_MS), MAX_HOOK_TIMEOUT_MS);
}

/**
 * 项目内 hooks 是仓库提交的可执行配置，默认不自动执行：
 * 需要宿主显式 opt-in（CLI --enable-hooks / runtime 选项），
 * 或设置 FRONTAGENT_ENABLE_PROJECT_HOOKS=1|true。
 */
export function shouldEnableProjectHooks(
  optionValue: boolean | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (optionValue === true) return true;
  const envValue = env.FRONTAGENT_ENABLE_PROJECT_HOOKS;
  return envValue === '1' || envValue === 'true';
}

export interface HookExecution {
  command: string;
  exitCode: number | null;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
}

/** 从 .frontagent/settings.json 读取 hooks 段；缺失或损坏时返回 undefined */
export function loadHooksSettings(projectRoot: string): HooksSettings | undefined {
  const settingsPath = join(projectRoot, '.frontagent', 'settings.json');
  try {
    if (!existsSync(settingsPath)) return undefined;
    const parsed = JSON.parse(readFileSync(settingsPath, 'utf-8')) as { hooks?: unknown };
    const hooks = parsed?.hooks;
    if (typeof hooks !== 'object' || hooks === null || Array.isArray(hooks)) return undefined;
    return hooks as HooksSettings;
  } catch {
    return undefined;
  }
}

function normalizeCommands(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const commands = Array.isArray(value) ? value : [value];
  return commands.filter((command) => typeof command === 'string' && command.trim() !== '');
}

/** 超时后等待 close 确认清理的兜底毫秒数 */
const KILL_GRACE_MS = 1_000;

function killHookProcessTree(child: ReturnType<typeof spawn>): void {
  // detached 模式下 shell 是进程组组长，杀整个进程组以终止其后代
  if (process.platform !== 'win32' && child.pid) {
    try {
      process.kill(-child.pid, 'SIGKILL');
      return;
    } catch {
      // 进程组可能已退出，回退到直接 kill
    }
  }
  child.kill('SIGKILL');
}

export function runHookCommand(
  command: string,
  payload: unknown,
  timeoutMs: number,
  cwd: string,
): Promise<HookExecution> {
  return new Promise((resolvePromise) => {
    const startedAt = Date.now();
    const child = spawn(command, {
      shell: true,
      cwd,
      stdio: ['pipe', 'ignore', 'pipe'],
      detached: process.platform !== 'win32',
    });

    let stderr = '';
    let timedOut = false;
    let settled = false;
    let graceTimer: NodeJS.Timeout | undefined;

    const settle = (exitCode: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (graceTimer) clearTimeout(graceTimer);
      resolvePromise({
        command,
        exitCode,
        stderr: stderr.slice(0, 4000),
        timedOut,
        durationMs: Date.now() - startedAt,
      });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killHookProcessTree(child);
      // 等 close 事件确认清理完成；若进程组迟迟不退出则兜底 settle
      graceTimer = setTimeout(() => settle(null), KILL_GRACE_MS);
    }, timeoutMs);

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf-8');
    });
    child.on('error', (error) => {
      stderr += String(error);
      settle(null);
    });
    child.on('close', (code) => settle(timedOut ? null : code));

    child.stdin?.on('error', () => {});
    child.stdin?.end(JSON.stringify(payload));
  });
}

export interface CreateLifecycleHooksInput {
  projectRoot: string;
  settings?: HooksSettings;
  /** 每次 hook 执行后的记录回调（写入运行日志） */
  onHookExecuted?: (event: string, execution: HookExecution) => void;
}

/**
 * 把 hooks 配置编译为 core 的 AgentLifecycleHooks 回调；没有配置时返回 undefined
 */
export function createAgentLifecycleHooks(
  input: CreateLifecycleHooksInput,
): AgentLifecycleHooks | undefined {
  const settings = input.settings;
  if (!settings) return undefined;

  const timeoutMs = normalizeHookTimeout(settings.timeoutMs);
  const preCommands = normalizeCommands(settings.preToolUse);
  const postCommands = normalizeCommands(settings.postToolUse);
  if (preCommands.length === 0 && postCommands.length === 0) return undefined;

  const hooks: AgentLifecycleHooks = {};

  if (preCommands.length > 0) {
    hooks.preToolUse = async (payload) => {
      for (const command of preCommands) {
        const execution = await runHookCommand(command, payload, timeoutMs, input.projectRoot);
        input.onHookExecuted?.('preToolUse', execution);
        if (execution.timedOut) {
          return { block: true, reason: `hook 超时（${timeoutMs}ms）：${command}` };
        }
        if (execution.exitCode !== 0) {
          return {
            block: true,
            reason: execution.stderr.trim() || `hook 退出码 ${execution.exitCode}`,
          };
        }
      }
      return { block: false };
    };
  }

  if (postCommands.length > 0) {
    hooks.postToolUse = async (payload) => {
      for (const command of postCommands) {
        const execution = await runHookCommand(command, payload, timeoutMs, input.projectRoot);
        input.onHookExecuted?.('postToolUse', execution);
      }
    };
  }

  return hooks;
}

/** 任务结束时运行 taskComplete hooks；失败仅记录，不影响结果 */
export async function runTaskCompleteHooks(
  input: CreateLifecycleHooksInput,
  payload: { event: 'taskComplete'; taskId: string; success: boolean; error?: string },
): Promise<void> {
  const commands = normalizeCommands(input.settings?.taskComplete);
  const timeoutMs = normalizeHookTimeout(input.settings?.timeoutMs);

  for (const command of commands) {
    const execution = await runHookCommand(command, payload, timeoutMs, input.projectRoot);
    input.onHookExecuted?.('taskComplete', execution);
  }
}
