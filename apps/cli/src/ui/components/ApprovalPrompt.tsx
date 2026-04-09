import { Box, Text, useInput } from 'ink';
import type { Store } from '../store.js';
import { useStoreSelector } from '../hooks.js';

interface ApprovalPromptProps {
  store: Store;
}

export function ApprovalPrompt({ store }: ApprovalPromptProps) {
  const approval = useStoreSelector(store, (s) => s.approval);

  useInput(
    (input) => {
      if (!approval) return;
      const lower = input.toLowerCase();
      if (lower === 'y') {
        const { resolve } = approval;
        store.setState({ approval: null });
        resolve(true);
      } else if (lower === 'n' || input === '\r' || input === '\n') {
        const { resolve } = approval;
        store.setState({ approval: null });
        resolve(false);
      }
    },
    { isActive: approval !== null },
  );

  if (!approval) return null;

  return (
    <Box
      flexDirection="column"
      marginY={1}
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
    >
      <Text color="yellow" bold>
        ⚠ Shell 命令请求
      </Text>
      <Box marginTop={1}>
        <Text color="cyan">{`  $ ${approval.command}`}</Text>
      </Box>
      <Box marginTop={1}>
        <Text>
          允许执行? <Text bold color="green">y</Text>
          <Text dimColor>/</Text>
          <Text bold color="red">N</Text>
        </Text>
      </Box>
    </Box>
  );
}
