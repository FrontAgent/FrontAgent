import type { z } from 'zod';
import type { Message } from '../types.js';
import {
  CODE_MINIMALISM_DISCIPLINE,
  EXTERNAL_KNOWLEDGE_PROTOCOL,
  SECURITY_DISCIPLINE,
} from './prompts.js';
import type { ErrorRecoveryPlan } from './schemas.js';
import { ErrorRecoveryPlanSchema } from './schemas.js';

export interface CodeGenerationDeps {
  debugLog: (...args: unknown[]) => void;
  debugWarn: (...args: unknown[]) => void;
  debugError: (...args: unknown[]) => void;
  generateText: (options: {
    messages: Message[];
    system?: string;
    temperature?: number;
  }) => Promise<string>;
  generateObject: <T>(options: {
    messages: Message[];
    system?: string;
    schema: z.ZodType<T>;
    temperature?: number;
    maxTokens?: number;
  }) => Promise<T>;
}

function cleanGeneratedCode(code: string): string {
  let cleaned = code;

  cleaned = cleaned.replace(/^```[\w]*\n/m, '').replace(/\n```$/m, '');
  cleaned = cleaned.replace(/\[TOOL_CALL\][\s\S]*?\[\/TOOL_CALL\]/g, '');

  const lines = cleaned.split('\n');
  let codeStartIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (
      line.startsWith('import ') ||
      line.startsWith('export ') ||
      line.startsWith('const ') ||
      line.startsWith('let ') ||
      line.startsWith('var ') ||
      line.startsWith('function ') ||
      line.startsWith('class ') ||
      line.startsWith('interface ') ||
      line.startsWith('type ') ||
      line.startsWith('//') ||
      line.startsWith('/*') ||
      line.startsWith('{') ||
      line.startsWith('<')
    ) {
      codeStartIndex = i;
      break;
    }
  }

  cleaned = lines.slice(codeStartIndex).join('\n');
  return cleaned.trim();
}

export async function generateCodeForFile(
  options: {
    task: string;
    filePath: string;
    codeDescription: string;
    context: string;
    existingCode?: string;
    language: string;
    existingModules?: string[];
    sddConstraints?: string;
    skillContext?: string;
  },
  deps: CodeGenerationDeps,
): Promise<string> {
  const existingModulesInfo = options.existingModules?.length
    ? `\n# 可用模块\n以下模块已创建，可以导入使用：\n${options.existingModules.map((m) => `- ${m}`).join('\n')}\n\n外部 npm 包（react、tailwindcss 等）可以正常使用。未列出的内部模块不存在，如需相关功能请在当前文件中实现。`
    : '';

  const sddConstraintsInfo = options.sddConstraints
    ? `\n# 项目约束\n${options.sddConstraints}\n`
    : '';
  const skillContextInfo = options.skillContext ? `\n# 内容技能\n${options.skillContext}\n` : '';

  const system = `你是一位经验丰富的软件工程师。直接输出代码，不要任何解释或 markdown 标记。

# 任务
- 文件: ${options.filePath}
- 语言: ${options.language}
- 要求: ${options.codeDescription}
${existingModulesInfo}
${sddConstraintsInfo}
${skillContextInfo}
${
  options.filePath.match(/\.(json|config\.(js|ts|mjs))$/)
    ? `
# 配置文件格式
直接输出标准格式，如：
- tsconfig.json: { "compilerOptions": {...}, "include": [...] }
- package.json: { "name": "...", "dependencies": {...} }（建议包含 "typecheck" 脚本）
- vite.config.ts: export default defineConfig({...})
`
    : ''
}
# 代码质量
- 遵循最佳实践
- 代码清晰可维护
- 使用 TypeScript 类型
- 按 codeDescription 要求实现

${EXTERNAL_KNOWLEDGE_PROTOCOL}

${SECURITY_DISCIPLINE}

${CODE_MINIMALISM_DISCIPLINE}`;

  const messages: Message[] = [
    {
      role: 'user',
      content: `${options.context ? `上下文:\n${options.context}\n\n` : ''}${options.existingCode ? `现有代码:\n${options.existingCode}\n\n` : ''}请生成代码。`,
    },
  ];

  const code = await deps.generateText({ messages, system, temperature: 0.2 });
  return cleanGeneratedCode(code);
}

export async function analyzeCode(
  options: {
    code: string;
    language: string;
    question: string;
  },
  deps: CodeGenerationDeps,
): Promise<string> {
  const messages: Message[] = [
    {
      role: 'user',
      content: `请分析以下 ${options.language} 代码:

\`\`\`${options.language}
${options.code}
\`\`\`

问题: ${options.question}`,
    },
  ];

  return deps.generateText({
    messages,
    system: '你是一个专业的代码分析助手，擅长分析和解释代码。',
    temperature: 0.3,
  });
}

export async function generateModifiedCode(
  options: {
    originalCode: string;
    changeDescription: string;
    filePath: string;
    language: string;
    skillContext?: string;
  },
  deps: CodeGenerationDeps,
): Promise<string> {
  const system = `你是一位经验丰富的软件工程师。直接输出修改后的完整代码，不要任何解释或 markdown 标记。

# 任务
- 文件: ${options.filePath}
- 语言: ${options.language}
- 修改要求: ${options.changeDescription}
${options.skillContext ? `\n# 内容技能\n${options.skillContext}` : ''}

# 要求
- 只修改必要部分
- 保持原有代码风格
- 确保语法正确
- 保留未修改的代码

${EXTERNAL_KNOWLEDGE_PROTOCOL}

${SECURITY_DISCIPLINE}

${CODE_MINIMALISM_DISCIPLINE}`;

  const messages: Message[] = [
    {
      role: 'user',
      content: `原始代码:\n${options.originalCode}\n\n请按要求修改并输出完整代码。`,
    },
  ];

  const code = await deps.generateText({ messages, system, temperature: 0.2 });
  return cleanGeneratedCode(code);
}

export function parseTypeScriptErrors(
  failedSteps: Array<{ error: string; params: Record<string, unknown> }>,
): Array<{
  file: string;
  line: number;
  column: number;
  errorCode: string;
  message: string;
  rawError: string;
}> {
  const tsErrors: Array<{
    file: string;
    line: number;
    column: number;
    errorCode: string;
    message: string;
    rawError: string;
  }> = [];

  for (const step of failedSteps) {
    const isTscCommand =
      step.params.command?.toString().includes('tsc') ||
      step.params.command?.toString().includes('typecheck');

    if (!isTscCommand) continue;

    const tsErrorRegex = /([^\s:]+\.tsx?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)/g;
    let match;

    while ((match = tsErrorRegex.exec(step.error)) !== null) {
      tsErrors.push({
        file: match[1],
        line: Number.parseInt(match[2], 10),
        column: Number.parseInt(match[3], 10),
        errorCode: match[4],
        message: match[5],
        rawError: match[0],
      });
    }

    const altFormatRegex = /([^\s:]+\.tsx?):(\d+):(\d+)\s+-\s+error\s+(TS\d+):\s+(.+)/g;

    while ((match = altFormatRegex.exec(step.error)) !== null) {
      tsErrors.push({
        file: match[1],
        line: Number.parseInt(match[2], 10),
        column: Number.parseInt(match[3], 10),
        errorCode: match[4],
        message: match[5],
        rawError: match[0],
      });
    }
  }

  return tsErrors;
}

export async function analyzeErrorsAndGenerateRecovery(
  options: {
    task: string;
    phase: string;
    failedSteps: Array<{
      description: string;
      action: string;
      params: Record<string, unknown>;
      error: string;
    }>;
    context: string;
  },
  deps: CodeGenerationDeps,
): Promise<ErrorRecoveryPlan> {
  const tsErrors = parseTypeScriptErrors(options.failedSteps);
  const hasTsErrors = tsErrors.length > 0;

  if (hasTsErrors) {
    deps.debugLog('[LLMService] ========================================');
    deps.debugLog(`[LLMService] Detected ${tsErrors.length} TypeScript errors`);
    deps.debugLog('[LLMService] ========================================');
    for (const err of tsErrors) {
      deps.debugLog(
        `[LLMService] ${err.file}:${err.line}:${err.column} - ${err.errorCode}: ${err.message}`,
      );
    }
    deps.debugLog('[LLMService] Generating intelligent fix steps...');
    deps.debugLog('[LLMService] ========================================');
  }

  const system = `你是一个专业的错误诊断和恢复规划专家。你的任务是分析工具执行过程中的错误，并生成修复步骤。

# 你的职责
1. 分析为什么这些步骤会失败
2. 判断是否可以通过生成新的步骤来修复问题
3. 如果可以修复，生成详细的修复步骤
4. 提供避免类似错误的建议

# 常见错误类型及修复策略

## 1. "Cannot apply patch: file not found in context"
**原因**: apply_patch 需要修改的文件没有被读取到 context 中
**修复**: 在 apply_patch 之前添加 read_file 步骤读取该文件

## 2. "File already exists"
**原因**: create_file 尝试创建已存在的文件
**修复**:
- 如果需要修改，改用 apply_patch
- 如果需要覆盖，添加 overwrite: true 参数
- 如果不需要创建，跳过该步骤

## 3. "Directory not found" / "File not found"
**原因**: 文件或目录不存在
**修复**:
- 先使用 list_directory 确认目录结构
- 如果需要创建目录，使用 run_command: mkdir -p
- 调整文件路径到正确位置

## 4. "MODULE_NOT_FOUND" / "Command failed"
**原因**: 依赖未安装或命令不存在
**修复**:
- 先检查 package.json
- 执行 npm install 或 pnpm install
- 确认命令路径正确

## 5. TypeScript 类型错误 🔥 重点关注 🔥
**识别**: 错误信息包含 "TS" 错误代码（如 TS2304, TS2345）或来自 tsc/npx tsc 命令

### TypeScript 错误修复流程
1. **先读取文件**: 对于每个需要修改的文件，先生成 read_file 步骤
2. **生成补丁**: 使用 apply_patch 并在 changeDescription 中精确描述要做的修改
3. **验证修复**: 生成 run_command 步骤执行 "npx tsc --noEmit" 验证类型错误是否解决
4. **设置 needsCodeGeneration**: 对于 apply_patch 步骤，必须设置 needsCodeGeneration: true

# 修复步骤生成原则
1. **最小修复**: 只生成必要的修复步骤，不重复原有成功的步骤
2. **保持阶段**: 修复步骤的 phase 字段应与原失败步骤的 phase 保持一致
3. **顺序正确**: 确保修复步骤的依赖关系正确（如先 read_file 再 apply_patch）
4. **完整参数**: 确保所有必需参数都已填充，path 必须包含文件扩展名
5. **实际修复**: 对于 TypeScript 错误，必须生成实际的代码修复步骤（apply_patch），而不是仅仅查看错误

# 输出要求
- canRecover: 如果错误可以通过生成步骤修复则为 true，否则为 false
- analysis: 清晰说明错误原因
- recoverySteps: 修复步骤数组（按执行顺序排列）
- recommendation: 给出建议`;

  const errorSummary = options.failedSteps
    .map(
      (step, idx) =>
        `${idx + 1}. [${step.action}] ${step.description}
   参数: ${JSON.stringify(step.params, null, 2)}
   错误: ${step.error}`,
    )
    .join('\n\n');

  let tsErrorDetails = '';
  if (hasTsErrors && tsErrors.length > 0) {
    tsErrorDetails = `\n\n🔥 检测到 ${tsErrors.length} 个 TypeScript 编译错误 🔥\n`;
    tsErrorDetails += '请为这些错误生成实际的代码修复步骤（apply_patch），而不是仅仅查看错误。\n\n';

    const errorsByFile = new Map<string, typeof tsErrors>();
    for (const error of tsErrors) {
      if (!errorsByFile.has(error.file)) {
        errorsByFile.set(error.file, []);
      }
      errorsByFile.get(error.file)!.push(error);
    }

    for (const [file, errors] of errorsByFile) {
      tsErrorDetails += `文件: ${file}\n`;
      for (const error of errors) {
        tsErrorDetails += `  行 ${error.line}:${error.column} - ${error.errorCode}: ${error.message}\n`;
      }
      tsErrorDetails += '\n';
    }

    tsErrorDetails += '修复步骤要求:\n';
    tsErrorDetails += '1. 对于每个需要修改的文件，先生成 read_file 步骤读取文件内容\n';
    tsErrorDetails += '2. 然后生成 apply_patch 步骤，在 changeDescription 中详细描述要做的修改\n';
    tsErrorDetails += '3. 对于 apply_patch 步骤，必须设置 needsCodeGeneration: true\n';
    tsErrorDetails += '4. 最后生成 run_command 步骤执行 "npx tsc --noEmit" 验证修复是否成功\n';
  }

  const messages: Message[] = [
    {
      role: 'user',
      content: `任务: ${options.task}
当前阶段: ${options.phase}

执行上下文:
${options.context}

以下步骤执行失败:
${errorSummary}${tsErrorDetails}

请分析这些错误并生成修复计划。`,
    },
  ];

  return deps.generateObject({
    messages,
    system,
    schema: ErrorRecoveryPlanSchema,
    temperature: 0.3,
    maxTokens: 8192,
  });
}
