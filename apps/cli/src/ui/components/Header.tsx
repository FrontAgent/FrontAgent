import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { Store, AgentUIState } from '../store.js';
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

export function Header({ store }: HeaderProps) {
  const status = useStoreSelector(store, (s) => s.status);
  const task = useStoreSelector(store, (s) => s.taskDescription);

  const isActive = status !== 'idle' && status !== 'done' && status !== 'error';

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color="cyan">
          FrontAgent
        </Text>
        <Text> </Text>
        {isActive ? (
          <Text color="yellow">
            <Spinner type="dots" /> {statusLabel[status]}
          </Text>
        ) : (
          <Text color={status === 'error' ? 'red' : 'green'}>
            {statusLabel[status]}
          </Text>
        )}
      </Box>
      {task ? (
        <Text dimColor wrap="truncate-end">
          {task}
        </Text>
      ) : null}
    </Box>
  );
}
