/**
 * `fa run --non-interactive` — 无头执行路径（CI 友好）。
 *
 * 不渲染 TUI、不弹审批：敏感工具调用在没有审批通道时由安全管线
 * fail-closed 拒绝并记录。`--output json` 时 stdout 只输出一份
 * 机器可解析的结果文档，运行期日志全部走 stderr；退出码 0 表示成功。
 */

import type { AgentEvent, AgentExecutionResult } from '@frontagent/runtime-node';
import { runFrontAgentTask } from '@frontagent/runtime-node';

export interface DeniedApproval {
  toolName: string;
  reasonCode: string;
  message: string;
}

export interface HeadlessResultPayload {
  success: boolean;
  taskId: string;
  output?: string;
  error?: string;
  durationMs: number;
  steps: Array<{
    stepId: string;
    description: string;
    action: string;
    tool: string;
    status: string;
    error?: string;
  }>;
  deniedApprovals: DeniedApproval[];
  runLogPath: string | null;
}

export function buildHeadlessPayload(
  result: AgentExecutionResult,
  deniedApprovals: DeniedApproval[],
  runLogPath: string | null,
): HeadlessResultPayload {
  return {
    success: result.success,
    taskId: result.taskId,
    output: result.output,
    error: result.error,
    durationMs: result.duration,
    steps: (result.executedSteps ?? []).map((step) => ({
      stepId: step.stepId,
      description: step.description,
      action: step.action,
      tool: step.tool,
      status: step.status,
      error: step.result?.error,
    })),
    deniedApprovals,
    runLogPath,
  };
}

export function collectDeniedApproval(event: AgentEvent, sink: DeniedApproval[]): void {
  if (event.type !== 'security_decision') return;
  const decision = event.decision;
  if (decision.decision !== 'deny') return;
  if (decision.reasonCode !== 'security_approval_unavailable') return;
  sink.push({
    toolName: decision.toolName,
    reasonCode: decision.reasonCode,
    message: decision.message,
  });
}

export interface HeadlessRunDeps {
  runTask: typeof runFrontAgentTask;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}

const defaultDeps: HeadlessRunDeps = {
  runTask: runFrontAgentTask,
  stdout: (line) => process.stdout.write(`${line}\n`),
  stderr: (line) => process.stderr.write(`${line}\n`),
};

const OUTPUT_FORMATS = new Set(['text', 'json']);

/** CLI-only 选项不进入 runtime 调用边界，避免跨层契约漂移 */
const CLI_ONLY_OPTION_KEYS = new Set(['nonInteractive', 'output', 'sdd']);

function stripCliOnlyOptions(options: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(options).filter(([key]) => !CLI_ONLY_OPTION_KEYS.has(key)),
  );
}

/** 返回进程退出码（0 成功，1 失败/被拒中止/参数非法） */
export async function runHeadlessCommand(
  task: string,
  options: Record<string, unknown>,
  deps: HeadlessRunDeps = defaultDeps,
): Promise<number> {
  const projectRoot = process.cwd();
  const outputFormat = (options.output as string | undefined) ?? 'text';
  if (!OUTPUT_FORMATS.has(outputFormat)) {
    // 拼写错误不静默退回 text：CI 的 JSON 消费者需要明确失败
    deps.stderr(`无效的 --output 取值：${outputFormat}（支持 text/json）`);
    return 1;
  }
  const outputJson = outputFormat === 'json';
  const deniedApprovals: DeniedApproval[] = [];
  let runLogPath: string | null = null;

  // JSON 模式下 stdout 只承载最终结果文档：运行期不仅重定向 console，
  // 还拦截 process.stdout.write 本身——runtime/工具/第三方库的直接
  // stdout 写入全部转到 stderr。任务结束、流恢复之后才输出最终文档。
  const originalConsole = { log: console.log, info: console.info, warn: console.warn };
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  if (outputJson) {
    console.log = (...args: unknown[]) => console.error(...args);
    console.info = (...args: unknown[]) => console.error(...args);
    console.warn = (...args: unknown[]) => console.error(...args);
    process.stdout.write = ((...args: Parameters<typeof process.stdout.write>) =>
      process.stderr.write(...args)) as typeof process.stdout.write;
  }

  let result: AgentExecutionResult;
  try {
    result = await deps.runTask({
      ...stripCliOnlyOptions(options),
      projectRoot,
      task,
      sddPath: options.sdd as string | undefined,
      type: options.type as string | undefined,
      files: options.files as string[] | undefined,
      url: options.url as string | undefined,
      runLog: options.runLog as boolean | undefined,
      filterConsole: false,
      debug: isDebugEnabled(options.debug),
      onRunLogPath: (path) => {
        runLogPath = path;
      },
      onEvent: (event) => collectDeniedApproval(event, deniedApprovals),
      // 不提供 onApprovalRequest：未被规则放行的敏感调用 fail-closed 拒绝
    });
  } catch (error) {
    result = {
      success: false,
      taskId: '',
      executedSteps: [],
      error: error instanceof Error ? error.message : String(error),
      duration: 0,
      validations: [],
    };
  } finally {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    process.stdout.write = originalStdoutWrite;
  }

  const payload = buildHeadlessPayload(result, deniedApprovals, runLogPath);
  if (outputJson) {
    deps.stdout(JSON.stringify(payload));
  } else {
    deps.stdout(
      payload.success ? '✅ 任务执行成功' : `❌ 任务失败：${payload.error ?? '未知错误'}`,
    );
    if (payload.output) deps.stdout(payload.output);
    if (deniedApprovals.length > 0) {
      deps.stderr(`被拒绝的敏感调用：${deniedApprovals.map((d) => d.toolName).join(', ')}`);
    }
  }
  return payload.success ? 0 : 1;
}

function isDebugEnabled(value: unknown): boolean {
  return value === true || value === 'true' || value === '1';
}
