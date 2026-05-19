import path from 'node:path';
import type { AgentTask, ExecutionStep } from '@frontagent/shared';

export type FilesenseNavigationIntent =
  | 'locate'
  | 'understand_structure'
  | 'find_conventions'
  | 'prepare_refactor'
  | 'prepare_create';

export interface FilesenseDecision {
  enabled: boolean;
  intent?: FilesenseNavigationIntent;
  paths: string[];
  depth: number;
  maxEntries: number;
  maxBytes: number;
  reason: string;
}

const DEFAULT_DECISION: Omit<FilesenseDecision, 'enabled' | 'reason' | 'intent'> = {
  paths: ['.'],
  depth: 2,
  maxEntries: 300,
  maxBytes: 128 * 1024,
};

const FILE_ACTIONS = new Set([
  'create_file',
  'apply_patch',
  'read_file',
  'list_directory',
  'search_code',
]);

function skip(reason: string): FilesenseDecision {
  return { enabled: false, reason, ...DEFAULT_DECISION };
}

function enable(
  intent: FilesenseNavigationIntent,
  reason: string,
  overrides: Partial<Omit<FilesenseDecision, 'enabled' | 'reason' | 'intent'>> = {},
): FilesenseDecision {
  return {
    enabled: true,
    intent,
    reason,
    ...DEFAULT_DECISION,
    ...overrides,
  };
}

function stringParam(step: ExecutionStep, key: string): string | undefined {
  const value = step.params[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function normalizeDir(input: string): string {
  const normalized = input.replace(/\\/g, '/');
  if (!normalized || normalized === '.') return '.';
  if (normalized.endsWith('/')) return normalized.replace(/\/+$/, '') || '.';
  const ext = path.posix.extname(normalized);
  return ext ? path.posix.dirname(normalized) || '.' : normalized;
}

function uniqueDirs(dirs: string[], limit: number): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const dir of dirs) {
    const normalized = normalizeDir(dir);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
    if (output.length >= limit) break;
  }
  return output.length > 0 ? output : ['.'];
}

function isKnownSingleFileTask(steps: ExecutionStep[]): boolean {
  const fileSteps = steps.filter((step) => FILE_ACTIONS.has(step.action));
  if (fileSteps.length !== 1) return false;

  const [step] = fileSteps;
  if (!['read_file', 'apply_patch', 'create_file'].includes(step.action)) return false;

  const targetPath = stringParam(step, 'path');
  return Boolean(targetPath && path.posix.extname(targetPath.replace(/\\/g, '/')));
}

function taskMentionsLocationNeed(task: AgentTask): boolean {
  const text = task.description.toLowerCase();
  return /where|which file|locate|find|入口|在哪|哪个文件|查找|寻找|定位/.test(text);
}

function taskMentionsStructureNeed(task: AgentTask): boolean {
  const text = task.description.toLowerCase();
  return /architecture|structure|overview|map|架构|结构|目录|模块|梳理|理解/.test(text);
}

function collectTargetDirs(steps: ExecutionStep[]): string[] {
  const dirs: string[] = [];
  for (const step of steps) {
    const pathParam = stringParam(step, 'path');
    if (pathParam) dirs.push(pathParam);
  }
  return uniqueDirs(dirs, 5);
}

export function decideFilesense(task: AgentTask, steps: ExecutionStep[]): FilesenseDecision {
  if (!steps.some((step) => FILE_ACTIONS.has(step.action))) {
    return skip('no file-system exploration or mutation steps');
  }

  if (task.type === 'query') {
    if (taskMentionsStructureNeed(task) || taskMentionsLocationNeed(task)) {
      return enable('understand_structure', 'query requires repository structure', {
        paths: ['.'],
        depth: 2,
        maxEntries: 250,
        maxBytes: 96 * 1024,
      });
    }
    return skip('query task without repository-structure need');
  }

  if (isKnownSingleFileTask(steps)) {
    return skip('known single-file task can use direct file tools');
  }

  if (taskMentionsLocationNeed(task)) {
    return enable('locate', 'task needs locating files or entrypoints', {
      paths: ['.'],
      depth: 2,
      maxEntries: 300,
    });
  }

  if (task.type === 'create') {
    return enable('prepare_create', 'create task benefits from nearby placement conventions', {
      paths: collectTargetDirs(steps),
      depth: 1,
      maxEntries: 180,
      maxBytes: 64 * 1024,
    });
  }

  if (task.type === 'refactor' || steps.filter((step) => step.action === 'apply_patch' || step.action === 'create_file').length > 1) {
    return enable('prepare_refactor', 'multi-file change benefits from local directory map', {
      paths: collectTargetDirs(steps),
      depth: 2,
      maxEntries: 500,
      maxBytes: 160 * 1024,
    });
  }

  if (task.type === 'debug' || taskMentionsStructureNeed(task)) {
    return enable('understand_structure', 'debug or structure task benefits from lightweight map', {
      paths: collectTargetDirs(steps),
      depth: 2,
      maxEntries: 300,
    });
  }

  return skip('no clear filesense benefit');
}
