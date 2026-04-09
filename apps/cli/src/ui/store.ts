/**
 * Lightweight external store for the Ink TUI.
 *
 * Tier 1 state: low-frequency updates read by multiple components.
 * Compatible with React 18's useSyncExternalStore.
 */

import type { ExecutionPlan } from '@frontagent/shared';
import type { AgentExecutionResult } from '@frontagent/core';

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface PhaseState {
  name: string;
  status: 'pending' | 'active' | 'done';
  steps: Array<{
    stepId: string;
    description: string;
    status: StepStatus;
    error?: string;
  }>;
}

export interface PendingApproval {
  command: string;
  resolve: (approved: boolean) => void;
}

export interface RagMatch {
  title: string;
  path?: string;
}

export interface AgentUIState {
  status: 'idle' | 'scanning' | 'planning' | 'executing' | 'done' | 'error';
  taskDescription: string;
  plan: ExecutionPlan | null;
  phases: PhaseState[];
  currentPhase: string | null;
  currentStepId: string | null;
  approval: PendingApproval | null;
  result: AgentExecutionResult | null;
  ragMatches: RagMatch[];
  ragSearchMode: string | null;
  ragReranked: boolean;
  ragWarnings: string[];
  debug: boolean;
  startTime: number;
}

type Listener = () => void;

function createInitialState(): AgentUIState {
  return {
    status: 'idle',
    taskDescription: '',
    plan: null,
    phases: [],
    currentPhase: null,
    currentStepId: null,
    approval: null,
    result: null,
    ragMatches: [],
    ragSearchMode: null,
    ragReranked: false,
    ragWarnings: [],
    debug: false,
    startTime: Date.now(),
  };
}

export function createStore() {
  let state = createInitialState();
  const listeners = new Set<Listener>();

  function getState(): AgentUIState {
    return state;
  }

  function setState(partial: Partial<AgentUIState>) {
    state = { ...state, ...partial };
    for (const listener of listeners) {
      listener();
    }
  }

  function subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function getSnapshot(): AgentUIState {
    return state;
  }

  function buildPhasesFromPlan(plan: ExecutionPlan): PhaseState[] {
    const phaseMap = new Map<string, PhaseState>();
    for (const step of plan.steps) {
      const phaseName = step.phase || '未分组';
      let phase = phaseMap.get(phaseName);
      if (!phase) {
        phase = { name: phaseName, status: 'pending', steps: [] };
        phaseMap.set(phaseName, phase);
      }
      phase.steps.push({
        stepId: step.stepId,
        description: step.description,
        status: 'pending',
      });
    }
    return Array.from(phaseMap.values());
  }

  function updateStepStatus(
    stepId: string,
    status: StepStatus,
    error?: string,
  ) {
    const phases = state.phases.map((phase) => ({
      ...phase,
      steps: phase.steps.map((s) =>
        s.stepId === stepId ? { ...s, status, error } : s,
      ),
    }));
    setState({ phases });
  }

  function markPhaseActive(phaseName: string) {
    const phases = state.phases.map((p) => ({
      ...p,
      status: p.name === phaseName ? 'active' as const : p.status === 'active' ? 'done' as const : p.status,
    }));
    setState({ phases, currentPhase: phaseName });
  }

  function markPhaseDone(phaseName: string) {
    const phases = state.phases.map((p) => ({
      ...p,
      status: p.name === phaseName ? 'done' as const : p.status,
    }));
    const nextActive = phases.find(p => p.status !== 'done')?.name ?? null;
    setState({ phases, currentPhase: nextActive });
  }

  return {
    getState,
    setState,
    subscribe,
    getSnapshot,
    buildPhasesFromPlan,
    updateStepStatus,
    markPhaseActive,
    markPhaseDone,
  };
}

export type Store = ReturnType<typeof createStore>;
