import { z } from 'zod';

const ACTION_ENUM = [
  'read_file',
  'list_directory',
  'create_file',
  'apply_patch',
  'search_code',
  'get_ast',
  'run_command',
  'browser_navigate',
  'get_page_structure',
  'browser_click',
  'browser_type',
  'browser_screenshot',
  'web_fetch',
] as const;

const STEP_PARAMS_SCHEMA = z
  .object({
    path: z.string().describe('文件或目录路径（不适用时填空字符串）'),
    recursive: z.boolean().describe('是否递归列出子目录，不适用时填false'),
    query: z.string().describe('文本搜索查询（不适用时填空字符串）'),
    pattern: z.string().describe('搜索模式（不适用时填空字符串）'),
    filePattern: z.string().describe('文件 glob 模式（不适用时填空字符串）'),
    globOnly: z.boolean().describe('是否仅执行 glob 文件发现，不适用时填false'),
    maxResults: z.number().describe('最大返回结果数，不适用时填0'),
    directory: z.string().describe('搜索目录（不适用时填空字符串）'),
    command: z.string().describe('要执行的终端命令（不适用时填空字符串）'),
    url: z.string().describe('URL（不适用时填空字符串）'),
    selector: z.string().describe('CSS选择器（不适用时填空字符串）'),
    text: z.string().describe('输入文本（不适用时填空字符串）'),
    fullPage: z.boolean().describe('是否全页截图，不适用时填false'),
    codeDescription: z.string().describe('要生成的代码的描述（不适用时填空字符串）'),
    changeDescription: z.string().describe('要做的修改描述（不适用时填空字符串）'),
  })
  .describe('工具参数 - 所有字段必填，不适用的字符串填空字符串，布尔值填false，数字填0');

export const PlanOutlineSchema = z.object({
  summary: z.string().describe('计划的简要描述'),
  stepOutlines: z
    .array(
      z.object({
        description: z.string().describe('步骤简要描述'),
        action: z.enum(ACTION_ENUM).describe('执行动作类型'),
        phase: z
          .string()
          .describe(
            '所属阶段名称（如：阶段1-分析、阶段2-创建、阶段3-安装、阶段4-验证、阶段7-仓库管理）',
          ),
      }),
    )
    .describe('步骤概要列表 - 只需简单描述每个步骤要做什么'),
  risks: z.array(z.string()).describe('潜在风险（可为空数组）'),
  alternatives: z.array(z.string()).describe('备选方案（可为空数组）'),
});

export type PlanOutline = z.infer<typeof PlanOutlineSchema>;

export const StepExpansionSchema = z.object({
  steps: z
    .array(
      z.object({
        description: z.string().describe('步骤描述 - 说明要做什么'),
        action: z.enum(ACTION_ENUM).describe('执行动作'),
        tool: z.string().describe('要调用的工具'),
        phase: z.string().describe('所属阶段名称（与Phase 1中的阶段名称保持一致）'),
        params: STEP_PARAMS_SCHEMA,
        reasoning: z.string().describe('为什么需要这个步骤'),
        needsCodeGeneration: z.boolean().describe('此步骤是否需要在执行时生成代码，默认false'),
      }),
    )
    .describe('展开后的详细步骤列表'),
});

export const GeneratedPlanSchema = z.object({
  summary: z.string().describe('计划的简要描述'),
  steps: z
    .array(
      z.object({
        description: z.string().describe('步骤描述 - 说明要做什么'),
        action: z.enum(ACTION_ENUM).describe('执行动作'),
        tool: z.string().describe('要调用的工具'),
        phase: z
          .string()
          .describe(
            '所属阶段名称（如：阶段1-分析、阶段2-创建、阶段3-安装、阶段4-验证、阶段7-仓库管理）',
          ),
        params: STEP_PARAMS_SCHEMA,
        reasoning: z.string().describe('为什么需要这个步骤'),
        needsCodeGeneration: z.boolean().describe('此步骤是否需要在执行时生成代码，默认false'),
      }),
    )
    .describe('执行步骤列表'),
  risks: z.array(z.string()).describe('潜在风险（可为空数组）'),
  alternatives: z.array(z.string()).describe('备选方案（可为空数组）'),
});

export type GeneratedPlan = z.infer<typeof GeneratedPlanSchema>;

export const ErrorRecoveryPlanSchema = z.object({
  canRecover: z.boolean().describe('是否可以通过生成修复步骤来解决问题'),
  analysis: z.string().describe('错误分析：为什么会出现这些错误'),
  recoverySteps: z
    .array(
      z.object({
        description: z.string().describe('修复步骤描述'),
        action: z.enum(ACTION_ENUM).describe('修复动作'),
        tool: z.string().describe('工具名称'),
        phase: z.string().describe('所属阶段'),
        params: z
          .object({
            path: z.string().describe('文件或目录路径（不适用时填空字符串）'),
            recursive: z.boolean().describe('是否递归列出子目录，不适用时填false'),
            pattern: z.string().describe('搜索模式（不适用时填空字符串）'),
            directory: z.string().describe('搜索目录（不适用时填空字符串）'),
            command: z.string().describe('要执行的终端命令（不适用时填空字符串）'),
            url: z.string().describe('URL（不适用时填空字符串）'),
            selector: z.string().describe('CSS选择器（不适用时填空字符串）'),
            text: z.string().describe('输入文本（不适用时填空字符串）'),
            fullPage: z.boolean().describe('是否全页截图，不适用时填false'),
            codeDescription: z.string().describe('要生成的代码的描述（不适用时填空字符串）'),
            changeDescription: z.string().describe('要做的修改描述（不适用时填空字符串）'),
          })
          .describe('工具参数'),
        reasoning: z.string().describe('为什么需要这个修复步骤'),
        needsCodeGeneration: z.boolean().describe('此步骤是否需要代码生成'),
      }),
    )
    .describe('修复步骤列表'),
  recommendation: z.string().describe('给用户的建议'),
});

export type ErrorRecoveryPlan = z.infer<typeof ErrorRecoveryPlanSchema>;

export const GeneratedCodeSchema = z.object({
  code: z.string().describe('生成的代码'),
  language: z.string().describe('编程语言'),
  explanation: z.string().describe('代码说明'),
});

export type GeneratedCode = z.infer<typeof GeneratedCodeSchema>;

export const GeneratedPatchSchema = z.object({
  originalCode: z.string().describe('原始代码片段'),
  modifiedCode: z.string().describe('修改后的代码片段'),
  explanation: z.string().describe('修改说明'),
  startLine: z.number().optional().describe('修改起始行号'),
  endLine: z.number().optional().describe('修改结束行号'),
});

export type GeneratedPatch = z.infer<typeof GeneratedPatchSchema>;
