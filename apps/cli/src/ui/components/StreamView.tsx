import { useRef, useState, useEffect } from 'react';
import { Box, Text } from 'ink';

interface StreamViewProps {
  /** Subscribe to streaming tokens; returns unsubscribe. */
  subscribe: (cb: (token: string) => void) => () => void;
  /** True while a step with code-gen streaming is active. */
  active: boolean;
}

const FLUSH_INTERVAL_MS = 80;
const MAX_DISPLAY_LINES = 12;

/**
 * Tier 2 component: tokens are accumulated in a ref and flushed
 * to React state on a timer to avoid per-token re-renders.
 */
export function StreamView({ subscribe, active }: StreamViewProps) {
  const bufferRef = useRef('');
  const [displayText, setDisplayText] = useState('');

  useEffect(() => {
    if (!active) {
      bufferRef.current = '';
      setDisplayText('');
      return;
    }

    const unsub = subscribe((token: string) => {
      bufferRef.current += token;
    });

    const timer = setInterval(() => {
      if (bufferRef.current) {
        setDisplayText(bufferRef.current);
      }
    }, FLUSH_INTERVAL_MS);

    return () => {
      unsub();
      clearInterval(timer);
    };
  }, [active, subscribe]);

  if (!active || !displayText) return null;

  const lines = displayText.split('\n');
  const visible = lines.length > MAX_DISPLAY_LINES
    ? lines.slice(-MAX_DISPLAY_LINES)
    : lines;

  return (
    <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
      <Text dimColor bold>{'</>'} Code Generation</Text>
      {visible.map((line, i) => (
        <Text key={i} color="gray" wrap="truncate-end">
          {line}
        </Text>
      ))}
      {lines.length > MAX_DISPLAY_LINES && (
        <Text dimColor>... ({lines.length - MAX_DISPLAY_LINES} lines above)</Text>
      )}
    </Box>
  );
}
