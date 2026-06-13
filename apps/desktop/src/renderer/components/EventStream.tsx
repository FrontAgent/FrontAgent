import { useEffect, useRef } from 'react';
import type { ConsoleState } from '../../state/executionReducer.js';
import { ApprovalDrawer } from './ApprovalDrawer.js';

export function EventStream({
  state,
  onApproval,
}: {
  state: ConsoleState;
  onApproval: (approvalId: string, approved: boolean) => void;
}) {
  const logRef = useRef<HTMLDivElement>(null);
  const activeTokens = state.activeStepId ? state.tokensByStep[state.activeStepId] : undefined;

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-scroll on every appended log line
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [state.log.length, activeTokens]);

  return (
    <aside className="stream">
      <div className="stream-head">⚡ 遥测流 · TELEMETRY</div>

      {state.pendingApprovals.map((request) => (
        <ApprovalDrawer key={request.approvalId} request={request} onDecide={onApproval} />
      ))}

      {activeTokens ? (
        <div className="tokens">
          <div className="tokens-head">流式输出 · {state.activeStepId}</div>
          <div className="tokens-body">{activeTokens}</div>
        </div>
      ) : null}

      <div className="stream-log" ref={logRef}>
        {state.log.length === 0 ? (
          <div className="log-line" data-l="info">
            <span className="log-text" style={{ color: 'var(--ink-faint)' }}>
              空 · 暂无事件
            </span>
          </div>
        ) : (
          state.log.map((line) => (
            <div className="log-line" data-l={line.level} key={line.seq}>
              <span className="log-seq">{String(line.seq).padStart(3, '0')}</span>
              <span className="log-text">{line.text}</span>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
