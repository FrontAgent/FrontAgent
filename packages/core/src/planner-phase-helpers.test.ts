import type { AgentTask, ExecutionStep, ValidationRule } from '@frontagent/shared';
import { describe, expect, it } from 'vitest';
import { injectRepositoryManagementPhase } from './planner-phase-helpers.js';

function createTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-1',
    type: 'create',
    description: 'create and verify a file',
    context: { workingDirectory: '/project' },
    ...overrides,
  };
}

let stepIndex = 0;

const repositoryManagementCommands = [
  'git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "Skip repo management: not a git repository"; exit 0; }; command -v gh >/dev/null 2>&1 || { echo "Skip repo management: gh CLI not installed"; exit 0; }; gh auth status >/dev/null 2>&1 || { echo "Skip repo management: gh not authenticated"; exit 0; }; if [ -z "$(git status --porcelain)" ]; then echo "Skip repo management: no file changes"; exit 0; fi; echo "Repo management precheck passed"',
  'branch="$(git rev-parse --abbrev-ref HEAD)"; if [ "$branch" = "HEAD" ]; then new_branch="codex/auto-$(date +%Y%m%d-%H%M%S)"; git switch -c "$new_branch"; branch="$new_branch"; fi; case "$branch" in codex/*) ;; *) target_branch="codex/$' +
    '{branch}"; git switch -c "$target_branch" 2>/dev/null || git switch "$target_branch"; branch="$target_branch";; esac; echo "Using branch: $branch"',
  'git add -A; if git diff --cached --quiet; then echo "No staged changes, skip commit"; exit 0; fi; git commit -m "chore: automate repository management after acceptance"',
  'branch="$(git rev-parse --abbrev-ref HEAD)"; if [ "$branch" = "HEAD" ]; then echo "Skip push: detached HEAD"; exit 0; fi; git remote get-url origin >/dev/null 2>&1 || { echo "Skip push: missing origin remote"; exit 0; }; git push -u origin "$branch"',
  'branch="$(git rev-parse --abbrev-ref HEAD)"; if [ "$branch" = "HEAD" ]; then echo "Skip PR: detached HEAD"; exit 0; fi; command -v gh >/dev/null 2>&1 || { echo "Skip PR: gh CLI not installed"; exit 0; }; gh auth status >/dev/null 2>&1 || { echo "Skip PR: gh not authenticated"; exit 0; }; if gh pr view "$branch" >/dev/null 2>&1; then gh pr edit "$branch" --title "chore: automated update by FrontAgent" --body "Automated PR update after acceptance phase passed."; else gh pr create --head "$branch" --title "chore: automated update by FrontAgent" --body "Automated PR created by FrontAgent after acceptance phase passed."; fi',
] as const;

function createStep(options: {
  description: string;
  action: ExecutionStep['action'];
  tool: string;
  params: Record<string, unknown>;
  dependencies?: string[];
  validation?: ValidationRule[];
  phase?: string;
}): ExecutionStep {
  stepIndex += 1;
  return {
    stepId: `step-${stepIndex}`,
    description: options.description,
    action: options.action,
    tool: options.tool,
    params: options.params,
    dependencies: options.dependencies ?? [],
    validation: options.validation ?? [],
    status: 'pending',
    phase: options.phase,
  };
}

describe('planner phase helpers', () => {
  it('adds repository management steps after acceptance commands for code changes', () => {
    const createFile = createStep({
      description: 'create file',
      action: 'create_file',
      tool: 'create_file',
      params: { path: 'src/new.ts' },
      phase: '阶段2-创建',
    });
    const typecheck = createStep({
      description: 'typecheck',
      action: 'run_command',
      tool: 'run_command',
      params: { command: 'pnpm typecheck' },
      phase: '阶段4-验证',
      dependencies: [createFile.stepId],
    });

    const result = injectRepositoryManagementPhase(createTask(), [createFile, typecheck], {
      createStep,
    });

    const repoSteps = result.filter((step) => step.phase === '阶段7-仓库管理');
    expect(repoSteps).toHaveLength(5);
    expect(repoSteps[0].dependencies).toEqual([typecheck.stepId]);
    expect(repoSteps.map((step) => step.description)).toEqual([
      '检查 Git/GH 环境并确认仓库存在可提交变更',
      '确保当前分支符合 codex/* 规范',
      '提交验收后的代码变更',
      '推送分支到远程 origin',
      '使用 gh 自动创建或更新 Pull Request',
    ]);
    expect(
      repoSteps.map((step) => ({
        action: step.action,
        tool: step.tool,
        phase: step.phase,
        command: step.params.command,
        dependencies: step.dependencies,
      })),
    ).toEqual([
      {
        action: 'run_command',
        tool: 'run_command',
        phase: '阶段7-仓库管理',
        command: repositoryManagementCommands[0],
        dependencies: [typecheck.stepId],
      },
      {
        action: 'run_command',
        tool: 'run_command',
        phase: '阶段7-仓库管理',
        command: repositoryManagementCommands[1],
        dependencies: [repoSteps[0].stepId],
      },
      {
        action: 'run_command',
        tool: 'run_command',
        phase: '阶段7-仓库管理',
        command: repositoryManagementCommands[2],
        dependencies: [repoSteps[1].stepId],
      },
      {
        action: 'run_command',
        tool: 'run_command',
        phase: '阶段7-仓库管理',
        command: repositoryManagementCommands[3],
        dependencies: [repoSteps[2].stepId],
      },
      {
        action: 'run_command',
        tool: 'run_command',
        phase: '阶段7-仓库管理',
        command: repositoryManagementCommands[4],
        dependencies: [repoSteps[3].stepId],
      },
    ]);
  });

  it('does not inject repository management for query tasks or existing repo phases', () => {
    const patch = createStep({
      description: 'patch file',
      action: 'apply_patch',
      tool: 'apply_patch',
      params: { path: 'src/app.ts' },
      phase: '阶段2-修改',
    });
    const test = createStep({
      description: 'test',
      action: 'run_command',
      tool: 'run_command',
      params: { command: 'pnpm test' },
      phase: '阶段4-验证',
      dependencies: [patch.stepId],
    });
    const existingRepo = createStep({
      description: 'commit',
      action: 'run_command',
      tool: 'run_command',
      params: { command: 'git commit -m "x"' },
      phase: '阶段7-仓库管理',
      dependencies: [test.stepId],
    });

    expect(
      injectRepositoryManagementPhase(createTask({ type: 'query' }), [patch, test], {
        createStep,
      }),
    ).toEqual([patch, test]);
    expect(
      injectRepositoryManagementPhase(createTask(), [patch, test, existingRepo], {
        createStep,
      }),
    ).toEqual([patch, test, existingRepo]);
  });
});
