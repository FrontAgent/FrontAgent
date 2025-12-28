/**
 * LLM 服务模块
 * 封装与 LLM API 的交互
 */

import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, generateObject, streamText, type CoreMessage, type LanguageModel } from 'ai';
import { z } from 'zod';
import type { LLMConfig, Message } from './types.js';

/**
 * LLM 服务类
 */
export class LLMService {
  private config: LLMConfig;
  private model: LanguageModel;

  constructor(config: LLMConfig) {
    this.config = config;
    this.model = this.createModel();
  }

  /**
   * 创建 LLM 模型实例
   */
  private createModel(): LanguageModel {
    const { provider, model, apiKey, baseURL } = this.config;

    // 获取 API Key - 优先使用配置，否则从环境变量读取
    const key = apiKey ?? process.env[`${provider.toUpperCase()}_API_KEY`] ?? process.env.API_KEY;

    // 获取 baseURL - 优先使用配置，否则从环境变量读取
    const endpoint = baseURL ?? process.env[`${provider.toUpperCase()}_BASE_URL`] ?? process.env.BASE_URL;

    // 获取 model - 支持从环境变量覆盖
    const modelName = process.env.MODEL ?? model;

    // Debug: 输出配置（仅在有 DEBUG 环境变量时）
    if (process.env.DEBUG) {
      console.log('[LLMService] Creating model with config:', {
        provider,
        model: modelName,
        baseURL: endpoint,
        hasApiKey: !!key,
      });
    }

    // 根据 provider 选择对应的创建函数
    const providerConfig = { apiKey: key, baseURL: endpoint };

    switch (provider) {
      case 'openai': {
        const openai = createOpenAI(providerConfig);
        return openai(modelName);
      }
      case 'anthropic': {
        const anthropic = createAnthropic(providerConfig);
        return anthropic(modelName);
      }
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * 转换消息格式
   */
  private convertMessages(messages: Message[]): CoreMessage[] {
    return messages.map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
    }));
  }

  /**
   * 生成文本
   */
  async generateText(options: {
    messages: Message[];
    system?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<string> {
    const result = await generateText({
      model: this.model,
      messages: this.convertMessages(options.messages),
      system: options.system,
      maxTokens: options.maxTokens ?? this.config.maxTokens ?? 4096,
      temperature: options.temperature ?? this.config.temperature ?? 0.7,
    });

    return result.text;
  }

  /**
   * 流式生成文本
   */
  async *streamText(options: {
    messages: Message[];
    system?: string;
    maxTokens?: number;
    temperature?: number;
  }): AsyncGenerator<string> {
    const result = streamText({
      model: this.model,
      messages: this.convertMessages(options.messages),
      system: options.system,
      maxTokens: options.maxTokens ?? this.config.maxTokens ?? 4096,
      temperature: options.temperature ?? this.config.temperature ?? 0.7,
    });

    for await (const chunk of result.textStream) {
      yield chunk;
    }
  }

  /**
   * 生成结构化对象
   */
  async generateObject<T>(options: {
    messages: Message[];
    system?: string;
    schema: z.ZodType<T>; // Zod 做 强Schema 约束
    maxTokens?: number;
    temperature?: number;
  }): Promise<T> {
    const result = await generateObject({
      model: this.model,
      messages: this.convertMessages(options.messages),
      system: options.system,
      schema: options.schema,
      maxTokens: options.maxTokens ?? this.config.maxTokens ?? 4096,
      temperature: options.temperature ?? this.config.temperature ?? 0.3,
    });

    return result.object;
  }

  /**
   * 规范化和修正 LLM 输出的计划
   * 自动修复常见的类型错误，提高鲁棒性
   */
  private normalizePlan(rawPlan: any): GeneratedPlan {
    // 确保 summary 是字符串
    const summary = typeof rawPlan.summary === 'string'
      ? rawPlan.summary
      : 'Generated Plan';

    // 确保 steps 是数组
    let steps = Array.isArray(rawPlan.steps) ? rawPlan.steps : [];

    // 如果 steps 是字符串，尝试解析或创建默认步骤
    if (typeof rawPlan.steps === 'string') {
      console.warn('[LLM] Warning: steps is a string, expected array. Creating default step.');
      steps = [];
    }

    // 规范化每个步骤
    steps = steps.map((step: any, index: number) => {
      // 确保 params 是对象
      let params = step.params;
      if (typeof params === 'string') {
        console.warn(`[LLM] Warning: step[${index}].params is a string, expected object. Converting.`);
        // 尝试解析 JSON 字符串
        try {
          params = JSON.parse(params);
        } catch {
          // 如果解析失败，创建一个包含原字符串的对象
          params = { value: params };
        }
      } else if (!params || typeof params !== 'object') {
        params = {};
      }

      // 确保 needsCodeGeneration 是布尔值
      let needsCodeGeneration = step.needsCodeGeneration;
      if (typeof needsCodeGeneration === 'string') {
        needsCodeGeneration = needsCodeGeneration.toLowerCase() === 'true';
      } else if (typeof needsCodeGeneration !== 'boolean') {
        needsCodeGeneration = undefined;
      }

      return {
        ...step,
        params,
        needsCodeGeneration
      };
    });

    // 确保 risks 是数组
    let risks = rawPlan.risks;
    if (typeof risks === 'string') {
      console.warn('[LLM] Warning: risks is a string, expected array. Converting to array.');
      risks = [risks];
    } else if (!Array.isArray(risks)) {
      risks = [];
    }

    // 确保 alternatives 是数组
    let alternatives = rawPlan.alternatives;
    if (typeof alternatives === 'string') {
      console.warn('[LLM] Warning: alternatives is a string, expected array. Converting to array.');
      alternatives = [alternatives];
    } else if (!Array.isArray(alternatives)) {
      alternatives = [];
    }

    return {
      summary,
      steps,
      risks,
      alternatives
    };
  }

  /**
   * 两阶段生成执行计划
   * Phase 1: 生成计划大纲（summary + 简化的步骤列表）
   * Phase 2: 展开详细步骤
   *
   * 优势：避免一次性生成大量 JSON 导致的 token 限制和解析错误
   */
  async generatePlanInTwoPhases(options: {
    task: string;
    context: string;
    sddConstraints?: string;
  }): Promise<GeneratedPlan> {
    console.log('[LLMService] Using two-phase plan generation...');

    // Phase 1: 生成计划大纲
    const outlineSystem = `你是一个专业的前端工程 AI Agent，负责分析任务并生成执行计划的大纲。

# 🔥 任务类型判断（优先级规则）

## 判断规则（按优先级排序）：
1. **开发/创建任务**（最高优先级）：只要包含"开发"、"创建"、"实现"、"搭建"、"生成"、"构建"、"初始化"等关键词
   - 即使同时包含"观察"、"分析"、"查看"等观察性关键词
   - 例如："观察当前项目，并根据SDD进行开发" → 这是开发任务（包含"开发"）
   - 例如："分析现有代码，然后实现新功能" → 这是开发任务（包含"实现"）

2. **修改任务**（中等优先级）：包含"修改"、"更新"、"优化"、"重构"、"fix"、"修复"等关键词
   - 需要使用 apply_patch 修改现有文件

3. **纯分析任务**（最低优先级）：只包含"分析"、"查看"、"了解"、"观察"等关键词
   - 并且不包含任何开发/修改关键词
   - 只需要 read_file、list_directory、get_ast 等只读操作

⚠️ **判断逻辑**：
- 如果任务中同时出现"观察/分析"和"开发/创建"，优先按开发任务处理
- 开发任务可以包含观察阶段，但必须包含创建/修改阶段
- 不要因为任务开头是"观察"就忽略后面的"开发"需求

# 你的任务（Phase 1）
生成一个**高层次的计划大纲**，包括：
1. summary - 对整个任务的概括性描述
2. stepOutlines - 步骤概要列表（只需简单描述每个步骤的目的和动作类型）
3. risks - 潜在风险（可为空数组）
4. alternatives - 备选方案（可为空数组）

⚠️ 注意：此阶段只需生成步骤的**概要**，不需要填充详细的参数和推理。
⚠️ 步骤概要格式：{ description: "简短描述", action: "动作类型" }

# SDD 约束
${options.sddConstraints ?? '无特殊约束'}

# 🚨 开发/创建任务的强制要求 🚨

**如果是开发/创建任务**（只要包含"开发"、"创建"、"实现"、"生成"、"搭建"、"构建"等任意一个关键词），
步骤大纲**必须**按照以下顺序包含所有阶段：

## 必需的步骤结构（不可省略任何阶段）：

**阶段 1: 分析阶段（1-3个步骤）**
- list_directory: 分析项目目录结构
- read_file: 读取现有配置文件（如果存在）

**阶段 2: 创建阶段（必需！）**
- create_file: 创建 package.json
- create_file: 创建 tsconfig.json（如果使用 TypeScript）
- create_file: 创建构建配置（vite.config.ts/webpack.config.js等）
- create_file: 创建 Tailwind/样式配置（如果使用）
- create_file: 创建目录结构命令（mkdir -p ...）
- create_file: 创建各种源代码文件（组件、页面、utils等）
  - 至少包含：入口文件、主页面、基础组件

**阶段 3: 安装阶段（必需！）**
- run_command: npm install 或 pnpm install

**阶段 4: 验证阶段（必需！在启动服务器前验证）**
- run_command: npm run typecheck 或 tsc --noEmit（验证类型）
- run_command: npm run lint（可选：验证代码规范）

**阶段 5: 启动阶段（必需！）**
- run_command: npm run dev（后台运行）

**阶段 6: 浏览器验证阶段（必需！）**
- browser_navigate: 访问 http://localhost:5173
- browser_screenshot: 截图验证页面渲染
- get_page_structure: 检查页面结构和错误

❌ **严禁**：只生成阶段1（分析），就结束
❌ **严禁**：跳过阶段3（安装）、阶段4（验证）或阶段5（启动）
✅ **正确**：必须包含所有6个阶段

## 示例（正确的完整大纲）：
{
  "summary": "创建电商前端项目，包含配置、组件、验证流程",
  "stepOutlines": [
    // 阶段1: 分析
    { "description": "分析项目目录", "action": "list_directory", "phase": "阶段1-分析" },

    // 阶段2: 创建（必需至少8个create_file）
    { "description": "创建package.json", "action": "create_file", "phase": "阶段2-创建" },
    { "description": "创建tsconfig.json", "action": "create_file", "phase": "阶段2-创建" },
    { "description": "创建vite配置", "action": "create_file", "phase": "阶段2-创建" },
    { "description": "创建Tailwind配置", "action": "create_file", "phase": "阶段2-创建" },
    { "description": "创建index.html", "action": "create_file", "phase": "阶段2-创建" },
    { "description": "创建App.tsx主组件", "action": "create_file", "phase": "阶段2-创建" },
    { "description": "创建Button组件", "action": "create_file", "phase": "阶段2-创建" },
    { "description": "创建首页组件", "action": "create_file", "phase": "阶段2-创建" },

    // 阶段3: 安装（必需）
    { "description": "安装依赖", "action": "run_command", "phase": "阶段3-安装" },

    // 阶段4: 验证（必需）
    { "description": "类型检查", "action": "run_command", "phase": "阶段4-验证" },
    { "description": "代码规范检查", "action": "run_command", "phase": "阶段4-验证" },

    // 阶段5: 启动（必需）
    { "description": "启动开发服务器", "action": "run_command", "phase": "阶段5-启动" },

    // 阶段6: 浏览器验证（必需）
    { "description": "访问首页", "action": "browser_navigate", "phase": "阶段6-浏览器验证" },
    { "description": "页面截图", "action": "browser_screenshot", "phase": "阶段6-浏览器验证" }
  ]
}

⚠️ 重要：
1. **每个步骤必须包含 phase 字段**，指明所属阶段（如："阶段1-分析"、"阶段2-创建"等）
2. **步骤数量不限**：根据任务复杂度生成足够的步骤（可以是30、50甚至更多步骤）
3. **阶段划分清晰**：方便执行器分阶段执行，确保逻辑顺序正确`;

    const outline = await this.generateObject({
      messages: [
        {
          role: 'user',
          content: `任务：${options.task}\n\n项目上下文：\n${options.context}`
        }
      ],
      system: outlineSystem,
      schema: PlanOutlineSchema,
      temperature: 0.3,
      maxTokens: 8192,
    });

    console.log(`[LLMService] Phase 1 complete: ${outline.stepOutlines.length} step outlines generated`);

    // Phase 2: 批量展开步骤详情
    const expansionSystem = `你是一个专业的前端工程 AI Agent，负责将步骤概要展开为详细的可执行步骤。

# 🚨 关键要求：必须输出符合 JSON Schema 的对象 🚨

**你必须输出一个包含 steps 数组的 JSON 对象**，格式如下：
{
  "steps": [
    { ...step1... },
    { ...step2... },
    ...
  ]
}

**严禁将 steps 输出为字符串**：
❌ 错误：{ "steps": "[{...}, {...}]" }  // steps 是字符串
✅ 正确：{ "steps": [{...}, {...}] }    // steps 是数组

# 你的任务（Phase 2）
将以下步骤概要展开为详细的可执行步骤，每个步骤需要包括：
1. description - 详细描述
2. action - 动作类型（与概要保持一致）
3. tool - 工具名称（通常与action相同）
4. phase - 所属阶段（**必须保留Phase 1中的phase字段，不可修改**）
5. params - 详细参数（根据动作类型填充）
6. reasoning - 为什么需要这个步骤
7. needsCodeGeneration - 是否需要代码生成（create_file和apply_patch设为true）

# 🚨 关键原则：文件路径必须包含完整扩展名 🚨

## create_file / apply_patch 的 path 参数规则：
**必须包含完整的文件扩展名**，根据文件类型选择正确的扩展名：

✅ **正确示例**：
- TypeScript 文件：\`src/types/product.ts\`
- React 组件：\`src/components/ui/Button.tsx\`
- 工具函数：\`src/utils/format.ts\`
- Hook：\`src/hooks/useAuth.ts\`
- Store：\`src/stores/useCartStore.ts\`
- 样式文件：\`src/styles/global.css\`
- 配置文件：\`tailwind.config.ts\`, \`vite.config.ts\`

❌ **错误示例**：
- ❌ \`src/types\` → 应该是 \`src/types/index.ts\` 或具体文件名如 \`src/types/product.ts\`
- ❌ \`src/utils\` → 应该是 \`src/utils/format.ts\` 等具体文件
- ❌ \`src/components/ui\` → 应该是 \`src/components/ui/Button.tsx\` 等具体组件文件

## 其他参数规则：
- create_file: params 包含 **path（含扩展名）** 和 codeDescription，设置 needsCodeGeneration: true
- apply_patch: params 包含 **path（含扩展名）** 和 changeDescription，设置 needsCodeGeneration: true
- run_command: params 包含 command
- browser 操作: params 包含 url/selector 等
- 后台启动开发服务器使用: "nohup npm run dev > /dev/null 2>&1 & sleep 3"

## 配置文件内容格式要求：
对于配置文件（如 tsconfig.json、package.json、vite.config.ts 等），codeDescription 必须明确说明：
- **直接输出标准 JSON/JS 配置对象**，不要嵌套在其他结构中
- tsconfig.json: 直接输出 { "compilerOptions": {...}, "include": [...] }
- package.json: 直接输出 { "name": "...", "dependencies": {...} }
- ❌ 禁止生成包含 "files" 数组或其他包装结构的内容

## 验证步骤要求：
- 在"安装依赖"之后、"启动开发服务器"之前，必须包含验证步骤
- 验证步骤应包括：npm run typecheck 或 tsc --noEmit（类型检查）
- 如果 package.json 中定义了 typecheck 脚本，使用 npm run typecheck
- 否则使用 tsc --noEmit 或 tsc -b（如果是项目引用）

# SDD 约束
${options.sddConstraints ?? '无特殊约束'}`;

    // 分批展开步骤（每批最多10个步骤，避免输出过大）
    const batchSize = 10;
    const allSteps = [];

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

      const expansion = await this.generateObject({
        messages: [{ role: 'user', content: batchPrompt }],
        system: expansionSystem,
        schema: StepExpansionSchema,
        temperature: 0.3,
        maxTokens: 16384,
      });

      // 修正可能的格式错误：如果 steps 是字符串，尝试解析为数组
      let steps = expansion.steps;
      if (typeof steps === 'string') {
        console.warn(`[LLMService] Warning: expansion.steps is a string, parsing as JSON`);
        try {
          steps = JSON.parse(steps);
        } catch (error) {
          console.error(`[LLMService] Failed to parse steps string:`, error);
          throw new Error(`Invalid steps format: expected array, got string that cannot be parsed`);
        }
      }

      if (!Array.isArray(steps)) {
        throw new Error(`Invalid steps format: expected array, got ${typeof steps}`);
      }

      allSteps.push(...steps);
      console.log(`[LLMService] Phase 2 batch ${Math.floor(i / batchSize) + 1} complete: ${steps.length} steps expanded`);
    }

    const finalPlan: GeneratedPlan = {
      summary: outline.summary,
      steps: allSteps as any,
      risks: outline.risks,
      alternatives: outline.alternatives,
    };

    console.log(`[LLMService] Two-phase generation complete: ${allSteps.length} total steps`);
    return finalPlan;
  }

  /**
   * 生成执行计划（结构化输出 - Stage 1: 纯规划阶段）
   *
   * 重要：这是两阶段 Agent 架构的第一阶段，只生成结构化的执行步骤描述，不生成实际代码。
   * 代码将在 Stage 2（Executor 阶段）逐文件动态生成。
   *
   * 注意：此方法现在默认使用两阶段生成，避免大型任务的 JSON 解析错误
   */
  async generatePlan(options: {
    task: string;
    context: string;
    sddConstraints?: string;
  }): Promise<GeneratedPlan> {
    // 尝试使用两阶段生成
    try {
      return await this.generatePlanInTwoPhases(options);
    } catch (error) {
      console.warn('[LLMService] Two-phase generation failed, falling back to single-phase:', error);
      // 如果两阶段失败，回退到原来的单阶段方法
      return await this.generatePlanSinglePhase(options);
    }
  }

  /**
   * 单阶段生成执行计划（原始方法，作为后备）
   */
  private async generatePlanSinglePhase(options: {
    task: string;
    context: string;
    sddConstraints?: string;
  }): Promise<GeneratedPlan> {
    const system = `你是一个专业的前端工程 AI Agent，负责分析任务并生成执行计划。

# 🔥🔥🔥 最重要的要求 🔥🔥🔥

## 任务类型判断（优先级规则）
请先判断用户任务是什么类型：

1. **开发/创建任务**（最高优先级）：只要包含"开发"、"创建"、"实现"、"搭建"、"生成"、"构建"、"初始化"等关键词
   - 即使同时包含"观察"、"分析"、"查看"等观察性关键词
   - 例如："观察当前项目，并根据SDD进行开发" → 这是开发任务（包含"开发"）
   - 例如："分析现有代码，然后实现新功能" → 这是开发任务（包含"实现"）

2. **修改任务**（中等优先级）：包含"修改"、"更新"、"优化"、"重构"、"fix"、"修复"等关键词
   - 需要使用 apply_patch 修改现有文件

3. **纯分析任务**（最低优先级）：只包含"分析"、"查看"、"了解"、"观察"等关键词
   - 并且不包含任何开发/修改关键词
   - 只需要 read_file、list_directory、get_ast 等只读操作

⚠️ **判断逻辑**：
- 如果任务中同时出现"观察/分析"和"开发/创建"，优先按开发任务处理
- 开发任务可以包含观察阶段，但必须包含创建/修改阶段
- 不要因为任务开头是"观察"就忽略后面的"开发"需求

## 🚨 强制要求：开发/创建任务必须完成整个流程！🚨

**如果是开发/创建任务**（只要包含"开发"、"创建"、"实现"、"生成"、"搭建"、"构建"等任意一个关键词），你**必须**：

1. **创建所有必要的文件**（不要只分析，要实际创建！）
   - 配置文件：package.json、tsconfig.json、vite.config.ts 等
   - 源代码文件：组件、页面、工具函数等

2. **安装依赖并启动项目**
   - 使用 run_command 执行 npm install
   - 使用 run_command 后台启动开发服务器："nohup npm run dev > /dev/null 2>&1 & sleep 3"

3. **验证项目能运行**（这是必需的，不可省略！）
   - 使用 browser_navigate 访问 http://localhost:5173
   - 使用 browser_screenshot 截取页面截图
   - 使用 get_page_structure 检查页面是否有错误

❌ **严禁**：只生成分析步骤（list_directory、read_file）就结束
❌ **严禁**：生成完文件就结束，不验证项目是否能运行
✅ **正确**：创建文件 → 安装依赖 → 启动服务器 → 浏览器验证

# SDD 约束
${options.sddConstraints ?? '无特殊约束'}

# 🚨 关键要求：必须输出完整的 JSON 对象 🚨

你必须按照以下 schema 输出一个**完整的、结构正确的 JSON 对象**。

**必需的顶层字段**（缺一不可）：
{
  "summary": "计划的简要描述（字符串，必需）",
  "steps": [步骤数组，至少1个，必需],
  "risks": ["风险1", "风险2"],  // 可选，但建议提供
  "alternatives": ["方案1", "方案2"]  // 可选
}

**每个步骤的必需字段**（缺一不可）：
{
  "description": "步骤描述（字符串，必需）",
  "action": "动作类型（枚举，必需）",
  "tool": "工具名称（字符串，必需）",
  "params": { 参数对象，必需 },
  "reasoning": "原因说明（字符串，必需）",
  "needsCodeGeneration": true/false  // 布尔值，可选
}

**严禁简化输出**：不要只输出 {"path": "xxx"} 这样的简化 JSON，必须输出完整的包含所有字段的对象。

# 两阶段 Agent 架构说明
你当前处于 Stage 1（规划阶段），只需要生成结构化的执行步骤描述，**不要生成任何实际代码**。
代码会在 Stage 2（执行阶段）由专门的代码生成器逐文件生成。

# 可用工具
- **read_file**: 读取单个文件的内容
  - 参数: { path: "文件路径" }

- **list_directory**: 列出目录内容
  - 参数: { path: "目录路径", recursive: true/false }

- **search_code**: 搜索代码
  - 参数: { pattern: "搜索模式" }

- **create_file**: 创建新文件（两阶段架构）
  - 参数: { path: "文件路径（含扩展名）", codeDescription: "代码描述" }
  - ⚠️ **path 必须包含完整的文件扩展名**（.ts/.tsx/.css/.json 等）
  - ⚠️ **不要**在 params 中提供 content 字段
  - ✅ **必须**提供 codeDescription 描述要生成什么代码
  - ✅ **必须**设置 needsCodeGeneration: true
  - 示例: { path: "src/components/ui/Button.tsx", codeDescription: "..." }

- **apply_patch**: 修改现有文件（两阶段架构）
  - 参数: { path: "文件路径（含扩展名）", changeDescription: "修改描述" }
  - ⚠️ **path 必须包含完整的文件扩展名**（.ts/.tsx/.css/.json 等）
  - ⚠️ **不要**在 params 中提供 patches 字段
  - ✅ **必须**提供 changeDescription 描述要做什么修改
  - ✅ **必须**设置 needsCodeGeneration: true
  - 示例: { path: "vite.config.ts", changeDescription: "添加路径别名配置，将 @ 映射到 src 目录" }

- **run_command**: 运行终端命令
  - 参数: { command: "命令" }
  - 需要用户批准

# 重要原则
1. **正确使用工具**：
   - 分析项目结构时使用 **list_directory**（不是 read_file）
   - 读取文件内容时使用 **read_file**（必须是文件路径，不能是目录）
   - 例如：分析 src 目录结构 → 使用 list_directory，参数 { path: "src", recursive: true }
2. **🚨 文件路径必须包含完整扩展名**：
   - create_file 和 apply_patch 的 path 参数**必须包含完整的文件扩展名**
   - ✅ 正确：\`src/types/product.ts\`, \`src/components/ui/Button.tsx\`, \`src/utils/format.ts\`
   - ❌ 错误：\`src/types\`, \`src/utils\`, \`src/components/ui\`
3. **不要在 params 中包含任何代码**：对于 create_file 或 apply_patch 操作，只需在 codeDescription 或 changeDescription 中描述要生成什么代码或做什么修改
4. **描述而非代码**：用自然语言描述要做什么，而不是直接给出代码
5. **设置 needsCodeGeneration 标志**：对于需要生成代码的步骤（create_file, apply_patch），将 needsCodeGeneration 设为 true
6. **项目初始化顺序**：
   - 创建前端项目时，必须先创建 package.json 和相关配置文件
   - 然后使用 run_command 安装依赖（如 npm install 或 pnpm install）
   - 然后创建源代码文件
   - 例如：React 项目需要 package.json、tsconfig.json、vite.config.ts 等配置文件
7. **🔥 项目验证与反馈循环（非常重要）**：
   - 在生成完所有源代码文件后，必须验证项目是否能正常运行
   - 验证流程包括：
     a. 使用 run_command 安装依赖（如 npm install）
     b. 使用 run_command 启动开发服务器（如 npm run dev 或 pnpm dev）
     c. 使用 browser_navigate 访问开发服务器（通常是 http://localhost:5173 或 http://localhost:3000）
     d. 使用 browser_screenshot 截取页面截图，验证页面是否正确渲染
     e. 使用 get_page_structure 获取页面结构，检查是否有错误信息
   - 如果发现问题，应该添加修复步骤
   - 这个验证步骤对于新项目创建任务是**必需的**，不可省略

# ✅ 正确示例

**正确的 create_file 步骤：**
{
  "description": "创建 Button 组件文件",
  "action": "create_file",
  "tool": "create_file",
  "params": {
    "path": "src/components/Button.tsx",
    "codeDescription": "创建一个支持 loading 状态和不同尺寸的 React Button 组件，使用 TypeScript 和 Tailwind CSS"
  },
  "reasoning": "需要一个可复用的按钮组件",
  "needsCodeGeneration": true
}

**正确的 apply_patch 步骤：**
{
  "description": "修改 vite.config.ts 添加路径别名",
  "action": "apply_patch",
  "tool": "apply_patch",
  "params": {
    "path": "vite.config.ts",
    "changeDescription": "在 resolve.alias 配置中添加路径别名，将 @ 映射到 src 目录，将 @components 映射到 src/components 目录"
  },
  "reasoning": "配置路径别名可以简化导入语句",
  "needsCodeGeneration": true
}

**🔥 完整的项目创建与验证流程示例（必须遵循）：**

创建一个 React 项目的完整步骤应该包括验证环节：

步骤 1-5: 创建配置文件和源代码文件
{
  "description": "创建 package.json 配置文件",
  "action": "create_file",
  "tool": "create_file",
  "params": {
    "path": "package.json",
    "codeDescription": "创建 React + TypeScript + Vite 项目的 package.json，包含必要的依赖"
  },
  "reasoning": "项目的依赖配置文件",
  "needsCodeGeneration": true
}
// ... 其他配置文件和源代码文件

步骤 6: 安装依赖
{
  "description": "安装项目依赖",
  "action": "run_command",
  "tool": "run_command",
  "params": {
    "command": "npm install"
  },
  "reasoning": "安装 package.json 中定义的所有依赖"
}

步骤 7: 启动开发服务器（后台运行）
{
  "description": "在后台启动开发服务器",
  "action": "run_command",
  "tool": "run_command",
  "params": {
    "command": "nohup npm run dev > /dev/null 2>&1 & sleep 3"
  },
  "reasoning": "后台启动开发服务器，等待3秒让服务器启动完成"
}

步骤 8: 访问页面
{
  "description": "访问开发服务器首页",
  "action": "browser_navigate",
  "tool": "browser_navigate",
  "params": {
    "url": "http://localhost:5173"
  },
  "reasoning": "访问页面验证项目是否正确启动"
}

步骤 9: 截图验证
{
  "description": "截取页面截图",
  "action": "browser_screenshot",
  "tool": "browser_screenshot",
  "params": {
    "fullPage": true
  },
  "reasoning": "截图验证页面是否正确渲染，没有空白或错误"
}

步骤 10: 检查页面结构
{
  "description": "获取页面结构检查错误",
  "action": "get_page_structure",
  "tool": "get_page_structure",
  "params": {},
  "reasoning": "检查页面 DOM 结构，查找是否有错误信息或警告"
}

# ❌ 错误示例（严禁这样做）

**错误1：在 params 中包含代码**
{
  "params": {
    "path": "src/components/Button.tsx",
    "content": "export const Button = () => { ... }" // ❌ 不要包含实际代码
  }
}

**错误2：数组字段使用字符串**
{
  "summary": "任务描述",
  "steps": [...],
  "risks": "可能有风险",  // ❌ 错误！risks 必须是数组，不能是字符串
  "alternatives": "可以用其他方案"  // ❌ 错误！alternatives 必须是数组
}

**正确的数组格式：**
{
  "summary": "任务描述",
  "steps": [...],
  "risks": ["可能有风险1", "可能有风险2"],  // ✅ 正确！使用数组
  "alternatives": ["方案1", "方案2"]  // ✅ 正确！使用数组
}

**错误3：steps 不是数组**
{
  "summary": "...",
  "steps": "读取文件然后修改"  // ❌ 错误！steps 必须是对象数组
}

**正确的 steps 格式：**
{
  "summary": "...",
  "steps": [  // ✅ 正确！steps 是数组
    {
      "description": "...",
      "action": "...",
      // ... 其他字段
    }
  ]
}

# 完整的 JSON 输出模板（严格按照类型）

你的输出必须严格遵循以下结构，特别注意每个字段的类型：

{
  "summary": "string - 任务类型: 任务描述\n步骤数: X (action1: Y, action2: Z)",
  "steps": [  // ⚠️ 必须是数组 Array，不能是字符串 string
    {
      "description": "string - 具体步骤描述",
      "action": "string (enum) - read_file | list_directory | create_file | apply_patch | run_command | search_code | get_ast",
      "tool": "string - 工具名称（如 read_file, create_file, run_command 等）",
      "params": {  // ⚠️ 必须是对象 Object，不能是字符串
        "path": "string - 文件或目录路径（如适用）",
        "command": "string - 命令（如适用）",
        "codeDescription": "string - 代码描述（如适用）",
        "changeDescription": "string - 修改描述（如适用）"
      },
      "reasoning": "string - 为什么需要这个步骤",
      "needsCodeGeneration": true  // boolean - 仅当 action 是 create_file 或 apply_patch 时设为 true
    }
  ],
  "risks": [  // ⚠️ 必须是字符串数组 Array<string>，不能是单个字符串 string
    "string - 可能的风险1",
    "string - 可能的风险2"
  ],
  "alternatives": [  // ⚠️ 必须是字符串数组 Array<string>，不能是单个字符串 string
    "string - 备选方案1",
    "string - 备选方案2"
  ]
}

**关键类型约束：**
- summary: string（字符串）
- steps: Array<Object>（对象数组，不能是字符串）
- risks: Array<string>（字符串数组，不能是单个字符串）
- alternatives: Array<string>（字符串数组，不能是单个字符串）
- 每个 step 的 params: Object（对象，不能是字符串）
- needsCodeGeneration: boolean（布尔值，不能是字符串）

请分析用户的任务，严格按照上述模板生成完整的执行计划。`;

    const messages: Message[] = [
      {
        role: 'user',
        content: `任务: ${options.task}

上下文信息:
${options.context}

请严格按照上述 JSON 模板生成**完整的**执行计划。
必须包含 summary、steps（含所有必需字段）、risks、alternatives。
不要简化输出，不要遗漏任何必需字段。`
      }
    ];

    // 生成原始计划
    const rawPlan = await this.generateObject({
      messages,
      system,
      schema: GeneratedPlanSchema,
      temperature: 0.3,
    });

    // 规范化计划，修正可能的类型错误
    return this.normalizePlan(rawPlan);
  }

  /**
   * 生成代码（Stage 2: 执行阶段的代码生成）
   *
   * 使用 generateText 而不是 generateObject，避免 JSON 中包含大量代码导致的解析错误
   */
  async generateCodeForFile(options: {
    task: string;
    filePath: string;
    codeDescription: string;
    context: string;
    existingCode?: string;
    language: string;
    /** 已创建的模块列表（用于防止路径幻觉） */
    existingModules?: string[];
  }): Promise<string> {
    // 提取上下文中已存在的模块
    const existingModulesInfo = options.existingModules?.length
      ? `\n# 🚨 已创建的模块（只能引用这些模块！）\n${options.existingModules.map(m => `- ${m}`).join('\n')}`
      : '';

    const system = `你是一个专业的代码生成器。你的唯一任务是生成代码，不要做任何其他事情。

# 严格规则
1. **只输出代码**：不要输出任何解释、说明、思考过程
2. **不要使用工具**：不要调用任何 TOOL_CALL，不要读取文件，不要做任何分析
3. **不要使用 markdown**：不要使用 \`\`\` 代码块标记
4. **直接开始**：从第一行代码开始，到最后一行代码结束

# 任务说明
- 文件路径: ${options.filePath}
- 语言: ${options.language}
- 要求: ${options.codeDescription}
${existingModulesInfo}

# 🚨 导入路径规则（非常重要！）

## 禁止引用不存在的模块
1. **只能引用上面列出的"已创建的模块"**
2. **不要假设任何模块存在**，除非它在列表中
3. **禁止编造路径**：如 \`../components/ui/Spinner\` 等未列出的模块
4. **外部依赖除外**：react、tailwindcss 等 npm 包可以正常引用

## 如果需要某个组件但它不在已创建列表中：
- ❌ 不要 import 它
- ✅ 在当前文件中内联实现，或者暂时用占位符

## 示例：
假设已创建模块只有: src/components/Button.tsx

✅ 正确: import { Button } from '../components/Button';
❌ 错误: import { Card } from '../components/Card'; // Card 不在列表中！
❌ 错误: import { Spinner } from '../components/ui/Spinner'; // 不存在！

# 配置文件特殊要求
${options.filePath.match(/\.(json|config\.(js|ts|mjs))$/) ? `
⚠️ 这是一个配置文件，必须严格遵守以下格式：

**如果是 tsconfig.json**：
- 直接输出标准的 tsconfig 对象：{ "compilerOptions": {...}, "include": [...] }
- ❌ 禁止嵌套在 "files" 数组或其他包装结构中

**如果是 package.json**：
- 直接输出标准的 package 对象：{ "name": "...", "version": "...", "dependencies": {...} }
- 必须包含 "typecheck" 脚本（如："typecheck": "tsc --noEmit"）

**如果是 vite.config.ts/webpack.config.js**：
- 直接输出标准的配置导出
` : ''}

# 技术要求
- 遵循最佳实践和设计模式
- 代码清晰、可维护
- 使用 TypeScript 类型系统
- 遵循项目代码风格
- 严格按照 Planner 提供的 codeDescription 要求生成代码
- **只引用已存在的模块或外部 npm 包**

# 输出示例
对于一个 React 组件，你应该直接输出：
import React from 'react';

export const MyComponent: React.FC = () => {
  return <div>Hello</div>;
};

对于 tsconfig.json，你应该直接输出：
{
  "compilerOptions": {
    "target": "ES2020",
    "jsx": "react-jsx"
  },
  "include": ["src"]
}

不要输出任何其他内容！`;

    const messages: Message[] = [
      {
        role: 'user',
        content: `${options.context ? `上下文信息:\n${options.context}\n\n` : ''}${options.existingCode ? `现有代码:\n${options.existingCode}\n\n` : ''}请根据上述要求生成完整的代码文件内容。`
      }
    ];

    const code = await this.generateText({
      messages,
      system,
      temperature: 0.2,
    });

    // 清理可能的多余内容
    let cleaned = code;

    // 移除 markdown 代码块标记
    cleaned = cleaned.replace(/^```[\w]*\n/m, '').replace(/\n```$/m, '');

    // 移除可能的 TOOL_CALL 标记和相关内容
    cleaned = cleaned.replace(/\[TOOL_CALL\][\s\S]*?\[\/TOOL_CALL\]/g, '');

    // 移除中文说明性文字（通常在代码前）
    const lines = cleaned.split('\n');
    let codeStartIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // 找到第一行看起来像代码的行（import, export, const, function, class, interface, type, //, /*, etc.）
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

  /**
   * 分析代码
   */
  async analyzeCode(options: {
    code: string;
    language: string;
    question: string;
  }): Promise<string> {
    const messages: Message[] = [
      {
        role: 'user',
        content: `请分析以下 ${options.language} 代码:

\`\`\`${options.language}
${options.code}
\`\`\`

问题: ${options.question}`
      }
    ];

    return this.generateText({
      messages,
      system: '你是一个专业的代码分析助手，擅长分析和解释代码。',
      temperature: 0.3,
    });
  }

  /**
   * 生成代码修改（Stage 2: 执行阶段的代码修改）
   *
   * 使用 generateText 直接生成修改后的完整代码，避免 JSON 解析问题
   */
  async generateModifiedCode(options: {
    originalCode: string;
    changeDescription: string;
    filePath: string;
    language: string;
  }): Promise<string> {
    const system = `你是一个专业的代码修改器。你的唯一任务是修改代码，不要做任何其他事情。

# 严格规则
1. **只输出代码**：不要输出任何解释、说明、思考过程
2. **不要使用工具**：不要调用任何 TOOL_CALL，不要读取文件
3. **不要使用 markdown**：不要使用 \`\`\` 代码块标记
4. **直接开始**：从第一行代码开始，到最后一行代码结束

# 任务说明
- 文件路径: ${options.filePath}
- 语言: ${options.language}
- 修改要求: ${options.changeDescription}

# 修改要求
- 只修改必要的部分
- 保持代码风格一致
- 确保修改后代码语法正确
- 保留所有未修改的部分
- 严格按照 Planner 提供的 changeDescription 要求进行修改

# 输出示例
直接输出修改后的完整代码，不要有任何其他内容！`;

    const messages: Message[] = [
      {
        role: 'user',
        content: `原始代码:
${options.originalCode}

修改要求: ${options.changeDescription}

请输出修改后的完整代码。`
      }
    ];

    const code = await this.generateText({
      messages,
      system,
      temperature: 0.2,
    });

    // 清理可能的多余内容（同 generateCodeForFile）
    let cleaned = code;

    // 移除 markdown 代码块标记
    cleaned = cleaned.replace(/^```[\w]*\n/m, '').replace(/\n```$/m, '');

    // 移除可能的 TOOL_CALL 标记和相关内容
    cleaned = cleaned.replace(/\[TOOL_CALL\][\s\S]*?\[\/TOOL_CALL\]/g, '');

    // 移除中文说明性文字（通常在代码前）
    const lines = cleaned.split('\n');
    let codeStartIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // 找到第一行看起来像代码的行
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

  /**
   * 更新配置
   */
  updateConfig(config: Partial<LLMConfig>): void {
    this.config = { ...this.config, ...config };
    this.model = this.createModel();
  }

  /**
   * 获取当前配置
   */
  getConfig(): LLMConfig {
    return { ...this.config };
  }

  /**
   * 分析错误并生成修复计划（Tool Error Feedback Loop）
   */
  async analyzeErrorsAndGenerateRecovery(options: {
    task: string;
    phase: string;
    failedSteps: Array<{
      description: string;
      action: string;
      params: Record<string, unknown>;
      error: string;
    }>;
    context: string;
  }): Promise<ErrorRecoveryPlan> {
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

# 修复步骤生成原则
1. **最小修复**: 只生成必要的修复步骤，不重复原有成功的步骤
2. **保持阶段**: 修复步骤的 phase 字段应与原失败步骤的 phase 保持一致
3. **顺序正确**: 确保修复步骤的依赖关系正确（如先 read_file 再 apply_patch）
4. **完整参数**: 确保所有必需参数都已填充，path 必须包含文件扩展名

# 输出要求
- canRecover: 如果错误可以通过生成步骤修复则为 true，否则为 false
- analysis: 清晰说明错误原因
- recoverySteps: 修复步骤数组（按执行顺序排列）
- recommendation: 给出建议`;

    const errorSummary = options.failedSteps.map((step, idx) =>
      `${idx + 1}. [${step.action}] ${step.description}
   参数: ${JSON.stringify(step.params, null, 2)}
   错误: ${step.error}`
    ).join('\n\n');

    const messages: Message[] = [
      {
        role: 'user',
        content: `任务: ${options.task}
当前阶段: ${options.phase}

执行上下文:
${options.context}

以下步骤执行失败:
${errorSummary}

请分析这些错误并生成修复计划。`
      }
    ];

    return this.generateObject({
      messages,
      system,
      schema: ErrorRecoveryPlanSchema,
      temperature: 0.3,
      maxTokens: 8192,
    });
  }
}

/**
 * 生成的计划 Schema（两阶段架构 - Stage 1）
 * 注意：不在此阶段生成代码，只生成结构化的执行步骤描述
 */
/**
 * Phase 1: 计划大纲 Schema
 * 只包含高层次的计划概要，避免一次性生成大量详细步骤
 */
const PlanOutlineSchema = z.object({
  summary: z.string().describe('计划的简要描述'),
  stepOutlines: z.array(z.object({
    description: z.string().describe('步骤简要描述'),
    action: z.enum([
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
      'browser_screenshot'
    ]).describe('执行动作类型'),
    phase: z.string().describe('所属阶段名称（如：阶段1-分析、阶段2-创建、阶段3-安装、阶段4-验证）'),
  })).describe('步骤概要列表 - 只需简单描述每个步骤要做什么'),
  risks: z.array(z.string()).describe('潜在风险（可为空数组）'),
  alternatives: z.array(z.string()).describe('备选方案（可为空数组）'),
});

export type PlanOutline = z.infer<typeof PlanOutlineSchema>;

/**
 * Phase 2: 步骤展开 Schema
 * 将简化的步骤概要展开为详细的可执行步骤
 */
const StepExpansionSchema = z.object({
  steps: z.array(z.object({
    description: z.string().describe('步骤描述 - 说明要做什么'),
    action: z.enum([
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
      'browser_screenshot'
    ]).describe('执行动作'),
    tool: z.string().describe('要调用的工具'),
    phase: z.string().describe('所属阶段名称（与Phase 1中的阶段名称保持一致）'),
    params: z.object({
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
    }).describe('工具参数 - 所有字段必填，不适用的字段填空字符串或false'),
    reasoning: z.string().describe('为什么需要这个步骤'),
    needsCodeGeneration: z.boolean().describe('此步骤是否需要在执行时生成代码，默认false'),
  })).describe('展开后的详细步骤列表'),
});

const GeneratedPlanSchema = z.object({
  summary: z.string().describe('计划的简要描述'),
  steps: z.array(z.object({
    description: z.string().describe('步骤描述 - 说明要做什么'),
    action: z.enum([
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
      'browser_screenshot'
    ]).describe('执行动作'),
    tool: z.string().describe('要调用的工具'),
    phase: z.string().describe('所属阶段名称（如：阶段1-分析、阶段2-创建、阶段3-安装、阶段4-验证）'),
    // 参数说明：
    // - 对于 read_file: { path: string }
    // - 对于 list_directory: { path: string, recursive?: boolean }
    // - 对于 search_code: { pattern: string, directory?: string }
    // - 对于 create_file: { path: string, codeDescription: string } (不包含实际代码)
    // - 对于 apply_patch: { path: string, changeDescription: string } (不包含实际代码)
    // - 对于 run_command: { command: string, description: string }
    params: z.object({
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
    }).describe('工具参数 - 所有字段必填，不适用的字段填空字符串或false'),
    reasoning: z.string().describe('为什么需要这个步骤'),
    needsCodeGeneration: z.boolean().describe('此步骤是否需要在执行时生成代码，默认false'),
  })).describe('执行步骤列表'),
  risks: z.array(z.string()).describe('潜在风险（可为空数组）'),
  alternatives: z.array(z.string()).describe('备选方案（可为空数组）'),
});

export type GeneratedPlan = z.infer<typeof GeneratedPlanSchema>;

/**
 * 错误修复计划 Schema
 */
const ErrorRecoveryPlanSchema = z.object({
  canRecover: z.boolean().describe('是否可以通过生成修复步骤来解决问题'),
  analysis: z.string().describe('错误分析：为什么会出现这些错误'),
  recoverySteps: z.array(z.object({
    description: z.string().describe('修复步骤描述'),
    action: z.enum([
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
      'browser_screenshot'
    ]).describe('修复动作'),
    tool: z.string().describe('工具名称'),
    phase: z.string().describe('所属阶段'),
    params: z.object({
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
    }).describe('工具参数'),
    reasoning: z.string().describe('为什么需要这个修复步骤'),
    needsCodeGeneration: z.boolean().describe('是否需要代码生成'),
  })).describe('修复步骤列表（如果canRecover为false则为空数组）'),
  recommendation: z.string().describe('建议：如何避免类似错误，或者如果无法修复应该如何处理'),
});

export type ErrorRecoveryPlan = z.infer<typeof ErrorRecoveryPlanSchema>;

/**
 * 生成的代码 Schema
 */
const GeneratedCodeSchema = z.object({
  code: z.string().describe('生成的代码'),
  explanation: z.string().describe('代码说明'),
  imports: z.array(z.string()).optional().describe('需要的导入'),
  dependencies: z.array(z.string()).optional().describe('需要安装的依赖'),
});

export type GeneratedCode = z.infer<typeof GeneratedCodeSchema>;

/**
 * 生成的补丁 Schema
 */
const GeneratedPatchSchema = z.object({
  patches: z.array(z.object({
    startLine: z.number().describe('起始行号 (1-based)'),
    endLine: z.number().describe('结束行号 (1-based)'),
    content: z.string().describe('替换内容'),
    reason: z.string().describe('修改原因'),
  })).describe('补丁列表'),
  newCode: z.string().describe('修改后的完整代码'),
  summary: z.string().describe('修改摘要'),
});

export type GeneratedPatch = z.infer<typeof GeneratedPatchSchema>;

/**
 * 创建 LLM 服务实例
 */
export function createLLMService(config: LLMConfig): LLMService {
  return new LLMService(config);
}
