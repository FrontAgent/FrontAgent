/**
 * In-browser mock of the {@link FrontAgentBridge}. Replays a scripted agent run
 * (planning -> two phases -> approval -> completion) so the renderer is fully
 * exercisable without the Electron main process or a real runtime. PR 3
 * replaces this with the preload bridge over IPC.
 */
import type {
  AgentEvent,
  AgentEventEnvelope,
  ApprovalDecisionInput,
  ApprovalRequest,
  ApprovalRequestEnvelope,
  DesktopSettings,
  FrontAgentBridge,
  RunTaskRequest,
  RunTaskResponse,
} from '../../ipc/contract.js';

type AgentListener = (envelope: AgentEventEnvelope) => void;
type ApprovalListener = (envelope: ApprovalRequestEnvelope) => void;

const STEP_DELAY_MS = 650;

function scriptedRun(runId: string): { event: AgentEvent; after: number }[] {
  const mk = (event: AgentEvent, after: number) => ({ event, after });
  let t = 0;
  const at = () => (t += STEP_DELAY_MS);
  void runId;
  return [
    mk(
      {
        type: 'task_started',
        task: { id: 't1', type: 'modify', description: '为登录页添加深色模式切换' },
      },
      (t = 200),
    ),
    mk({ type: 'planning_started' }, at()),
    mk(
      {
        type: 'planning_completed',
        plan: {
          taskId: 't1',
          summary: '两阶段：实现深色模式样式与切换，然后验证可访问性',
          steps: [],
          phases: [
            { phaseId: 'p1', name: '实现', description: '', stepIndices: [0, 1] },
            { phaseId: 'p2', name: '验证', description: '', stepIndices: [2] },
          ],
          rollbackStrategy: {
            enabled: true,
            snapshotBeforeExecution: true,
            rollbackOnFailure: true,
            maxRollbackSteps: 5,
          },
        },
      },
      at(),
    ),
    mk({ type: 'phase_started', phase: '实现', stepCount: 2 }, at()),
    mk(
      {
        type: 'step_started',
        step: stepFixture('s1', '新增 theme.dark.css 变量', '实现', 'write_file'),
      },
      at(),
    ),
    mk(
      { type: 'stream_token', token: ':root[data-theme="dark"] { --bg: #0b0e14; }', stepId: 's1' },
      at(),
    ),
    mk(
      {
        type: 'step_completed',
        step: stepFixture('s1', '新增 theme.dark.css 变量', '实现', 'write_file'),
        result: { success: true, duration: 420 },
      },
      at(),
    ),
    mk(
      {
        type: 'step_started',
        step: stepFixture('s2', '在 Header 接入主题切换按钮', '实现', 'apply_patch'),
      },
      at(),
    ),
    mk(
      {
        type: 'step_completed',
        step: stepFixture('s2', '在 Header 接入主题切换按钮', '实现', 'apply_patch'),
        result: { success: true, duration: 510 },
      },
      at(),
    ),
    mk({ type: 'phase_completed', phase: '实现', successCount: 2, failureCount: 0 }, at()),
    mk({ type: 'phase_started', phase: '验证', stepCount: 1 }, at()),
    mk(
      {
        type: 'step_started',
        step: stepFixture('s3', '运行 dev server 并截图校验对比度', '验证', 'run_command'),
      },
      at(),
    ),
  ];
}

// The ExecutionStep shape carried by step_* events.
type ScriptStep = Extract<AgentEvent, { type: 'step_started' }>['step'];

function stepFixture(stepId: string, description: string, phase: string, tool: string): ScriptStep {
  return {
    stepId,
    description,
    action: 'write_file',
    tool,
    params: {},
    dependencies: [],
    validation: [],
    status: 'running',
    phase,
  };
}

function approvalFixture(): ApprovalRequest {
  return {
    decision: 'ask',
    approvalId: 'apv-1',
    createdAt: new Date().toISOString(),
    riskLevel: 'high',
    reasonCode: 'shell_ask',
    message: '该步骤需要执行 `pnpm dev` 启动本地服务器以截图校验。',
    toolName: 'run_command',
    argsSummary: 'pnpm dev --port 5173',
    provenance: [],
  };
}

export function createMockBridge(): FrontAgentBridge {
  const agentListeners = new Set<AgentListener>();
  const approvalListeners = new Set<ApprovalListener>();
  let settings: DesktopSettings = {
    provider: 'anthropic',
    model: 'claude-opus-4-8',
    baseUrl: '',
    defaultWorkspacePath: '~/projects/login-page',
  };
  const timers: ReturnType<typeof setTimeout>[] = [];

  return {
    async runTask(_req: RunTaskRequest): Promise<RunTaskResponse> {
      const runId = `run-${Date.now()}`;
      const script = scriptedRun(runId);
      for (const { event, after } of script) {
        timers.push(
          setTimeout(() => {
            for (const listener of agentListeners) listener({ runId, event });
          }, after),
        );
      }
      // Pause for approval just after the verify step starts; resume on decision.
      const approvalAt = (script.at(-1)?.after ?? 0) + STEP_DELAY_MS;
      timers.push(
        setTimeout(() => {
          for (const listener of approvalListeners) listener({ runId, request: approvalFixture() });
        }, approvalAt),
      );
      return { runId };
    },
    async cancelTask(): Promise<void> {
      for (const timer of timers) clearTimeout(timer);
      timers.length = 0;
    },
    async respondApproval(input: ApprovalDecisionInput): Promise<void> {
      const runId = input.runId;
      const tail: AgentEvent[] = input.approved
        ? [
            {
              type: 'step_completed',
              step: stepFixture('s3', '运行 dev server 并截图校验对比度', '验证', 'run_command'),
              result: { success: true, duration: 880 },
            },
            { type: 'phase_completed', phase: '验证', successCount: 1, failureCount: 0 },
            {
              type: 'task_completed',
              result: {
                success: true,
                taskId: 't1',
                executedSteps: [],
                duration: 3120,
                validations: [],
              },
            },
          ]
        : [
            {
              type: 'step_failed',
              step: stepFixture('s3', '运行 dev server 并截图校验对比度', '验证', 'run_command'),
              error: '用户拒绝了 shell 审批',
            },
            { type: 'task_failed', error: '验证阶段被用户中断' },
          ];
      tail.forEach((event, index) => {
        timers.push(
          setTimeout(
            () => {
              for (const listener of agentListeners) listener({ runId, event });
            },
            (index + 1) * STEP_DELAY_MS,
          ),
        );
      });
    },
    async getSettings(): Promise<DesktopSettings> {
      return settings;
    },
    async saveSettings(next: DesktopSettings): Promise<void> {
      settings = next;
    },
    onAgentEvent(listener) {
      agentListeners.add(listener);
      return () => agentListeners.delete(listener);
    },
    onApprovalRequested(listener) {
      approvalListeners.add(listener);
      return () => approvalListeners.delete(listener);
    },
  };
}
