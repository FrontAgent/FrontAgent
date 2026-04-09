import { Box, Text, Static } from 'ink';
import Spinner from 'ink-spinner';
import type { Store, PhaseState, StepStatus } from '../store.js';
import { useStoreSelector } from '../hooks.js';

interface PhaseTreeProps {
  store: Store;
}

const stepIcon: Record<StepStatus, string> = {
  pending: '○',
  running: '',
  completed: '✔',
  failed: '✖',
  skipped: '⏭',
};

const stepColor: Record<StepStatus, string> = {
  pending: 'gray',
  running: 'yellow',
  completed: 'green',
  failed: 'red',
  skipped: 'yellow',
};

function StepLine({ description, status, error }: {
  description: string;
  status: StepStatus;
  error?: string;
}) {
  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Box>
        {status === 'running' ? (
          <Text color="yellow">
            <Spinner type="dots" />
          </Text>
        ) : (
          <Text color={stepColor[status]}>{stepIcon[status]}</Text>
        )}
        <Text> </Text>
        <Text
          color={status === 'running' ? 'white' : stepColor[status]}
          dimColor={status === 'pending'}
        >
          {description}
        </Text>
      </Box>
      {error ? (
        <Box paddingLeft={4}>
          <Text color="red" dimColor wrap="truncate-end">
            {error}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}

function PhaseBlock({ phase }: { phase: PhaseState }) {
  const phaseIcon = phase.status === 'done' ? '◉' : phase.status === 'active' ? '◎' : '○';
  const phaseColor = phase.status === 'done' ? 'green' : phase.status === 'active' ? 'cyan' : 'gray';

  return (
    <Box flexDirection="column" marginBottom={phase.status === 'active' ? 1 : 0}>
      <Box>
        <Text color={phaseColor} bold={phase.status === 'active'}>
          {phaseIcon} {phase.name}
        </Text>
        {phase.status === 'done' && (
          <Text dimColor>
            {' '}({phase.steps.filter(s => s.status === 'completed').length}/{phase.steps.length})
          </Text>
        )}
      </Box>
      {(phase.status === 'active' || phase.status === 'done') &&
        phase.steps.map((step) => (
          <StepLine
            key={step.stepId}
            description={step.description}
            status={step.status}
            error={step.error}
          />
        ))}
    </Box>
  );
}

export function PhaseTree({ store }: PhaseTreeProps) {
  const phases = useStoreSelector(store, (s) => s.phases);
  const status = useStoreSelector(store, (s) => s.status);

  if (status !== 'executing' && status !== 'done' && status !== 'error') {
    return null;
  }

  if (phases.length === 0) return null;

  const completedPhases = phases.filter(p => p.status === 'done');
  const livePhases = phases.filter(p => p.status !== 'done');

  return (
    <Box flexDirection="column">
      <Static items={completedPhases}>
        {(phase) => (
          <Box key={phase.name} flexDirection="column">
            <PhaseBlock phase={phase} />
          </Box>
        )}
      </Static>
      {livePhases.map((phase) => (
        <PhaseBlock key={phase.name} phase={phase} />
      ))}
    </Box>
  );
}
