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
   * 生成执行计划（结构化输出 - Stage 1: 纯规划阶段）
   *
   * 重要：这是两阶段 Agent 架构的第一阶段，只生成结构化的执行步骤描述，不生成实际代码。
   * 代码将在 Stage 2（Executor 阶段）逐文件动态生成。
   */
  async generatePlan(options: {
    task: string;
    context: string;
    sddConstraints?: string;
  }): Promise<GeneratedPlan> {
    const system = `你是一个专业的前端工程 AI Agent，负责分析任务并生成执行计划。

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

# SDD 约束
${options.sddConstraints ?? '无特殊约束'}

# 🚨 强制要求：项目创建任务必须包含验证步骤！🚨

**如果任务是创建新项目或添加新功能**，你的执行计划**必须**在最后包含以下验证步骤：

1. **安装依赖** - 使用 run_command 执行 npm install 或 pnpm install
2. **启动服务器（后台）** - 使用 run_command 后台启动开发服务器
   - ⚠️ 必须使用 "nohup npm run dev > /dev/null 2>&1 & sleep 3" 格式后台运行
   - 不要使用 "npm run dev"（会阻塞）
3. **浏览器访问** - 使用 browser_navigate 访问 http://localhost:5173 或对应端口
4. **截图验证** - 使用 browser_screenshot 截取页面截图，确认页面正确渲染
5. **结构检查** - 使用 get_page_structure 获取DOM结构，检查是否有错误信息

❌ **禁止**：生成完文件就结束，不验证项目是否能运行
❌ **禁止**：使用 "npm run dev" 直接启动（会阻塞后续步骤）
✅ **要求**：必须后台启动服务器并验证项目能正常启动和渲染

# 可用工具
- **read_file**: 读取单个文件的内容
  - 参数: { path: "文件路径" }

- **list_directory**: 列出目录内容
  - 参数: { path: "目录路径", recursive: true/false }

- **search_code**: 搜索代码
  - 参数: { pattern: "搜索模式" }

- **create_file**: 创建新文件（两阶段架构）
  - 参数: { path: "文件路径", codeDescription: "代码描述" }
  - ⚠️ **不要**在 params 中提供 content 字段
  - ✅ **必须**提供 codeDescription 描述要生成什么代码
  - ✅ **必须**设置 needsCodeGeneration: true

- **apply_patch**: 修改现有文件（两阶段架构）
  - 参数: { path: "文件路径", changeDescription: "修改描述" }
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
2. **不要在 params 中包含任何代码**：对于 create_file 或 apply_patch 操作，只需在 codeDescription 或 changeDescription 中描述要生成什么代码或做什么修改
3. **描述而非代码**：用自然语言描述要做什么，而不是直接给出代码
4. **设置 needsCodeGeneration 标志**：对于需要生成代码的步骤（create_file, apply_patch），将 needsCodeGeneration 设为 true
5. **清晰的文件路径**：确保 path 参数准确无误
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
    sddConstraints?: string;
  }): Promise<string> {
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

# 技术要求
- 遵循最佳实践和设计模式
- 代码清晰、可维护
- 使用 TypeScript 类型系统
- 遵循项目代码风格

${options.sddConstraints ? `# SDD 约束\n${options.sddConstraints}` : ''}

# 输出示例
对于一个 React 组件，你应该直接输出：
import React from 'react';

export const MyComponent: React.FC = () => {
  return <div>Hello</div>;
};

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
    sddConstraints?: string;
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

${options.sddConstraints ? `# SDD 约束\n${options.sddConstraints}` : ''}

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
}

/**
 * 生成的计划 Schema（两阶段架构 - Stage 1）
 * 注意：不在此阶段生成代码，只生成结构化的执行步骤描述
 */
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
    // 参数说明：
    // - 对于 read_file: { path: string }
    // - 对于 list_directory: { path: string, recursive?: boolean }
    // - 对于 search_code: { pattern: string, directory?: string }
    // - 对于 create_file: { path: string, codeDescription: string } (不包含实际代码)
    // - 对于 apply_patch: { path: string, changeDescription: string } (不包含实际代码)
    // - 对于 run_command: { command: string, description: string }
    params: z.object({
      path: z.string().optional().describe('文件或目录路径'),
      recursive: z.boolean().optional().describe('是否递归列出子目录 (list_directory)'),
      pattern: z.string().optional().describe('搜索模式'),
      directory: z.string().optional().describe('搜索目录'),
      command: z.string().optional().describe('要执行的终端命令 (run_command)'),
      url: z.string().optional().describe('URL (browser 操作)'),
      selector: z.string().optional().describe('选择器 (browser 操作)'),
      text: z.string().optional().describe('输入文本 (browser 操作)'),
      codeDescription: z.string().optional().describe('要生成的代码的描述 (create_file/apply_patch)'),
      changeDescription: z.string().optional().describe('要做的修改描述 (apply_patch)'),
    }).passthrough().describe('工具参数 - 不包含实际代码，只包含描述'),
    reasoning: z.string().describe('为什么需要这个步骤'),
    needsCodeGeneration: z.boolean().optional().describe('此步骤是否需要在执行时生成代码'),
  })).describe('执行步骤列表'),
  risks: z.array(z.string()).optional().catch([]).describe('潜在风险'),
  alternatives: z.array(z.string()).optional().catch([]).describe('备选方案'),
});

export type GeneratedPlan = z.infer<typeof GeneratedPlanSchema>;

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
