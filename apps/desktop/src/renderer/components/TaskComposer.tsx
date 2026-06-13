import { useState } from 'react';
import type { RunTaskRequest } from '../../ipc/contract.js';

export function TaskComposer({
  disabled,
  onRun,
}: {
  disabled: boolean;
  onRun: (req: RunTaskRequest) => void;
}) {
  const [task, setTask] = useState('为登录页添加深色模式切换');
  const [workspacePath, setWorkspacePath] = useState('~/projects/login-page');
  const [browserUrl, setBrowserUrl] = useState('http://localhost:5173');

  const submit = () => {
    if (disabled || task.trim().length === 0) return;
    onRun({ task: task.trim(), workspacePath, browserUrl: browserUrl || undefined });
  };

  return (
    <div className="composer">
      <textarea
        value={task}
        onChange={(e) => setTask(e.target.value)}
        placeholder="描述要让 FrontAgent 执行的前端任务…"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
        }}
      />
      <div className="composer-row">
        <div className="field">
          <label htmlFor="ws">工作区</label>
          <input id="ws" value={workspacePath} onChange={(e) => setWorkspacePath(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="url">URL</label>
          <input id="url" value={browserUrl} onChange={(e) => setBrowserUrl(e.target.value)} />
        </div>
        <button type="button" className="btn btn-primary" disabled={disabled} onClick={submit}>
          {disabled ? '执行中…' : '运行任务 ⌘↵'}
        </button>
      </div>
    </div>
  );
}
