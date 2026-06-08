import type { AgentTask, ExecutionStep } from '@frontagent/shared';
import { Annotation, END, MemorySaver, START, StateGraph } from '@langchain/langgraph';
import type { ExecutorOutput } from '../types.js';
import { buildOrderedPhaseGroups } from './phase-ordering.js';
import type {
  ExecutorCollectedContext,
  ExecutorConfig,
  LangGraphRuntimeState,
  PhaseExecutionGroup,
  SerializablePhaseExecutionGroup,
} from './types.js';

export interface StepFeedbackCallbacks {
  onStepStart?: (step: ExecutionStep) => void;
  onStepComplete?: (step: ExecutionStep, output: ExecutorOutput) => void;
  onPhaseStart?: (phase: string, stepCount: number) => void;
  onPhaseError?: (
    phase: string,
    errors: Array<{ step: ExecutionStep; error: string }>,
  ) => Promise<ExecutionStep[]>;
  onPhaseComplete?: (
    phase: string,
    results: ExecutorOutput[],
  ) => Promise<Array<{ step: ExecutionStep; error: string }>>;
  signal?: AbortSignal;
}

export type ExecuteSinglePhaseWithRecovery = (
  phaseGroup: PhaseExecutionGroup,
  context: {
    task: AgentTask;
    collectedContext: ExecutorCollectedContext;
  },
  completedStepIds: Set<string>,
  allResults: ExecutorOutput[],
  callbacks: StepFeedbackCallbacks,
) => Promise<void>;

export interface LangGraphStepFeedbackOptions {
  steps: ExecutionStep[];
  context: {
    task: AgentTask;
    collectedContext: ExecutorCollectedContext;
  };
  debugWarn: (...args: unknown[]) => void;
  langGraph?: ExecutorConfig['langGraph'];
  executeSinglePhaseWithRecovery: ExecuteSinglePhaseWithRecovery;
  callbacks?: StepFeedbackCallbacks;
}

export async function executeStepsWithErrorFeedbackViaLangGraph({
  steps,
  context,
  debugWarn,
  langGraph,
  executeSinglePhaseWithRecovery,
  callbacks = {},
}: LangGraphStepFeedbackOptions): Promise<ExecutorOutput[]> {
  const orderedPhaseGroups = buildOrderedPhaseGroups(steps, debugWarn);
  const serializablePhaseGroups: SerializablePhaseExecutionGroup[] = orderedPhaseGroups.map(
    (group) => ({
      phase: group.phase,
      steps: group.steps,
      dependencies: Array.from(group.dependencies),
      firstSeenIndex: group.firstSeenIndex,
      priority: group.priority,
    }),
  );

  const RuntimeStateAnnotation = Annotation.Root({
    runtime: Annotation<LangGraphRuntimeState>({
      reducer: (_left, right) => right,
      default: () => ({
        phaseGroups: [],
        phaseIndex: 0,
        completedStepIds: [],
        allResults: [],
      }),
    }),
  });

  const graph = new StateGraph(RuntimeStateAnnotation)
    .addNode('select_phase', () => ({}))
    .addNode('execute_phase', async (state) => {
      const runtime = state.runtime as LangGraphRuntimeState;
      if (runtime.phaseIndex >= runtime.phaseGroups.length) {
        return {};
      }

      const phaseGroupData = runtime.phaseGroups[runtime.phaseIndex];
      const phaseGroup: PhaseExecutionGroup = {
        ...phaseGroupData,
        dependencies: new Set(phaseGroupData.dependencies),
      };
      const completedStepIds = new Set(runtime.completedStepIds);
      const allResults = [...runtime.allResults];

      await executeSinglePhaseWithRecovery(
        phaseGroup,
        context,
        completedStepIds,
        allResults,
        callbacks,
      );

      return {
        runtime: {
          ...runtime,
          completedStepIds: Array.from(completedStepIds),
          allResults,
        },
      };
    })
    .addNode('advance_phase', (state) => {
      const runtime = state.runtime as LangGraphRuntimeState;
      return {
        runtime: {
          ...runtime,
          phaseIndex: runtime.phaseIndex + 1,
        },
      };
    })
    .addEdge(START, 'select_phase')
    .addConditionalEdges('select_phase', (state) => {
      const runtime = state.runtime as LangGraphRuntimeState;
      return runtime.phaseIndex >= runtime.phaseGroups.length ? END : 'execute_phase';
    })
    .addEdge('execute_phase', 'advance_phase')
    .addEdge('advance_phase', 'select_phase')
    .compile({
      checkpointer: langGraph?.useCheckpoint ? new MemorySaver() : undefined,
      name: 'frontagent.phase.flow',
    });

  const initialState: LangGraphRuntimeState = {
    phaseGroups: serializablePhaseGroups,
    phaseIndex: 0,
    completedStepIds: [],
    allResults: [],
  };

  const runnableConfig = langGraph?.useCheckpoint
    ? {
        configurable: {
          thread_id: `${langGraph?.threadIdPrefix ?? 'frontagent'}-${Date.now()}`,
        },
      }
    : undefined;

  const finalState = (await graph.invoke(
    { runtime: initialState },
    runnableConfig as unknown as Record<string, unknown>,
  )) as {
    runtime?: LangGraphRuntimeState;
  };

  return finalState.runtime?.allResults ?? [];
}
