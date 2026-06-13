import type { RunStatus } from '../../state/executionReducer.js';

const LABELS: Record<RunStatus, string> = {
  idle: '待命',
  planning: '规划中',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
};

export function StatusPill({ status }: { status: RunStatus }) {
  return (
    <span className="status-pill" data-status={status}>
      <span className="beacon" />
      {LABELS[status]}
    </span>
  );
}
