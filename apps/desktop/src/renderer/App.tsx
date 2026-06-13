import { useState } from 'react';
import type { FrontAgentBridge } from '../ipc/contract.js';
import { EventStream } from './components/EventStream.js';
import { ExecutionTimeline } from './components/ExecutionTimeline.js';
import { SettingsPanel } from './components/SettingsPanel.js';
import { StatusPill } from './components/StatusPill.js';
import { TaskComposer } from './components/TaskComposer.js';
import { useConsoleState } from './store/useConsoleState.js';

type View = 'console' | 'settings';

export function App({ bridge }: { bridge: FrontAgentBridge }) {
  const [view, setView] = useState<View>('console');
  const { state, launching, runTask, respondApproval } = useConsoleState(bridge);
  const running = launching || state.status === 'running' || state.status === 'planning';

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          <div className="brand-mark" />
          <div className="brand-name">
            FrontAgent
            <small>Console</small>
          </div>
        </div>
        <nav className="nav">
          <button
            type="button"
            className="nav-item"
            data-active={view === 'console'}
            onClick={() => setView('console')}
          >
            <span className="nav-dot" /> 任务控制台
          </button>
          <button
            type="button"
            className="nav-item"
            data-active={view === 'settings'}
            onClick={() => setView('settings')}
          >
            <span className="nav-dot" /> 设置
          </button>
        </nav>
        <div className="rail-foot">
          v2.1.1 · electron
          <br />
          spine · runtime-node
          <br />
          mock bridge · PR2
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <h1>{view === 'console' ? '任务控制台' : '设置'}</h1>
          <span className="spacer" />
          <StatusPill status={state.status} />
        </header>

        {view === 'console' ? (
          <div className="console">
            <section className="timeline-col">
              <TaskComposer disabled={running} onRun={runTask} />
              <ExecutionTimeline phases={state.phases} activeStepId={state.activeStepId} />
            </section>
            <EventStream state={state} onApproval={respondApproval} />
          </div>
        ) : (
          <SettingsPanel bridge={bridge} />
        )}
      </main>
    </div>
  );
}
