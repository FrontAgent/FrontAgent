import type {
  ActionType,
  AgentTask,
  ExecutionPlan,
  ExecutionStep,
  ValidationResult,
} from '@frontagent/shared';
import { generateId } from '@frontagent/shared';
import type { ContextManager } from '../context.js';
import type { Executor } from '../executor.js';
import type { LLMService } from '../llm.js';
import type { CodeQualityIssue } from '../sub-agents/index.js';
import type { AgentEvent, ExecutorOutput, FilesenseNavigationIntent, SubAgentConfig } from '../types.js';
import type { PhaseCheckDeps } from './phase-checks.js';
import {
  checkMissingNpmDependencies,
  evaluateGeneratedCodeQualityViaSubAgent,
  runTypeCheck,
  shouldRunPhaseChecks,
} from './phase-checks.js';

export interface StepCallbackDeps {
  contextManager: ContextManager;
  executor: Executor;
  llmService: LLMService;
  emit(event: AgentEvent): void;
  emitStatus(label: string, operation?: string, detail?: string): void;
  debugLog(...args: unknown[]): void;
  debugWarn(...args: unknown[]): void;
  throwIfAborted(signal?: AbortSignal): void;
  phaseCheckDeps: PhaseCheckDeps;
  subAgentConfig?: SubAgentConfig;
}

export function createOnStepComplete(
  deps: StepCallbackDeps,
  task: AgentTask,
  executionContext: { collectedContext: { files: Map<string, string> } },
  validations: ValidationResult[],
): (step: ExecutionStep, output: ExecutorOutput) => void {
  return (step, output) => {
    const toolResult = output.stepResult.output as Record<string, unknown> | undefined;
    const resultWithStatus: Record<string, unknown> = {
      ...toolResult,
      success: output.stepResult.success,
      error: output.stepResult.error,
    };

    deps.contextManager.updateFileSystemFacts(task.id, step.tool, step.params, resultWithStatus);
    deps.contextManager.updateDependencyFacts(task.id, step.tool, step.params, resultWithStatus);
    deps.contextManager.updateProjectFacts(task.id, step.tool, step.params, resultWithStatus);
    deps.contextManager.updateModuleDependencyGraph(
      task.id,
      step.tool,
      step.params,
      resultWithStatus,
    );

    if (output.stepResult.success && step.tool === 'filesense_navigate') {
      deps.contextManager.updateFilesenseNavigation(task.id, {
        intent: step.params.intent as FilesenseNavigationIntent | undefined,
        paths: Array.isArray(step.params.paths) ? (step.params.paths as string[]) : undefined,
        data: resultWithStatus.data ?? resultWithStatus,
      });
      const filesenseNavigation = deps.contextManager.getContext(task.id)?.collectedContext
        .filesenseNavigation;
      if (filesenseNavigation) {
        deps.emit({
          type: 'filesense_navigated',
          intent: filesenseNavigation.intent,
          paths: filesenseNavigation.paths,
          entries: filesenseNavigation.scanned.entries,
          elapsedMs: filesenseNavigation.scanned.elapsedMs,
          truncated: filesenseNavigation.scanned.truncated,
          candidateCount: filesenseNavigation.candidates.length,
          warnings: filesenseNavigation.warnings,
        });
      }
    }

    if (output.stepResult.success) {
      deps.emit({ type: 'step_completed', step, result: output.stepResult });

      if (step.action === 'read_file' && output.stepResult.output) {
        const result = output.stepResult.output as Record<string, unknown>;
        if (result.content && step.params.path) {
          const filePath = step.params.path as string;
          executionContext.collectedContext.files.set(filePath, result.content as string);
          deps.debugLog(`[Agent] Added read file to context: ${filePath}`);
        }
      }

      if (step.action === 'create_file' && step.params.path) {
        const filePath = step.params.path as string;
        const result = output.stepResult.output as Record<string, unknown> | undefined;
        const content = (result?.content as string) || (step.params.content as string) || '';
        if (content) {
          executionContext.collectedContext.files.set(filePath, content);
          deps.debugLog(`[Agent] Added created file to context: ${filePath}`);
        }
      }
    } else {
      deps.emit({
        type: 'step_failed',
        step,
        error: output.stepResult.error ?? 'Unknown error',
      });

      deps.contextManager.addErrorFact(
        task.id,
        step.stepId,
        step.action,
        output.stepResult.error ?? 'Unknown error',
      );
    }
    validations.push(output.validation);
    deps.contextManager.addExecutedStep(task.id, step);
  };
}

// PLACEHOLDER_PHASE_ERROR

export function createOnPhaseError(
  deps: StepCallbackDeps,
  task: AgentTask,
  signal?: AbortSignal,
): (
  phase: string,
  errors: Array<{ step: ExecutionStep; error: string }>,
) => Promise<ExecutionStep[]> {
  return async (phase, errors) => {
    deps.throwIfAborted(signal);
    deps.emitStatus(`生成恢复计划：${phase}`, '分析错误并生成恢复步骤');
    deps.debugLog(`[Agent] Error feedback loop triggered for phase: ${phase}`);

    const missingModules = deps.contextManager.validateModuleDependencies(task.id);
    if (missingModules.length > 0) {
      deps.debugLog(`[Agent] Found ${missingModules.length} missing module dependencies`);
      for (const missing of missingModules.slice(0, 5)) {
        errors.push({
          step: {
            stepId: 'module-validation',
            description: `模块 ${missing.from} 引用了不存在的模块`,
            action: 'create_file',
            tool: 'create_file',
            params: { path: missing.missing },
            dependencies: [],
            validation: [],
            status: 'failed',
          } as ExecutionStep,
          error: `Missing module: ${missing.importPath} (resolved: ${missing.missing})`,
        });
      }
    }

    const factsContext = deps.contextManager.serializeFactsForLLM(task.id);

    const recoveryPlan = await deps.llmService.analyzeErrorsAndGenerateRecovery({
      task: task.description,
      phase,
      failedSteps: errors.map((e) => ({
        description: e.step.description,
        action: e.step.action,
        params: e.step.params,
        error: e.error,
      })),
      context: factsContext || '无可用的项目状态信息',
    });

    deps.debugLog(`[Agent] Recovery plan analysis: ${recoveryPlan.analysis}`);
    deps.debugLog(`[Agent] Can recover: ${recoveryPlan.canRecover}`);
    deps.debugLog(`[Agent] Recommendation: ${recoveryPlan.recommendation}`);

    if (!recoveryPlan.canRecover) {
      deps.debugWarn(`[Agent] Cannot recover from errors in phase ${phase}`);
      return [];
    }

    const recoveryStepIds = recoveryPlan.recoverySteps.map(() => generateId('recovery-step'));
    const recoverySteps: ExecutionStep[] = recoveryPlan.recoverySteps.map((step, idx) => ({
      stepId: recoveryStepIds[idx],
      description: step.description,
      action: step.action as ActionType,
      tool: step.tool,
      params: step.params as Record<string, unknown>,
      dependencies: idx > 0 ? [recoveryStepIds[idx - 1]] : [],
      validation: [],
      status: 'pending' as const,
      phase: step.phase,
    }));

    deps.debugLog(`[Agent] Generated ${recoverySteps.length} recovery steps`);
    deps.emitStatus(`恢复计划生成完成：${phase}`, `恢复步骤 ${recoverySteps.length} 个`);
    return recoverySteps;
  };
}

// PLACEHOLDER_PHASE_COMPLETE

export function createOnPhaseComplete(
  deps: StepCallbackDeps,
  task: AgentTask,
  executionPlan: ExecutionPlan,
  executionContext: { collectedContext: { files: Map<string, string> } },
  signal?: AbortSignal,
): (
  phase: string,
  phaseResults: ExecutorOutput[],
) => Promise<Array<{ step: ExecutionStep; error: string }>> {
  return async (phase, phaseResults) => {
    deps.throwIfAborted(signal);
    const successCount = phaseResults.filter((r) => r.stepResult.success).length;
    const failureCount = phaseResults.filter((r) => !r.stepResult.success).length;
    deps.emitStatus(`阶段检查：${phase}`, '阶段完成检查');

    const errors: Array<{ step: ExecutionStep; error: string }> = [];

    if (shouldRunPhaseChecks(phase)) {
      deps.debugLog(`[Agent] Running phase completion checks for: ${phase}`);

      deps.emitStatus(`检查模块依赖：${phase}`, '模块依赖检查');
      const missingModules = deps.contextManager.validateModuleDependencies(task.id);
      if (missingModules.length > 0) {
        deps.debugLog(
          `[Agent] Module validation found ${missingModules.length} missing dependencies`,
        );
        errors.push(
          ...missingModules.slice(0, 5).map((missing) => ({
            step: {
              stepId: `module-validation-${missing.missing.replace(/[^a-zA-Z0-9]/g, '-')}`,
              description: `模块 ${missing.from} 引用了不存在的模块: ${missing.importPath}`,
              action: 'create_file' as const,
              tool: 'create_file',
              params: { path: missing.missing },
              dependencies: [],
              validation: [],
              status: 'failed' as const,
            } as ExecutionStep,
            error: `Missing module: ${missing.importPath} (resolved path: ${missing.missing})`,
          })),
        );
      }

      try {
        deps.emitStatus(`刷新依赖清单：${phase}`, '读取 package.json');
        const pkgJsonResult = (await deps.executor.callTool('read_file', {
          path: 'package.json',
        })) as { success: boolean; content?: string };
        if (pkgJsonResult.success && pkgJsonResult.content) {
          executionContext.collectedContext.files.set('package.json', pkgJsonResult.content);
        }
      } catch (error) {
        deps.debugWarn('[Agent] Failed to refresh package.json:', error);
      }

      deps.emitStatus(`检查缺失依赖：${phase}`, 'npm 依赖检查');
      const missingDeps = await checkMissingNpmDependencies(
        deps.phaseCheckDeps,
        executionContext.collectedContext.files,
      );
      if (missingDeps.length > 0) {
        deps.debugLog(
          `[Agent] Found ${missingDeps.length} missing npm dependencies: ${missingDeps.join(', ')}`,
        );
        errors.push({
          step: {
            stepId: 'install-missing-deps',
            description: `安装缺失的依赖: ${missingDeps.join(', ')}`,
            action: 'run_command' as const,
            tool: 'run_command',
            params: { command: `npm install ${missingDeps.join(' ')}` },
            dependencies: [],
            validation: [],
            status: 'failed' as const,
          } as ExecutionStep,
          error: `Missing npm dependencies: ${missingDeps.join(', ')}`,
        });
      }

      const hasTsConfig = executionContext.collectedContext.files.has('tsconfig.json');
      if (hasTsConfig) {
        deps.emitStatus(`TypeScript 检查：${phase}`, '运行类型检查');
        deps.debugLog('[Agent] Running TypeScript type check...');
        const typeErrors = await runTypeCheck(
          deps.phaseCheckDeps,
          task.context?.workingDirectory || process.cwd(),
        );
        if (typeErrors.length > 0) {
          deps.debugLog(`[Agent] TypeScript check found ${typeErrors.length} errors`);
          for (const error of typeErrors.slice(0, 10)) {
            deps.contextManager.addErrorFact(task.id, 'type-check', 'typescript', error.message);
          }

          const tsErrorOutput = typeErrors.map((e) => e.message).join('\n');
          errors.push({
            step: {
              stepId: 'typescript-type-check',
              description: 'TypeScript 类型检查',
              action: 'run_command' as const,
              tool: 'run_command',
              params: { command: 'npx tsc --noEmit' },
              dependencies: [],
              validation: [],
              status: 'failed' as const,
              phase,
            } as ExecutionStep,
            error: `TypeScript compilation failed with ${typeErrors.length} error(s):\n${tsErrorOutput}`,
          });
        } else {
          deps.debugLog('[Agent] ✅ TypeScript check passed');
        }
      }

      deps.emitStatus(`代码质量检查：${phase}`, 'SubAgent 代码质量评估');
      const qualityIssues = await evaluateGeneratedCodeQualityViaSubAgent(
        deps.phaseCheckDeps,
        task.id,
        phase,
        executionPlan.steps,
        executionContext.collectedContext.files,
      );
      if (qualityIssues.length > 0) {
        const errorCount = qualityIssues.filter((issue) => issue.severity === 'error').length;
        const warningCount = qualityIssues.filter((issue) => issue.severity === 'warning').length;
        deps.debugLog(
          `[Agent] CodeQualitySubAgent found ${errorCount} error(s), ${warningCount} warning(s)`,
        );

        const failOnWarnings = deps.subAgentConfig?.codeQualityEvaluator?.failOnWarnings ?? false;
        const blockingIssues = qualityIssues.filter(
          (issue: CodeQualityIssue) =>
            issue.severity === 'error' || (failOnWarnings && issue.severity === 'warning'),
        );

        if (blockingIssues.length > 0) {
          const issueText = blockingIssues
            .slice(0, 10)
            .map((issue: CodeQualityIssue) => {
              const lineText = issue.line ? `:${issue.line}` : '';
              return `- ${issue.filePath}${lineText} [${issue.rule}] ${issue.message}`;
            })
            .join('\n');

          errors.push({
            step: {
              stepId: generateId('code-quality-review'),
              description: 'SubAgent 代码质量评估',
              action: 'run_command' as const,
              tool: 'run_command',
              params: { command: 'subagent:code-quality-review' },
              dependencies: [],
              validation: [],
              status: 'failed' as const,
              phase,
            } as ExecutionStep,
            error: `Code quality review found ${blockingIssues.length} blocking issue(s):\n${issueText}`,
          });
        }
      }
    }

    deps.emit({ type: 'phase_completed', phase, successCount, failureCount });
    return errors;
  };
}
