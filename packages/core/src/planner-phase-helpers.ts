import type { AgentTask, ExecutionStep } from '@frontagent/shared';
import type { PlannerStepFactory } from './skills/index.js';

/**
 * 在验收阶段成功后追加仓库管理阶段（Git + GitHub CLI）
 */
export function injectRepositoryManagementPhase(
  task: AgentTask,
  steps: ExecutionStep[],
  stepFactory: PlannerStepFactory,
): ExecutionStep[] {
  if (!shouldInjectRepositoryManagementPhase(task, steps)) {
    return steps;
  }

  if (hasRepositoryManagementPhase(steps)) {
    return steps;
  }

  const acceptanceStepIds = collectAcceptanceStepIds(steps);
  if (acceptanceStepIds.length === 0) {
    return steps;
  }

  const repoSteps = createRepositoryManagementSteps(acceptanceStepIds, stepFactory);
  return [...steps, ...repoSteps];
}

function shouldInjectRepositoryManagementPhase(task: AgentTask, steps: ExecutionStep[]): boolean {
  const hasCodeChanges = steps.some(
    (step) => step.action === 'create_file' || step.action === 'apply_patch',
  );
  if (!hasCodeChanges) {
    return false;
  }

  if (task.type === 'query') {
    return false;
  }

  return true;
}

function hasRepositoryManagementPhase(steps: ExecutionStep[]): boolean {
  return steps.some((step) => {
    const phase = (step.phase ?? '').toLowerCase();
    const command =
      typeof step.params.command === 'string' ? step.params.command.toLowerCase() : '';

    return (
      phase.includes('仓库管理') ||
      phase.includes('repository') ||
      phase.includes('repo') ||
      command.includes('gh pr') ||
      command.includes('git push') ||
      command.includes('git commit')
    );
  });
}

function collectAcceptanceStepIds(steps: ExecutionStep[]): string[] {
  return steps.filter((step) => isAcceptanceStep(step)).map((step) => step.stepId);
}

function isAcceptanceStep(step: ExecutionStep): boolean {
  const phase = (step.phase ?? '').toLowerCase();
  const action = step.action;
  const command = typeof step.params.command === 'string' ? step.params.command.toLowerCase() : '';

  if (
    phase.includes('验收') ||
    phase.includes('验证') ||
    phase.includes('accept') ||
    phase.includes('valid')
  ) {
    return true;
  }

  if (
    action === 'browser_navigate' ||
    action === 'browser_screenshot' ||
    action === 'get_page_structure' ||
    action === 'browser_click' ||
    action === 'browser_type'
  ) {
    return true;
  }

  if (action === 'run_command') {
    return (
      command.includes('typecheck') ||
      command.includes('tsc') ||
      command.includes('build') ||
      command.includes('test') ||
      command.includes('lint') ||
      command.includes('validate')
    );
  }

  return false;
}

function createRepositoryManagementSteps(
  acceptanceStepIds: string[],
  stepFactory: PlannerStepFactory,
): ExecutionStep[] {
  const phase = '阶段7-仓库管理';

  const precheck = stepFactory.createStep({
    description: '检查 Git/GH 环境并确认仓库存在可提交变更',
    action: 'run_command',
    tool: 'run_command',
    phase,
    params: {
      command:
        'git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "Skip repo management: not a git repository"; exit 0; }; command -v gh >/dev/null 2>&1 || { echo "Skip repo management: gh CLI not installed"; exit 0; }; gh auth status >/dev/null 2>&1 || { echo "Skip repo management: gh not authenticated"; exit 0; }; if [ -z "$(git status --porcelain)" ]; then echo "Skip repo management: no file changes"; exit 0; fi; echo "Repo management precheck passed"',
    },
    dependencies: acceptanceStepIds,
  });

  const ensureBranch = stepFactory.createStep({
    description: '确保当前分支符合 codex/* 规范',
    action: 'run_command',
    tool: 'run_command',
    phase,
    params: {
      command:
        'branch="$(git rev-parse --abbrev-ref HEAD)"; if [ "$branch" = "HEAD" ]; then new_branch="codex/auto-$(date +%Y%m%d-%H%M%S)"; git switch -c "$new_branch"; branch="$new_branch"; fi; case "$branch" in codex/*) ;; *) target_branch="codex/$' +
        '{branch}"; git switch -c "$target_branch" 2>/dev/null || git switch "$target_branch"; branch="$target_branch";; esac; echo "Using branch: $branch"',
    },
    dependencies: [precheck.stepId],
  });

  const commit = stepFactory.createStep({
    description: '提交验收后的代码变更',
    action: 'run_command',
    tool: 'run_command',
    phase,
    params: {
      command:
        'git add -A; if git diff --cached --quiet; then echo "No staged changes, skip commit"; exit 0; fi; git commit -m "chore: automate repository management after acceptance"',
    },
    dependencies: [ensureBranch.stepId],
  });

  const push = stepFactory.createStep({
    description: '推送分支到远程 origin',
    action: 'run_command',
    tool: 'run_command',
    phase,
    params: {
      command:
        'branch="$(git rev-parse --abbrev-ref HEAD)"; if [ "$branch" = "HEAD" ]; then echo "Skip push: detached HEAD"; exit 0; fi; git remote get-url origin >/dev/null 2>&1 || { echo "Skip push: missing origin remote"; exit 0; }; git push -u origin "$branch"',
    },
    dependencies: [commit.stepId],
  });

  const managePr = stepFactory.createStep({
    description: '使用 gh 自动创建或更新 Pull Request',
    action: 'run_command',
    tool: 'run_command',
    phase,
    params: {
      command:
        'branch="$(git rev-parse --abbrev-ref HEAD)"; if [ "$branch" = "HEAD" ]; then echo "Skip PR: detached HEAD"; exit 0; fi; command -v gh >/dev/null 2>&1 || { echo "Skip PR: gh CLI not installed"; exit 0; }; gh auth status >/dev/null 2>&1 || { echo "Skip PR: gh not authenticated"; exit 0; }; if gh pr view "$branch" >/dev/null 2>&1; then gh pr edit "$branch" --title "chore: automated update by FrontAgent" --body "Automated PR update after acceptance phase passed."; else gh pr create --head "$branch" --title "chore: automated update by FrontAgent" --body "Automated PR created by FrontAgent after acceptance phase passed."; fi',
    },
    dependencies: [push.stepId],
  });

  return [precheck, ensureBranch, commit, push, managePr];
}
