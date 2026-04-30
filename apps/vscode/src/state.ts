import type { AgentEvent, AgentExecutionResult } from '@frontagent/runtime-node';

export type ViewStatus = 'idle' | 'scanning' | 'planning' | 'executing' | 'done' | 'error';
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'rolled_back';

export interface ViewStep {
  stepId: string;
  description: string;
  action: string;
  tool: string;
  status: StepStatus;
  error?: string;
}

export interface ViewPhase {
  name: string;
  status: 'pending' | 'active' | 'done';
  steps: ViewStep[];
}

export interface ViewApproval {
  approvalId: string;
  toolName: string;
  riskLevel: string;
  reasonCode: string;
  message: string;
  argsSummary: string;
}

export interface ViewState {
  status: ViewStatus;
  taskDescription: string;
  lastActivityLabel: string;
  currentOperation: string | null;
  runLogPath: string | null;
  phases: ViewPhase[];
  currentPhase: string | null;
  currentStepId: string | null;
  ragMatches: Array<{ title: string; path?: string }>;
  ragSearchMode: string | null;
  ragReranked: boolean;
  ragWarnings: string[];
  approval: ViewApproval | null;
  result: AgentExecutionResult | null;
  streamText: string;
  isRunning: boolean;
  error: string | null;
}

export function createInitialViewState(): ViewState {
  return {
    status: 'idle',
    taskDescription: '',
    lastActivityLabel: '等待开始',
    currentOperation: null,
    runLogPath: null,
    phases: [],
    currentPhase: null,
    currentStepId: null,
    ragMatches: [],
    ragSearchMode: null,
    ragReranked: false,
    ragWarnings: [],
    approval: null,
    result: null,
    streamText: '',
    isRunning: false,
    error: null,
  };
}

function buildPhasesFromPlan(plan: Extract<AgentEvent, { type: 'planning_completed' }>['plan']): ViewPhase[] {
  const phaseMap = new Map<string, ViewPhase>();
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
      status: 'pending',
    });
  }
  return Array.from(phaseMap.values());
}

function upsertStep(state: ViewState, step: ViewStep, status: StepStatus, error?: string): ViewPhase[] {
  const phaseName = state.currentPhase || '未分组';
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

  if (phaseFound) return phases;
  return [
    ...phases,
    {
      name: phaseName,
      status: state.currentPhase === phaseName ? 'active' : 'pending',
      steps: [{ ...step, status, error }],
    },
  ];
}

function eventStepToViewStep(event: Extract<AgentEvent, { type: 'step_started' | 'step_completed' | 'step_failed' }>['step']): ViewStep {
  return {
    stepId: event.stepId,
    description: event.description,
    action: event.action,
    tool: event.tool,
    status: event.status,
  };
}

export function reduceAgentEvent(state: ViewState, event: AgentEvent): ViewState {
  switch (event.type) {
    case 'task_started':
      return {
        ...state,
        status: 'scanning',
        isRunning: true,
        taskDescription: event.task.description,
        lastActivityLabel: '任务已启动',
        currentOperation: '初始化任务',
        result: null,
        error: null,
        streamText: '',
      };
    case 'status_update':
      return {
        ...state,
        lastActivityLabel: event.label,
        currentOperation: event.operation ?? event.label,
      };
    case 'rag_retrieved':
      return {
        ...state,
        ragMatches: event.matches.map((match) => ({ title: match.title, path: match.path })),
        ragSearchMode: event.searchMode ?? null,
        ragReranked: event.reranked ?? false,
        ragWarnings: event.warnings ?? [],
        lastActivityLabel: '知识库检索完成',
        currentOperation: '规划准备',
      };
    case 'planning_started':
      return { ...state, status: 'planning', lastActivityLabel: '开始规划', currentOperation: '生成执行计划' };
    case 'planning_completed':
      return {
        ...state,
        status: 'executing',
        phases: buildPhasesFromPlan(event.plan),
        lastActivityLabel: '规划完成',
        currentOperation: '执行工具步骤',
      };
    case 'phase_started':
      return {
        ...state,
        currentPhase: event.phase,
        phases: state.phases.map((phase) => ({
          ...phase,
          status: phase.name === event.phase ? 'active' : phase.status === 'active' ? 'done' : phase.status,
        })),
        lastActivityLabel: `阶段开始：${event.phase}`,
        currentOperation: `执行阶段：${event.phase}`,
      };
    case 'phase_completed':
      return {
        ...state,
        phases: state.phases.map((phase) => ({
          ...phase,
          status: phase.name === event.phase ? 'done' : phase.status,
        })),
        currentPhase: state.phases.find((phase) => phase.name !== event.phase && phase.status !== 'done')?.name ?? null,
        lastActivityLabel: `阶段完成：${event.phase}`,
        currentOperation: '阶段收尾',
      };
    case 'step_started':
      return {
        ...state,
        currentStepId: event.step.stepId,
        phases: upsertStep(state, eventStepToViewStep(event.step), 'running'),
        lastActivityLabel: `工具开始：${event.step.tool}`,
        currentOperation: `${event.step.tool} ${event.step.description}`,
      };
    case 'step_completed':
      return {
        ...state,
        currentStepId: null,
        phases: upsertStep(state, eventStepToViewStep(event.step), 'completed'),
        lastActivityLabel: `工具完成：${event.step.tool}`,
        currentOperation: '等待下一步',
      };
    case 'step_failed':
      return {
        ...state,
        currentStepId: null,
        phases: upsertStep(state, eventStepToViewStep(event.step), 'failed', event.error),
        lastActivityLabel: `工具失败：${event.step.tool}`,
        currentOperation: '处理工具错误',
      };
    case 'stream_token':
      return {
        ...state,
        streamText: `${state.streamText}${event.token}`.slice(-12000),
      };
    case 'task_completed':
      return {
        ...state,
        status: event.result.success ? 'done' : 'error',
        isRunning: false,
        approval: null,
        result: event.result,
        error: event.result.error ?? null,
        lastActivityLabel: '任务完成',
        currentOperation: null,
      };
    case 'task_failed':
      return {
        ...state,
        status: 'error',
        isRunning: false,
        approval: null,
        error: event.error,
        lastActivityLabel: '任务失败',
        currentOperation: null,
      };
    default:
      return state;
  }
}
