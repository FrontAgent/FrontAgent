/**
 * Tasks Phase — 任务分解与依赖图
 * 将计划拆分为原子化、可并行的执行步骤
 */

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  filePaths: string[];
  estimatedMinutes: number;
  dependsOn: string[];
  parallel: boolean;
  status: 'pending' | 'in_progress' | 'done' | 'skipped';
}

export interface TaskDecomposition {
  tasks: TaskItem[];
  criticalPath: string[];
  totalEstimatedMinutes: number;
}

export function generateTasksPrompt(
  planContent: string,
  config: { granularityMinutes: number },
): string {
  const parts: string[] = [
    '## Task Decomposition Phase',
    '',
    `Break the plan into atomic tasks. Each task should take ≤ ${config.granularityMinutes} minutes.`,
    '',
    'Rules:',
    '- Each task has ONE concrete action',
    '- Mark parallel-safe tasks with [P]',
    '- Mark dependencies with [depends: task-id]',
    '- Include specific file paths and commands',
    '',
    '### Plan to Decompose',
    planContent,
    '',
    '### Output Format',
    '```',
    '- [ ] task-1: [P] Create types in src/types.ts',
    '- [ ] task-2: [depends: task-1] Implement parser in src/parser.ts',
    '- [ ] task-3: [P] Add tests in tests/parser.test.ts',
    '```',
  ];

  return parts.join('\n');
}

export function parseTaskList(content: string): TaskItem[] {
  const tasks: TaskItem[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const match = line.match(/^-\s*\[[ x]\]\s*(task-\d+):\s*(.+)/i);
    if (!match) continue;

    const id = match[1];
    const rest = match[2];

    const parallel = rest.includes('[P]');
    const depsMatch = rest.match(/\[depends:\s*([^\]]+)\]/);
    const dependsOn = depsMatch ? depsMatch[1].split(',').map((s) => s.trim()) : [];

    const title = rest
      .replace(/\[P\]/g, '')
      .replace(/\[depends:[^\]]+\]/g, '')
      .trim();

    const filePaths = extractFilePathsFromText(title);

    tasks.push({
      id,
      title,
      description: title,
      filePaths,
      estimatedMinutes: 5,
      dependsOn,
      parallel,
      status: 'pending',
    });
  }

  return tasks;
}

export function computeCriticalPath(tasks: TaskItem[]): string[] {
  const visited = new Set<string>();
  const path: string[] = [];

  function visit(taskId: string) {
    if (visited.has(taskId)) return;
    visited.add(taskId);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    for (const dep of task.dependsOn) {
      visit(dep);
    }
    path.push(taskId);
  }

  const nonParallel = tasks.filter((t) => !t.parallel || t.dependsOn.length > 0);
  for (const task of nonParallel) {
    visit(task.id);
  }

  return path;
}

function extractFilePathsFromText(text: string): string[] {
  const pathPattern = /(?:src\/|\.\/|\w+\/)\S+\.\w{2,4}/g;
  return text.match(pathPattern) ?? [];
}
