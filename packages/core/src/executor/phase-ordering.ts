import type { ExecutionStep } from '@frontagent/shared';
import type { PhaseExecutionGroup } from './types.js';

export function getPhasePriority(phase: string): number {
  const normalized = phase.toLowerCase();

  if (normalized.includes('分析') || normalized.includes('analy')) return 10;
  if (
    normalized.includes('创建') ||
    normalized.includes('实现') ||
    normalized.includes('create') ||
    normalized.includes('implement')
  )
    return 20;
  if (normalized.includes('安装') || normalized.includes('install')) return 30;
  if (
    normalized.includes('验证') ||
    normalized.includes('验收') ||
    normalized.includes('valid') ||
    normalized.includes('accept')
  )
    return 40;
  if (normalized.includes('启动') || normalized.includes('start') || normalized.includes('serve'))
    return 50;
  if (normalized.includes('浏览器') || normalized.includes('browser')) return 60;
  if (
    normalized.includes('仓库') ||
    normalized.includes('repo') ||
    normalized.includes('repository')
  )
    return 70;
  if (normalized.includes('未分组') || normalized.includes('ungroup')) return 90;

  return 80;
}

function comparePhaseGroup(a: PhaseExecutionGroup, b: PhaseExecutionGroup): number {
  if (a.priority !== b.priority) {
    return a.priority - b.priority;
  }
  if (a.firstSeenIndex !== b.firstSeenIndex) {
    return a.firstSeenIndex - b.firstSeenIndex;
  }
  return a.phase.localeCompare(b.phase);
}

function topologicalSortPhaseGroups(
  groups: PhaseExecutionGroup[],
  debugWarn?: (...args: unknown[]) => void,
): PhaseExecutionGroup[] {
  if (groups.length <= 1) {
    return groups;
  }

  const groupMap = new Map(groups.map((group) => [group.phase, group]));
  const indegree = new Map<string, number>();
  const outgoing = new Map<string, Set<string>>();

  for (const group of groups) {
    indegree.set(group.phase, 0);
    outgoing.set(group.phase, new Set<string>());
  }

  for (const group of groups) {
    for (const dep of group.dependencies) {
      if (!groupMap.has(dep)) continue;
      indegree.set(group.phase, (indegree.get(group.phase) ?? 0) + 1);
      outgoing.get(dep)!.add(group.phase);
    }
  }

  const ready = groups.filter((group) => (indegree.get(group.phase) ?? 0) === 0);
  ready.sort((a, b) => comparePhaseGroup(a, b));

  const ordered: PhaseExecutionGroup[] = [];

  while (ready.length > 0) {
    const current = ready.shift()!;
    ordered.push(current);

    for (const nextPhase of outgoing.get(current.phase) ?? []) {
      const nextDegree = (indegree.get(nextPhase) ?? 0) - 1;
      indegree.set(nextPhase, nextDegree);

      if (nextDegree === 0) {
        const nextGroup = groupMap.get(nextPhase);
        if (nextGroup) {
          ready.push(nextGroup);
        }
      }
    }

    ready.sort((a, b) => comparePhaseGroup(a, b));
  }

  if (ordered.length !== groups.length) {
    debugWarn?.('[Executor] Detected phase dependency cycle, fallback to priority ordering');
    return [...groups].sort((a, b) => comparePhaseGroup(a, b));
  }

  return ordered;
}

export function buildOrderedPhaseGroups(
  steps: ExecutionStep[],
  debugWarn?: (...args: unknown[]) => void,
): PhaseExecutionGroup[] {
  const phaseGroups = new Map<string, PhaseExecutionGroup>();
  const stepToPhase = new Map<string, string>();

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const phase = step.phase || '未分组';
    stepToPhase.set(step.stepId, phase);

    if (!phaseGroups.has(phase)) {
      phaseGroups.set(phase, {
        phase,
        steps: [],
        dependencies: new Set<string>(),
        firstSeenIndex: i,
        priority: getPhasePriority(phase),
      });
    }

    phaseGroups.get(phase)!.steps.push(step);
  }

  for (const step of steps) {
    const phase = step.phase || '未分组';
    const group = phaseGroups.get(phase);
    if (!group) continue;

    for (const dep of step.dependencies) {
      const depPhase = stepToPhase.get(dep);
      if (!depPhase || depPhase === phase) continue;
      group.dependencies.add(depPhase);
    }
  }

  return topologicalSortPhaseGroups(Array.from(phaseGroups.values()), debugWarn);
}

export function detectLanguage(path: string): 'typescript' | 'javascript' | 'json' | 'yaml' | null {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'json':
      return 'json';
    case 'yaml':
    case 'yml':
      return 'yaml';
    default:
      return null;
  }
}
