import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { Store, AgentUIState } from '../store.js';
import { isRunPossiblyStalled } from '../store.js';
import { useStoreSelector } from '../hooks.js';

interface HeaderProps {
  store: Store;
}

const statusLabel: Record<AgentUIState['status'], string> = {
  idle: '等待中',
  scanning: '扫描项目',
  planning: '规划中',
  executing: '执行中',
  done: '完成',
  error: '失败',
};

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}m${seconds}s`;
}

export function Header({ store }: HeaderProps) {
  const status = useStoreSelector(store, (s) => s.status);
  const task = useStoreSelector(store, (s) => s.taskDescription);
  const startTime = useStoreSelector(store, (s) => s.startTime);
  const lastActivityAt = useStoreSelector(store, (s) => s.lastActivityAt);
  const lastActivityLabel = useStoreSelector(store, (s) => s.lastActivityLabel);
  const currentOperation = useStoreSelector(store, (s) => s.currentOperation);
  const runLogPath = useStoreSelector(store, (s) => s.runLogPath);
  const snapshot = useStoreSelector(store, (s) => s);
  const [now, setNow] = useState(Date.now());

  const isActive = status !== 'idle' && status !== 'done' && status !== 'error';
  const stalled = isRunPossiblyStalled(snapshot, now);

  useEffect(() => {
    if (!isActive) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isActive]);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color="cyan">状态摘要</Text>
      </Box>
      <Box paddingLeft={2}>
        {isActive ? (
          <Text color="yellow">
            <Spinner type="dots" /> {statusLabel[status]} · 已运行 {formatElapsed(now - startTime)} · 最后活动 {formatElapsed(now - lastActivityAt)} 前
          </Text>
        ) : (
          <Text color={status === 'error' ? 'red' : 'green'}>
            {statusLabel[status]}
          </Text>
        )}
      </Box>
      {isActive && currentOperation ? (
        <Box paddingLeft={2}>
          <Text dimColor wrap="truncate-end">
            当前: {currentOperation}
          </Text>
        </Box>
      ) : null}
      {task ? (
        <Box paddingLeft={2}>
          <Text dimColor wrap="truncate-end">
            任务: {task}
          </Text>
        </Box>
      ) : null}
      {runLogPath ? (
        <Box paddingLeft={2}>
          <Text dimColor wrap="truncate-end">
            日志: {runLogPath}
          </Text>
        </Box>
      ) : null}
      {stalled ? (
        <Box paddingLeft={2}>
          <Text color="yellow" wrap="truncate-end">
            仍在等待，最后活动：{lastActivityLabel}，详见日志 {runLogPath ?? '未启用'}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}
