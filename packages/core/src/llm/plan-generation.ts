import type { z } from 'zod';
import type { Message } from '../types.js';
import { PROGRESSIVE_EXPLORATION_PROTOCOL } from './prompts.js';
import type { GeneratedPlan } from './schemas.js';
import { GeneratedPlanSchema, PlanOutlineSchema, StepExpansionSchema } from './schemas.js';

export interface PlanGenerationDeps {
  debugLog: (...args: unknown[]) => void;
  debugWarn: (...args: unknown[]) => void;
  debugError: (...args: unknown[]) => void;
  generateObject: <T>(options: {
    messages: Message[];
    system?: string;
    schema: z.ZodType<T>;
    temperature?: number;
    maxTokens?: number;
  }) => Promise<T>;
}

export function normalizePlan(
  rawPlan: Record<string, unknown>,
  deps: PlanGenerationDeps,
): GeneratedPlan {
  const summary = typeof rawPlan.summary === 'string' ? rawPlan.summary : 'Generated Plan';

  let steps: Record<string, unknown>[] = Array.isArray(rawPlan.steps) ? rawPlan.steps : [];

  if (typeof rawPlan.steps === 'string') {
    deps.debugWarn('[LLM] Warning: steps is a string, expected array. Creating default step.');
    steps = [];
  }

  steps = steps.map((step: Record<string, unknown>, index: number) => {
    let params = step.params;
    if (typeof params === 'string') {
      deps.debugWarn(
        `[LLM] Warning: step[${index}].params is a string, expected object. Converting.`,
      );
      try {
        params = JSON.parse(params);
      } catch {
        params = { value: params };
      }
    } else if (!params || typeof params !== 'object') {
      params = {};
    }

    let needsCodeGeneration = step.needsCodeGeneration;
    if (typeof needsCodeGeneration === 'string') {
      needsCodeGeneration = needsCodeGeneration.toLowerCase() === 'true';
    } else if (typeof needsCodeGeneration !== 'boolean') {
      needsCodeGeneration = undefined;
    }

    return { ...step, params, needsCodeGeneration };
  });

  let risks = rawPlan.risks;
  if (typeof risks === 'string') {
    deps.debugWarn('[LLM] Warning: risks is a string, expected array. Converting to array.');
    risks = [risks];
  } else if (!Array.isArray(risks)) {
    risks = [];
  }

  let alternatives = rawPlan.alternatives;
  if (typeof alternatives === 'string') {
    deps.debugWarn('[LLM] Warning: alternatives is a string, expected array. Converting to array.');
    alternatives = [alternatives];
  } else if (!Array.isArray(alternatives)) {
    alternatives = [];
  }

  return {
    summary,
    steps: steps as GeneratedPlan['steps'],
    risks: risks as string[],
    alternatives: alternatives as string[],
  };
}

export async function generatePlanInTwoPhases(
  options: {
    task: string;
    context: string;
    sddConstraints?: string;
    skillContext?: string;
  },
  deps: PlanGenerationDeps,
): Promise<GeneratedPlan> {
  deps.debugLog('[LLMService] Using two-phase plan generation...');

  // Phase 1: 生成计划大纲
  const outlineSystem = `你是一位经验丰富的高级软件工程师，拥有跨多种编程语言和框架的专家级知识。你擅长分析复杂任务并制定清晰、可执行的计划。

# 你的工作方式

## 思考流程
当收到任务时，你会按照以下流程思考：

1. **深度理解问题** - 仔细阅读任务描述，理解用户真正想要实现什么
2. **分析上下文** - 根据提供的项目信息，了解技术栈、现有代码结构
3. **制定计划** - 将任务拆分为清晰的、可验证的步骤
4. **考虑风险** - 识别可能的问题和备选方案

## 计划结构
你的计划应该按阶段组织，每个阶段有明确的目标：
- **阶段1-分析**: 了解项目现状（list_directory, read_file）
- **阶段2-创建**: 创建或修改文件（create_file, apply_patch）
- **阶段3-安装**: 安装依赖（run_command: npm/pnpm install）
- **阶段4-验证**: 类型检查、构建验证（run_command: tsc --noEmit, npm run build）
- **阶段5-启动**: 启动开发服务器（run_command: npm run dev）
- **阶段6-浏览器验证**: 验证应用运行（browser_navigate 使用上下文中提供的端口, browser_screenshot）
- **阶段7-仓库管理**: 在验收通过后执行仓库自动化（run_command: git/gh，如 commit/push/pr create）

根据任务类型选择需要的阶段：
- 分析类任务：只需阶段1
- 修改类任务：阶段1 → 阶段2 → 阶段4
- 创建类任务：完整的阶段1-6，若有代码变更且验收通过则追加阶段7

# 可用工具
- **read_file**: 读取文件内容
- **list_directory**: 列出目录结构
- **create_file**: 创建新文件（需要设置 needsCodeGeneration: true）
- **apply_patch**: 修改现有文件（需要设置 needsCodeGeneration: true）
- **run_command**: 执行终端命令
- **search_code**: 搜索代码
- **get_ast**: 获取代码AST
- **browser_navigate**: 浏览器访问URL（⚠️ 使用上下文中提供的"开发服务器端口"）
- **browser_screenshot**: 页面截图
- **get_page_structure**: 获取页面DOM结构

${PROGRESSIVE_EXPLORATION_PROTOCOL}

# SDD 约束
${options.sddConstraints ?? '无特殊约束'}

# 内容技能
${options.skillContext ?? '无已激活内容技能'}

# 输出格式
输出一个 JSON 对象，包含：
- summary: 任务概要描述
- stepOutlines: 步骤列表，每个步骤包含 description、action、phase
- risks: 潜在风险列表
- alternatives: 备选方案列表

确保每个步骤都有明确的 phase 字段，用于分阶段执行。
如果包含阶段7-仓库管理，必须放在所有验收阶段（验证/浏览器验证）之后。`;

  const outline = await deps.generateObject({
    messages: [
      {
        role: 'user',
        content: `任务：${options.task}\n\n项目上下文：\n${options.context}\n\n🚨 关键提醒：输出的每个步骤都必须包含 phase 字段，且不同类型的步骤应归属不同阶段！`,
      },
    ],
    system: outlineSystem,
    schema: PlanOutlineSchema,
    temperature: 0.3,
    maxTokens: 8192,
  });

  deps.debugLog(
    `[LLMService] Phase 1 complete: ${outline.stepOutlines.length} step outlines generated`,
  );

  // 🔧 Phase 1 后处理：检查并修正"未分组"问题
  const ungroupedCount = outline.stepOutlines.filter(
    (s) => !s.phase || s.phase === '未分组',
  ).length;
  if (ungroupedCount > outline.stepOutlines.length * 0.5) {
    deps.debugWarn(
      `[LLMService] ⚠️  Detected ${ungroupedCount}/${outline.stepOutlines.length} steps with "未分组" or missing phase`,
    );
    deps.debugLog('[LLMService] 🔧 Auto-fixing phase assignments based on action types...');

    for (let i = 0; i < outline.stepOutlines.length; i++) {
      const step = outline.stepOutlines[i];

      if (!step.phase || step.phase === '未分组') {
        if (
          step.action === 'list_directory' ||
          step.action === 'search_code' ||
          (step.action === 'read_file' && i < 10)
        ) {
          step.phase = '阶段1-分析';
        } else if (step.action === 'create_file') {
          step.phase = '阶段2-创建';
        } else if (step.action === 'run_command') {
          if (step.description.includes('安装') || step.description.includes('install')) {
            step.phase = '阶段3-安装';
          } else if (
            step.description.includes('类型检查') ||
            step.description.includes('typecheck') ||
            step.description.includes('tsc')
          ) {
            step.phase = '阶段4-验证';
          } else if (
            step.description.includes('启动') ||
            step.description.includes('dev') ||
            step.description.includes('serve')
          ) {
            step.phase = '阶段5-启动';
          } else if (
            step.description.includes('仓库') ||
            step.description.includes('repository') ||
            step.description.includes('repo') ||
            step.description.includes('git') ||
            step.description.includes('gh') ||
            step.description.includes('pull request') ||
            step.description.includes('pr')
          ) {
            step.phase = '阶段7-仓库管理';
          } else {
            step.phase = '阶段4-验证';
          }
        } else if (
          step.action === 'browser_navigate' ||
          step.action === 'browser_screenshot' ||
          step.action === 'get_page_structure' ||
          step.action === 'browser_click' ||
          step.action === 'browser_type'
        ) {
          step.phase = '阶段6-浏览器验证';
        } else if (step.action === 'apply_patch') {
          step.phase = '阶段2-创建';
        } else {
          step.phase = '阶段1-分析';
        }

        deps.debugLog(`[LLMService]   Fixed step ${i + 1}: "${step.description}" → ${step.phase}`);
      }
    }

    deps.debugLog('[LLMService] ✅ Phase assignment auto-fix complete');
  }

  // Phase 2: 批量展开步骤详情
  const expansionSystem = `你是一位经验丰富的软件工程师，负责将计划大纲展开为详细的可执行步骤。

# 你的任务
将步骤概要展开为完整的执行步骤。每个步骤需要包含：
- description: 详细描述这个步骤做什么
- action: 动作类型（保持与概要一致）
- tool: 工具名称（通常与 action 相同）
- phase: 所属阶段（保持与概要一致）
- params: 执行参数
- reasoning: 为什么需要这个步骤
- needsCodeGeneration: 是否需要代码生成

# 参数填写指南

## 文件操作
- **create_file**: params 需要 path（完整路径含扩展名）和 codeDescription（描述要生成的代码）
- **apply_patch**: params 需要 path 和 changeDescription（描述要做的修改）
- **read_file**: params 需要 path
- **list_directory**: params 需要 path 和可选的 recursive
- **search_code**: 可用 globOnly=true + filePattern 做写入前的全局路径候选发现；内容搜索时使用 query 或 pattern

## 命令执行
- **run_command**: params 需要 command
- 安装依赖: "npm install" 或 "pnpm install"
- 类型检查: "npm run typecheck" 或 "tsc --noEmit"
- 启动服务: "nohup npm run dev > /dev/null 2>&1 & sleep 3"
- 仓库管理: "git add -A && git commit ... && git push && gh pr create ..."

## 浏览器操作
- **browser_navigate**: params 需要 url
  ⚠️ 重要：使用项目上下文中提供的"开发服务器端口"，不要猜测端口号！
  如果上下文中提供了端口信息，使用 http://localhost:{端口}/
- **browser_screenshot**: params 可选 fullPage: true
- **get_page_structure**: params 可为空对象

# 重要提示
- create_file 和 apply_patch 必须设置 needsCodeGeneration: true
- 对不确定路径执行 create_file/apply_patch 前，必须先安排 search_code globOnly 或 list_directory，再安排 run_command 精确确认目标目录/目标文件状态
- 文件路径必须包含完整扩展名（如 .ts, .tsx, .json）
- 保持 phase 字段与输入一致
- 阶段7-仓库管理必须依赖验收阶段成功（例如放在阶段4/6之后）

# SDD 约束
${options.sddConstraints ?? '无特殊约束'}

# 内容技能
${options.skillContext ?? '无已激活内容技能'}`;

  const batchSize = 10;
  const allSteps: GeneratedPlan['steps'] = [];

  for (let i = 0; i < outline.stepOutlines.length; i += batchSize) {
    const batch = outline.stepOutlines.slice(i, i + batchSize);
    const batchPrompt = `请将以下步骤概要展开为详细的可执行步骤。

🚨 重要：你必须返回一个 JSON 对象，其中 steps 字段是一个**数组**，不是字符串！

步骤概要：
${JSON.stringify(batch, null, 2)}

输出格式要求：
{
  "steps": [    <-- 这里必须是数组，不是字符串！
    { "description": "...", "action": "...", ... },
    { "description": "...", "action": "...", ... }
  ]
}

注意：
- 确保 params 包含所有必需字段
- 为 create_file 和 apply_patch 设置 needsCodeGeneration: true
- 提供清晰的 reasoning
- 保留原有的 phase 字段`;

    const expansion = await deps.generateObject({
      messages: [{ role: 'user', content: batchPrompt }],
      system: expansionSystem,
      schema: StepExpansionSchema,
      temperature: 0.3,
      maxTokens: 16384,
    });

    let steps = expansion.steps;
    if (typeof steps === 'string') {
      deps.debugWarn('[LLMService] Warning: expansion.steps is a string, parsing as JSON');
      try {
        steps = JSON.parse(steps);
      } catch (error) {
        deps.debugError('[LLMService] Failed to parse steps string:', error);
        throw new Error('Invalid steps format: expected array, got string that cannot be parsed');
      }
    }

    if (!Array.isArray(steps)) {
      throw new Error(`Invalid steps format: expected array, got ${typeof steps}`);
    }

    for (let j = 0; j < steps.length; j++) {
      const step = steps[j];
      const batchItem = batch[j];

      if (!step.phase || step.phase.trim() === '') {
        if (batchItem?.phase) {
          deps.debugWarn(`[LLMService] Restoring missing phase for step: ${batchItem.phase}`);
          step.phase = batchItem.phase;
        } else {
          deps.debugWarn('[LLMService] Both step and batch item missing phase, using default');
          step.phase = '未分组';
        }
      }
    }

    allSteps.push(...steps);
    deps.debugLog(
      `[LLMService] Phase 2 batch ${Math.floor(i / batchSize) + 1} complete: ${steps.length} steps expanded`,
    );
  }

  const finalPlan: GeneratedPlan = {
    summary: outline.summary,
    steps: allSteps,
    risks: outline.risks,
    alternatives: outline.alternatives,
  };

  deps.debugLog(`[LLMService] Two-phase generation complete: ${allSteps.length} total steps`);
  return finalPlan;
}

export async function generatePlan(
  options: {
    task: string;
    context: string;
    sddConstraints?: string;
    skillContext?: string;
  },
  deps: PlanGenerationDeps,
): Promise<GeneratedPlan> {
  try {
    return await generatePlanInTwoPhases(options, deps);
  } catch (error) {
    deps.debugWarn(
      '[LLMService] Two-phase generation failed, falling back to single-phase:',
      error,
    );
    return await generatePlanSinglePhase(options, deps);
  }
}

async function generatePlanSinglePhase(
  options: {
    task: string;
    context: string;
    sddConstraints?: string;
    skillContext?: string;
  },
  deps: PlanGenerationDeps,
): Promise<GeneratedPlan> {
  const system = `你是一位经验丰富的高级软件工程师，拥有跨多种编程语言和框架的专家级知识。

# 你的工作方式

当收到任务时，你会：
1. **深度理解问题** - 仔细阅读任务，理解用户真正想要什么
2. **分析上下文** - 了解项目技术栈和代码结构
3. **制定计划** - 将任务拆分为清晰的、可验证的步骤
4. **考虑风险** - 识别可能的问题和备选方案

# 计划结构

根据任务类型组织步骤：
- **分析类**: 使用 search_code/list_directory/read_file 了解项目
- **创建类**: Glob 候选发现 → Bash 精确确认 → 创建文件 → 安装依赖 → 类型检查 → 启动 → 浏览器验证
- **修改类**: Glob/目录观察 → 读取文件 → 修改 → 验证

# 可用工具
- **read_file**: { path: "文件路径" }
- **list_directory**: { path: "目录", recursive: true/false }
- **create_file**: { path: "完整路径含扩展名", codeDescription: "描述" }, needsCodeGeneration: true
- **apply_patch**: { path: "完整路径含扩展名", changeDescription: "描述" }, needsCodeGeneration: true
- **run_command**: { command: "命令" }
- **search_code**: { pattern: "搜索模式" } 或 { globOnly: true, filePattern: "glob模式", maxResults: 50 }
- **browser_navigate**: { url: "地址" }
- **browser_screenshot**: { fullPage: true }
- **get_page_structure**: {}

${PROGRESSIVE_EXPLORATION_PROTOCOL}

# SDD 约束
${options.sddConstraints ?? '无特殊约束'}

# 内容技能
${options.skillContext ?? '无已激活内容技能'}

# 输出格式
{
  "summary": "任务概要",
  "steps": [
    {
      "description": "步骤描述",
      "action": "动作类型",
      "tool": "工具名",
      "params": { ... },
      "reasoning": "原因",
      "needsCodeGeneration": true/false
    }
  ],
  "risks": ["风险1"],
  "alternatives": ["方案1"]
}`;

  const messages: Message[] = [
    {
      role: 'user',
      content: `任务: ${options.task}\n\n上下文:\n${options.context}\n\n请生成执行计划。`,
    },
  ];

  const rawPlan = await deps.generateObject({
    messages,
    system,
    schema: GeneratedPlanSchema,
    temperature: 0.3,
  });

  return normalizePlan(rawPlan, deps);
}
