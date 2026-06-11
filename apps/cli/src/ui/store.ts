/**
 * Lightweight external store for the Ink TUI.
 *
 * Tier 1 state: low-frequency updates read by multiple components.
 * Compatible with React 18's useSyncExternalStore.
 */

import type { AgentExecutionResult } from '@frontagent/core';
import type { ExecutionPlan } from '@frontagent/shared';

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export const RUN_STALL_THRESHOLD_MS = 30_000;

export interface StepState {
  stepId: string;
  description: string;
  action: string;
  tool: string;
  params: Record<string, unknown>;
  status: StepStatus;
  error?: string;
}

export interface PhaseState {
  name: string;
  status: 'pending' | 'active' | 'done';
  steps: StepState[];
}

export interface PendingApproval {
  approvalId: string;
  toolName: string;
  riskLevel: string;
  reasonCode: string;
  message: string;
  argsSummary: string;
  resolve: (approved: boolean, alwaysAllow?: boolean) => void;
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
  runLogPath: string | null;
  lastActivityAt: number;
  lastActivityLabel: string;
  currentOperation: string | null;
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
    runLogPath: null,
    lastActivityAt: Date.now(),
    lastActivityLabel: '等待开始',
    currentOperation: null,
  };
}

export function isRunPossiblyStalled(
  state: AgentUIState,
  now = Date.now(),
  thresholdMs = RUN_STALL_THRESHOLD_MS,
): boolean {
  const isActive = state.status !== 'idle' && state.status !== 'done' && state.status !== 'error';
  return isActive && state.approval === null && now - state.lastActivityAt >= thresholdMs;
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
        action: step.action,
        tool: step.tool,
        params: step.params,
        status: 'pending',
      });
    }
    return Array.from(phaseMap.values());
  }

  function updateStepStatus(stepId: string, status: StepStatus, error?: string) {
    const phases = state.phases.map((phase) => ({
      ...phase,
      steps: phase.steps.map((s) => (s.stepId === stepId ? { ...s, status, error } : s)),
    }));
    setState({ phases });
  }

  function upsertStep(
    step: Omit<StepState, 'status' | 'error'>,
    status: StepStatus,
    error?: string,
  ) {
    const phaseName = (step as { phase?: string }).phase || state.currentPhase || '未分组';
    let found = false;
    let phaseFound = false;

    const phases = state.phases.map((phase) => {
      if (phase.name !== phaseName) return phase;
      phaseFound = true;
      const steps = phase.steps.map((existing) => {
        if (existing.stepId !== step.stepId) return existing;
        found = true;
        return { ...existing, ...step, status, error };
      });
      return {
        ...phase,
        steps: found ? steps : [...steps, { ...step, status, error }],
      };
    });

    const nextPhases = phaseFound
      ? phases
      : [
          ...phases,
          {
            name: phaseName,
            status: state.currentPhase === phaseName ? ('active' as const) : ('pending' as const),
            steps: [{ ...step, status, error }],
          },
        ];

    setState({ phases: nextPhases });
  }

  function recordActivity(label: string, operation: string | null = label) {
    setState({
      lastActivityAt: Date.now(),
      lastActivityLabel: label,
      currentOperation: operation,
    });
  }

  function markPhaseActive(phaseName: string) {
    const phases = state.phases.map((p) => ({
      ...p,
      status:
        p.name === phaseName
          ? ('active' as const)
          : p.status === 'active'
            ? ('done' as const)
            : p.status,
    }));
    setState({ phases, currentPhase: phaseName });
  }

  function markPhaseDone(phaseName: string) {
    const phases = state.phases.map((p) => ({
      ...p,
      status: p.name === phaseName ? ('done' as const) : p.status,
    }));
    const nextActive = phases.find((p) => p.status !== 'done')?.name ?? null;
    setState({ phases, currentPhase: nextActive });
  }

  function resolveApproval(approvalId: string, approved: boolean, alwaysAllow = false): boolean {
    const current = state.approval;
    if (!current || current.approvalId !== approvalId) {
      return false;
    }

    setState({ approval: null });
    current.resolve(approved, alwaysAllow);
    return true;
  }

  return {
    getState,
    setState,
    subscribe,
    getSnapshot,
    buildPhasesFromPlan,
    updateStepStatus,
    upsertStep,
    markPhaseActive,
    markPhaseDone,
    recordActivity,
    resolveApproval,
  };
}

export type Store = ReturnType<typeof createStore>;
