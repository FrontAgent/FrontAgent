import { Box, Text, useInput } from 'ink';
import { useStoreSelector } from '../hooks.js';
import type { Store } from '../store.js';

interface ApprovalPromptProps {
  store: Store;
}

export function ApprovalPrompt({ store }: ApprovalPromptProps) {
  const approval = useStoreSelector(store, (s) => s.approval);
  const canReadInput = process.stdin.isTTY !== false;

  useInput(
    (input) => {
      if (!approval) return;
      const lower = input.toLowerCase();
      if (lower === 'y') {
        store.resolveApproval(approval.approvalId, true);
      } else if (lower === 'n' || input === '\r' || input === '\n') {
        store.resolveApproval(approval.approvalId, false);
      }
    },
    { isActive: approval !== null && canReadInput },
  );

  if (!approval) return null;

  return (
    <Box flexDirection="column" marginY={1} borderStyle="round" borderColor="yellow" paddingX={1}>
      <Text color="yellow" bold>
        ⚠ 工具执行审批
      </Text>
      <Box marginTop={1}>
        <Text color="cyan">{`  ${approval.argsSummary}`}</Text>
      </Box>
      <Box marginTop={1}>
        <Text color="yellow">{`  ${approval.riskLevel.toUpperCase()} · ${approval.reasonCode}`}</Text>
      </Box>
      <Box marginTop={1}>
        <Text>{`  ${approval.message}`}</Text>
      </Box>
      <Box marginTop={1}>
        {canReadInput ? (
          <Text>
            允许执行?{' '}
            <Text bold color="green">
              y
            </Text>
            <Text dimColor>/</Text>
            <Text bold color="red">
              N
            </Text>
          </Text>
        ) : (
          <Text dimColor>当前终端不可交互，审批请求将被自动拒绝。</Text>
        )}
      </Box>
    </Box>
  );
}
