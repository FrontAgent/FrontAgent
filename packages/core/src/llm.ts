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
    schema: z.ZodType<T>;
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

# 两阶段 Agent 架构说明
你当前处于 Stage 1（规划阶段），只需要生成结构化的执行步骤描述，**不要生成任何实际代码**。
代码会在 Stage 2（执行阶段）由专门的代码生成器逐文件生成。

# SDD 约束
${options.sddConstraints ?? '无特殊约束'}

# 重要原则
1. **不要在 params 中包含任何代码**：对于 create_file 或 apply_patch 操作，只需在 codeDescription 或 changeDescription 中描述要生成什么代码或做什么修改
2. **描述而非代码**：用自然语言描述要做什么，而不是直接给出代码
3. **设置 needsCodeGeneration 标志**：对于需要生成代码的步骤（create_file, apply_patch），将 needsCodeGeneration 设为 true
4. **清晰的文件路径**：确保 path 参数准确无误

# 示例
正确的 create_file 步骤：
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

错误示例（不要这样做）：
{
  "params": {
    "path": "src/components/Button.tsx",
    "content": "export const Button = () => { ... }" // ❌ 不要包含实际代码
  }
}

请分析用户的任务，生成详细的执行计划。`;

    const messages: Message[] = [
      {
        role: 'user',
        content: `任务: ${options.task}

上下文信息:
${options.context}

请生成执行计划（只生成步骤描述，不生成实际代码）。`
      }
    ];

    return this.generateObject({
      messages,
      system,
      schema: GeneratedPlanSchema,
      temperature: 0.3,
    });
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
    const system = `你是一个专业的前端工程 AI Agent，负责生成高质量的代码。

# 任务说明
- 文件路径: ${options.filePath}
- 语言: ${options.language}
- 要求: ${options.codeDescription}

# 技术要求
- 遵循最佳实践和设计模式
- 代码应该清晰、可维护、有适当的注释
- 使用 TypeScript 的类型系统
- 遵循项目的代码风格

${options.sddConstraints ? `# SDD 约束\n${options.sddConstraints}` : ''}

# 输出格式
直接输出完整的代码，不要包含任何 markdown 代码块标记（\`\`\`）或其他格式。
只输出纯代码内容，从第一行代码开始，到最后一行代码结束。`;

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

    // 清理可能的 markdown 代码块标记
    return code
      .replace(/^```[\w]*\n/m, '')  // 移除开始的 ```
      .replace(/\n```$/m, '')        // 移除结束的 ```
      .trim();
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
    const system = `你是一个专业的代码修改助手，负责根据要求修改代码。

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

# 输出格式
直接输出修改后的完整代码文件内容，不要包含任何 markdown 代码块标记（\`\`\`）或其他格式。
只输出纯代码内容，从第一行代码开始，到最后一行代码结束。`;

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

    // 清理可能的 markdown 代码块标记
    return code
      .replace(/^```[\w]*\n/m, '')
      .replace(/\n```$/m, '')
      .trim();
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
      'create_file',
      'apply_patch',
      'search_code',
      'get_ast',
      'browser_navigate',
      'get_page_structure',
      'browser_click',
      'browser_type',
      'browser_screenshot'
    ]).describe('执行动作'),
    tool: z.string().describe('要调用的工具'),
    // 参数说明：
    // - 对于 read_file: { path: string }
    // - 对于 search_code: { pattern: string, directory?: string }
    // - 对于 create_file: { path: string, codeDescription: string } (不包含实际代码)
    // - 对于 apply_patch: { path: string, changeDescription: string } (不包含实际代码)
    params: z.object({
      path: z.string().optional().describe('文件路径'),
      pattern: z.string().optional().describe('搜索模式'),
      directory: z.string().optional().describe('搜索目录'),
      url: z.string().optional().describe('URL (browser 操作)'),
      selector: z.string().optional().describe('选择器 (browser 操作)'),
      text: z.string().optional().describe('输入文本 (browser 操作)'),
      codeDescription: z.string().optional().describe('要生成的代码的描述 (create_file/apply_patch)'),
      changeDescription: z.string().optional().describe('要做的修改描述 (apply_patch)'),
    }).passthrough().describe('工具参数 - 不包含实际代码，只包含描述'),
    reasoning: z.string().describe('为什么需要这个步骤'),
    needsCodeGeneration: z.boolean().optional().describe('此步骤是否需要在执行时生成代码'),
  })).describe('执行步骤列表'),
  risks: z.array(z.string()).optional().describe('潜在风险'),
  alternatives: z.array(z.string()).optional().describe('备选方案'),
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
