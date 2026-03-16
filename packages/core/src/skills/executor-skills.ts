import type { AgentTask, ExecutionStep } from '@frontagent/shared';
import type { LLMService } from '../llm.js';

type ExecutorContextFiles = { files: Map<string, string> };

export interface ExecutorStepContextSnapshot {
  task: AgentTask;
  collectedContext: ExecutorContextFiles;
}

export interface ExecutorSkillRuntime {
  llmService: LLMService;
  debug?: boolean;
  getCreatedModules?: () => string[];
  getSddConstraints?: () => string | undefined;
  buildContextString: (collectedContext: ExecutorContextFiles) => string;
  detectLanguage: (path: string) => 'typescript' | 'javascript' | 'json' | 'yaml' | null;
}

export interface ExecutorActionSkill {
  name: string;
  action: ExecutionStep['action'];
  requiredParams?: string[];
  validateParams?: (input: {
    step: ExecutionStep;
    params: Record<string, unknown>;
  }) => { valid: boolean; reason?: string } | null;
  prepareToolParams?: (input: {
    step: ExecutionStep;
    params: Record<string, unknown>;
    context: ExecutorStepContextSnapshot;
  }) => Promise<Record<string, unknown>>;
  shouldSkipToolError?: (input: {
    errorMsg: string;
    step: ExecutionStep;
    params: Record<string, unknown>;
  }) => boolean | undefined;
}

export interface ExecutorSkillsLayerSnapshot {
  actionSkills: string[];
  byAction: Record<string, string>;
}

export class ExecutorSkillRegistry {
  private readonly actionSkills: ExecutorActionSkill[] = [];

  constructor(skills?: ExecutorActionSkill[]) {
    if (skills) {
      this.actionSkills.push(...skills);
    }
  }

  registerActionSkill(skill: ExecutorActionSkill): void {
    this.actionSkills.push(skill);
  }

  private resolveActionSkill(action: ExecutionStep['action']): ExecutorActionSkill | undefined {
    for (let i = this.actionSkills.length - 1; i >= 0; i--) {
      const skill = this.actionSkills[i];
      if (skill.action === action) {
        return skill;
      }
    }
    return undefined;
  }

  resolveRequiredParams(action: ExecutionStep['action']): string[] {
    return this.resolveActionSkill(action)?.requiredParams ?? [];
  }

  validateStepParams(
    step: ExecutionStep,
    params: Record<string, unknown>,
  ): { valid: boolean; reason?: string } | null {
    const skill = this.resolveActionSkill(step.action);
    if (!skill?.validateParams) {
      return null;
    }
    return skill.validateParams({ step, params });
  }

  async prepareToolParams(input: {
    step: ExecutionStep;
    params: Record<string, unknown>;
    context: ExecutorStepContextSnapshot;
  }): Promise<Record<string, unknown>> {
    const skill = this.resolveActionSkill(input.step.action);
    if (!skill?.prepareToolParams) {
      return input.params;
    }
    return skill.prepareToolParams(input);
  }

  shouldSkipToolError(input: {
    errorMsg: string;
    step: ExecutionStep;
    params: Record<string, unknown>;
  }): boolean | undefined {
    const skill = this.resolveActionSkill(input.step.action);
    if (!skill?.shouldSkipToolError) {
      return undefined;
    }
    return skill.shouldSkipToolError(input);
  }

  snapshot(): ExecutorSkillsLayerSnapshot {
    const byAction: Record<string, string> = {};
    const actionSkills = this.actionSkills.map((skill) => skill.name);

    for (const skill of this.actionSkills) {
      byAction[skill.action] = skill.name;
    }

    return { actionSkills, byAction };
  }
}

function createCreateFileSkill(runtime: ExecutorSkillRuntime): ExecutorActionSkill {
  return {
    name: 'action.create-file.codegen',
    action: 'create_file',
    requiredParams: ['path'],
    prepareToolParams: async ({ step, params, context }) => {
      const stepAny = step as { needsCodeGeneration?: boolean };
      const shouldGenerateCode = Boolean(stepAny.needsCodeGeneration || !params.content);
      if (!shouldGenerateCode) {
        return params;
      }

      const filePath = params.path as string;
      const language = runtime.detectLanguage(filePath);
      const codeDescription = (params.codeDescription as string) || step.description;
      const contextStr = runtime.buildContextString(context.collectedContext);

      const existingModules =
        runtime.getCreatedModules?.() ??
        Array.from(context.collectedContext.files.keys()).filter((path) => /\.(tsx?|jsx?|mjs|cjs)$/.test(path));

      if (runtime.debug) {
        console.log(`[Executor] [Skill:create_file] Generating code for new file: ${filePath}`);
        console.log(`[Executor] [Skill:create_file] Existing modules: ${existingModules.length}`);
      }

      const code = await runtime.llmService.generateCodeForFile({
        task: context.task.description,
        filePath,
        codeDescription,
        context: contextStr,
        language: language || 'typescript',
        existingModules,
        sddConstraints: runtime.getSddConstraints?.(),
      });

      if (runtime.debug) {
        console.log(`[Executor] [Skill:create_file] Generated code length: ${code.length} chars`);
      }

      return {
        ...params,
        content: code,
      };
    },
  };
}

function createApplyPatchSkill(runtime: ExecutorSkillRuntime): ExecutorActionSkill {
  return {
    name: 'action.apply-patch.codegen',
    action: 'apply_patch',
    requiredParams: ['path'],
    prepareToolParams: async ({ step, params, context }) => {
      const stepAny = step as { needsCodeGeneration?: boolean };
      const shouldGenerateCode = Boolean(stepAny.needsCodeGeneration || !params.patches);
      if (!shouldGenerateCode) {
        return params;
      }

      const filePath = params.path as string;
      const language = runtime.detectLanguage(filePath);
      const changeDescription = (params.changeDescription as string) || step.description;
      const originalCode = context.collectedContext.files.get(filePath) || '';

      if (!originalCode) {
        throw new Error(`Cannot apply patch: file not found in context: ${filePath}`);
      }

      if (runtime.debug) {
        console.log(`[Executor] [Skill:apply_patch] Generating modified code for: ${filePath}`);
      }

      const modifiedCode = await runtime.llmService.generateModifiedCode({
        originalCode,
        changeDescription,
        filePath,
        language: language || 'typescript',
      });

      if (runtime.debug) {
        console.log(
          `[Executor] [Skill:apply_patch] Generated modified code length: ${modifiedCode.length} chars`,
        );
      }

      const originalLines = originalCode.split('\n').length;
      const patch = {
        operation: 'replace' as const,
        startLine: 1,
        endLine: originalLines,
        content: modifiedCode,
      };

      return {
        ...params,
        patches: [patch],
      };
    },
    shouldSkipToolError: ({ errorMsg }) => {
      if (errorMsg.includes('file not found in context') || errorMsg.includes('Cannot apply patch')) {
        return true;
      }
      return undefined;
    },
  };
}

function createRunCommandSkill(runtime: ExecutorSkillRuntime): ExecutorActionSkill {
  return {
    name: 'action.run-command.error-policy',
    action: 'run_command',
    requiredParams: ['command'],
    shouldSkipToolError: ({ errorMsg, params }) => {
      const command = typeof params.command === 'string' ? params.command.toLowerCase() : '';
      const criticalCommandPatterns = [
        'npm install',
        'pnpm install',
        'yarn install',
        'yarn add',
        'npm run build',
        'pnpm build',
        'yarn build',
        'npm run typecheck',
        'tsc',
        'tsc --noEmit',
        'npm run dev',
        'pnpm dev',
        'yarn dev',
        'npm run start',
        'pnpm start',
      ];

      const isCriticalCommand = criticalCommandPatterns.some((pattern) =>
        command.includes(pattern.toLowerCase()),
      );

      if (isCriticalCommand) {
        if (runtime.debug) {
          console.log(`[Executor] [Skill:run_command] Critical command failed: ${command}`);
        }
        return false;
      }

      if (errorMsg.includes('already exists') || errorMsg.includes('File exists')) {
        return true;
      }

      return false;
    },
  };
}

function createDefaultActionSkills(runtime: ExecutorSkillRuntime): ExecutorActionSkill[] {
  return [
    {
      name: 'action.read-file',
      action: 'read_file',
      requiredParams: ['path'],
      shouldSkipToolError: ({ errorMsg }) => {
        if (
          errorMsg.includes('File not found') ||
          errorMsg.includes('does not exist') ||
          errorMsg.includes('文件不存在')
        ) {
          return true;
        }
        return undefined;
      },
    },
    {
      name: 'action.list-directory',
      action: 'list_directory',
      requiredParams: ['path'],
      shouldSkipToolError: ({ errorMsg }) => {
        if (errorMsg.includes('Directory not found') || errorMsg.includes('目录不存在')) {
          return true;
        }
        return undefined;
      },
    },
    createCreateFileSkill(runtime),
    createApplyPatchSkill(runtime),
    {
      name: 'action.search-code',
      action: 'search_code',
      validateParams: ({ params }) => {
        const query = typeof params.query === 'string' ? params.query.trim() : '';
        const pattern = typeof params.pattern === 'string' ? params.pattern.trim() : '';
        if (!query && !pattern) {
          return {
            valid: false,
            reason: 'search_code requires non-empty query or pattern parameter',
          };
        }
        return { valid: true };
      },
    },
    {
      name: 'action.get-ast',
      action: 'get_ast',
      requiredParams: ['path'],
      shouldSkipToolError: ({ errorMsg }) => {
        if (
          errorMsg.includes('File not found') ||
          errorMsg.includes('does not exist') ||
          errorMsg.includes('Not a file')
        ) {
          return true;
        }
        return undefined;
      },
    },
    createRunCommandSkill(runtime),
    {
      name: 'action.browser-navigate',
      action: 'browser_navigate',
      requiredParams: ['url'],
    },
    {
      name: 'action.browser-click',
      action: 'browser_click',
      requiredParams: ['selector'],
    },
    {
      name: 'action.browser-type',
      action: 'browser_type',
      requiredParams: ['selector'],
    },
    {
      name: 'action.browser-screenshot',
      action: 'browser_screenshot',
    },
    {
      name: 'action.get-page-structure',
      action: 'get_page_structure',
    },
    {
      name: 'action.write-file',
      action: 'write_file',
      requiredParams: ['path'],
    },
    {
      name: 'action.delete-file',
      action: 'delete_file',
      requiredParams: ['path'],
    },
  ];
}

export function createDefaultExecutorSkillRegistry(
  runtime: ExecutorSkillRuntime,
): ExecutorSkillRegistry {
  return new ExecutorSkillRegistry(createDefaultActionSkills(runtime));
}
