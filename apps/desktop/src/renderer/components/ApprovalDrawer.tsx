import type { ApprovalRequest } from '../../ipc/contract.js';

export function ApprovalDrawer({
  request,
  onDecide,
}: {
  request: ApprovalRequest;
  onDecide: (approvalId: string, approved: boolean) => void;
}) {
  return (
    <section className="approval" aria-label={`需要审批：${request.toolName}`}>
      <div className="approval-head">
        ⚠ 需要审批 · {request.toolName}
        <span className="risk">{request.riskLevel}</span>
      </div>
      <div className="approval-msg">{request.message}</div>
      <div className="approval-cmd">$ {request.argsSummary}</div>
      <div className="approval-actions">
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => onDecide(request.approvalId, false)}
        >
          拒绝
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onDecide(request.approvalId, true)}
        >
          批准
        </button>
      </div>
    </section>
  );
}
