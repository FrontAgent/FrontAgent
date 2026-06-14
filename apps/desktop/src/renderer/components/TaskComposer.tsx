import { useEffect, useRef, useState } from 'react';
import type { RunTaskRequest } from '../../ipc/contract.js';

export function TaskComposer({
  disabled,
  onRun,
  defaultWorkspacePath,
}: {
  disabled: boolean;
  onRun: (req: RunTaskRequest) => void;
  defaultWorkspacePath?: string;
}) {
  const [task, setTask] = useState('');
  const [workspacePath, setWorkspacePath] = useState('');
  const [browserUrl, setBrowserUrl] = useState('');
  const workspaceEdited = useRef(false);

  useEffect(() => {
    if (!workspaceEdited.current) {
      setWorkspacePath(defaultWorkspacePath ?? '');
    }
  }, [defaultWorkspacePath]);

  const canRun = task.trim().length > 0 && workspacePath.trim().length > 0;

  const submit = () => {
    if (disabled || !canRun) return;
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
          <input
            id="ws"
            value={workspacePath}
            onChange={(e) => {
              workspaceEdited.current = true;
              setWorkspacePath(e.target.value);
            }}
            placeholder="~/projects/your-app"
          />
        </div>
        <div className="field">
          <label htmlFor="url">URL</label>
          <input
            id="url"
            value={browserUrl}
            onChange={(e) => setBrowserUrl(e.target.value)}
            placeholder="http://localhost:5173（可选）"
          />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={disabled || !canRun}
          onClick={submit}
        >
          {disabled ? '执行中…' : '运行任务 ⌘↵'}
        </button>
      </div>
    </div>
  );
}
