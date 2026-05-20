import type { ExecutionStep, SDDConfig } from '@frontagent/shared';
import type { A2AAgent, InMemoryA2ABus } from '../a2a.js';
import type { ContextManager } from '../context.js';
import type { Executor } from '../executor.js';
import type {
  CodeQualityIssue,
  CodeQualityReviewFile,
  CodeQualityReviewRequest,
  CodeQualityReviewResponse,
} from '../sub-agents/index.js';
import type { AgentConfig, ProjectFactsUpdate } from '../types.js';

export interface PhaseCheckDeps {
  config: AgentConfig;
  executor: Executor;
  contextManager: ContextManager;
  sddConfig?: SDDConfig;
  a2aBus: InMemoryA2ABus;
  codeQualitySubAgent?: A2AAgent<CodeQualityReviewRequest, CodeQualityReviewResponse>;
  debugLog: (...args: unknown[]) => void;
  debugWarn: (...args: unknown[]) => void;
  enqueueFactsUpdate: (taskId: string, update: ProjectFactsUpdate) => Promise<void>;
}

export function shouldRunPhaseChecks(phase: string): boolean {
  const normalized = phase.toLowerCase();
  return (
    phase.includes('创建') ||
    phase.includes('实现') ||
    phase === '未分组' ||
    normalized.includes('create') ||
    normalized.includes('implement')
  );
}

export async function checkMissingNpmDependencies(
  deps: PhaseCheckDeps,
  collectedFiles: Map<string, string> = new Map(),
): Promise<string[]> {
  const packageJsonPath = 'package.json';
  let packageJson: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  } = {};

  const packageJsonContent = collectedFiles.get(packageJsonPath);
  if (packageJsonContent) {
    try {
      packageJson = JSON.parse(packageJsonContent);
    } catch (error) {
      deps.debugWarn('[Agent] Failed to parse package.json:', error);
    }
  }

  const declaredDeps = new Set([
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.devDependencies || {}),
  ]);

  const usedDeps = new Set<string>();
  const importRegex = /^import\s+.*?\s+from\s+['"]([^'"]+)['"]/gm;
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (const [filePath, content] of collectedFiles.entries()) {
    if (!/\.(tsx?|jsx?|mjs|cjs)$/.test(filePath)) continue;

    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
        const pkgName = importPath.startsWith('@')
          ? importPath.split('/').slice(0, 2).join('/')
          : importPath.split('/')[0];
        usedDeps.add(pkgName);
      }
    }

    while ((match = requireRegex.exec(content)) !== null) {
      const requirePath = match[1];
      if (!requirePath.startsWith('.') && !requirePath.startsWith('/')) {
        const pkgName = requirePath.startsWith('@')
          ? requirePath.split('/').slice(0, 2).join('/')
          : requirePath.split('/')[0];
        usedDeps.add(pkgName);
      }
    }
  }

  const missingDeps: string[] = [];
  for (const dep of usedDeps) {
    if (!declaredDeps.has(dep)) {
      missingDeps.push(dep);
    }
  }

  return missingDeps;
}

export async function runTypeCheck(
  deps: PhaseCheckDeps,
  workingDir: string,
): Promise<Array<{ file: string; line: number; column: number; message: string; code: string }>> {
  try {
    const result = (await deps.executor.callTool('run_command', {
      command: 'npx tsc --noEmit 2>&1',
      cwd: workingDir,
    })) as { success: boolean; output: string; error?: string };

    const output = result.output || result.error || '';

    const errorRegex = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/gm;
    const errors: Array<{
      file: string;
      line: number;
      column: number;
      message: string;
      code: string;
    }> = [];

    let match: RegExpExecArray | null;
    while ((match = errorRegex.exec(output)) !== null) {
      errors.push({
        file: match[1],
        line: Number.parseInt(match[2], 10),
        column: Number.parseInt(match[3], 10),
        code: match[4],
        message: match[5],
      });
    }

    return errors;
  } catch (error) {
    deps.debugWarn('[Agent] TypeScript check failed:', error);
    return [];
  }
}

export function collectGeneratedCodeFilesForPhase(
  deps: PhaseCheckDeps,
  phase: string,
  steps: ExecutionStep[],
): string[] {
  const maxFiles = deps.config.subAgents?.codeQualityEvaluator?.maxFilesPerPhase ?? 20;
  const codeFileRegex = /\.(tsx?|jsx?|mjs|cjs)$/;
  const paths = new Set<string>();

  for (const step of steps) {
    const stepPhase = step.phase || '未分组';
    if (stepPhase !== phase) continue;
    if (step.status !== 'completed') continue;
    if (step.action !== 'create_file' && step.action !== 'apply_patch') continue;

    const path = step.params.path;
    if (typeof path !== 'string') continue;
    if (!codeFileRegex.test(path)) continue;

    paths.add(path);
    if (paths.size >= maxFiles) break;
  }

  return Array.from(paths);
}

export async function readFilesForCodeQualityReview(
  deps: PhaseCheckDeps,
  filePaths: string[],
  collectedFiles: Map<string, string>,
): Promise<CodeQualityReviewFile[]> {
  const files: CodeQualityReviewFile[] = [];

  for (const path of filePaths) {
    try {
      const readResult = (await deps.executor.callTool('read_file', { path })) as {
        success: boolean;
        content?: string;
      };

      if (readResult.success && typeof readResult.content === 'string') {
        collectedFiles.set(path, readResult.content);
        files.push({ path, content: readResult.content });
        continue;
      }
    } catch (error) {
      deps.debugWarn(`[Agent] Failed to read file for code quality review: ${path}`, error);
    }

    const fallbackContent = collectedFiles.get(path);
    if (fallbackContent !== undefined) {
      files.push({ path, content: fallbackContent });
    }
  }

  return files;
}

export async function evaluateGeneratedCodeQualityViaSubAgent(
  deps: PhaseCheckDeps,
  taskId: string,
  phase: string,
  steps: ExecutionStep[],
  collectedFiles: Map<string, string>,
): Promise<CodeQualityIssue[]> {
  if (!deps.codeQualitySubAgent || !deps.a2aBus.hasAgent(deps.codeQualitySubAgent.agentId)) {
    return [];
  }

  const filePaths = collectGeneratedCodeFilesForPhase(deps, phase, steps);
  if (filePaths.length === 0) {
    return [];
  }

  const reviewFiles = await readFilesForCodeQualityReview(deps, filePaths, collectedFiles);
  if (reviewFiles.length === 0) {
    return [];
  }

  const request: CodeQualityReviewRequest = {
    taskId,
    phase,
    files: reviewFiles,
    sddConfig: deps.sddConfig,
    sharedFacts: deps.contextManager.exportFactsSnapshot(taskId),
  };

  const response = await deps.a2aBus.request<CodeQualityReviewRequest, CodeQualityReviewResponse>({
    from: 'frontagent.main',
    to: deps.codeQualitySubAgent.agentId,
    intent: 'code_quality.review_generated_files',
    payload: request,
  });

  if (!response.success || !response.payload) {
    deps.debugWarn(
      `[Agent] CodeQualitySubAgent request failed: ${response.error ?? 'Unknown error'}`,
    );
    return [];
  }

  if (response.payload.factUpdates) {
    await deps.enqueueFactsUpdate(taskId, response.payload.factUpdates);
  }

  deps.debugLog(`[Agent] ${response.payload.summary}`);

  return response.payload.issues;
}
