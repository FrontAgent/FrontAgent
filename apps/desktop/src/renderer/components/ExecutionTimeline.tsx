import type { PhaseStatusView, PhaseView } from '../../state/executionReducer.js';

const PHASE_TAG: Record<PhaseStatusView, string> = {
  pending: '待执行',
  active: '进行中',
  completed: '已完成',
};

export function ExecutionTimeline({
  phases,
  activeStepId,
}: {
  phases: PhaseView[];
  activeStepId?: string;
}) {
  if (phases.length === 0) {
    return (
      <div className="lanes">
        <div className="lanes-empty">
          <span className="glyph">⌖</span>
          等待任务编排
          <br />
          运行一个任务以查看实时阶段与步骤遥测
        </div>
      </div>
    );
  }

  return (
    <div className="lanes">
      {phases.map((phase, index) => (
        <section className="lane" key={phase.name}>
          <header className="lane-head">
            <span className="lane-idx">{String(index + 1).padStart(2, '0')}</span>
            <span className="lane-name">{phase.name}</span>
            <span className="lane-tag" data-s={phase.status}>
              {PHASE_TAG[phase.status]}
            </span>
            <span className="lane-meta">
              {phase.steps.length}/{Math.max(phase.expectedSteps, phase.steps.length)} 步
            </span>
          </header>
          <div className="steps">
            {phase.steps.length === 0 ? (
              <div className="step" data-s="pending">
                <span className="step-icon" />
                <div className="step-body">
                  <div className="step-title" style={{ color: 'var(--ink-faint)' }}>
                    等待步骤…
                  </div>
                </div>
              </div>
            ) : (
              phase.steps.map((step) => (
                <div
                  className="step"
                  data-s={step.status}
                  key={step.id}
                  data-active={step.id === activeStepId}
                >
                  <span className="step-icon" />
                  <div className="step-body">
                    <div className="step-title">{step.title}</div>
                    <div className="step-sub">
                      <span>#{step.id}</span>
                      {step.tool ? <span className="step-tool">{step.tool}</span> : null}
                    </div>
                    {step.error ? <div className="step-err">⚠ {step.error}</div> : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
