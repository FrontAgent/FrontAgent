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

    // 根据 provider 选择对应的创建函数
    const providerConfig = { apiKey: key, baseURL: endpoint };

    switch (provider) {
      case 'openai': {
        const openai = createOpenAI(providerConfig);
        return openai(model);
      }
      case 'anthropic': {
        const anthropic = createAnthropic(providerConfig);
        return anthropic(model);
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
   * 生成执行计划（结构化输出）
   */
  async generatePlan(options: {
    task: string;
    context: string;
    sddConstraints?: string;
  }): Promise<GeneratedPlan> {
    const system = `你是一个专业的前端工程 AI Agent，负责分析任务并生成执行计划。

你必须遵循以下约束：
${options.sddConstraints ?? '无特殊约束'}

请分析用户的任务，生成详细的执行计划。每个步骤应该清晰、可执行。`;

    const messages: Message[] = [
      {
        role: 'user',
        content: `任务: ${options.task}

上下文信息:
${options.context}

请生成执行计划。`
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
   * 生成代码
   */
  async generateCode(options: {
    task: string;
    context: string;
    existingCode?: string;
    language: string;
    sddConstraints?: string;
  }): Promise<GeneratedCode> {
    const system = `你是一个专业的前端工程 AI Agent，负责生成高质量的代码。

技术要求:
- 语言: ${options.language}
- 遵循最佳实践和设计模式
- 代码应该清晰、可维护、有适当的注释

${options.sddConstraints ? `SDD 约束:\n${options.sddConstraints}` : ''}`;

    const messages: Message[] = [
      {
        role: 'user',
        content: `任务: ${options.task}

${options.existingCode ? `现有代码:\n\`\`\`${options.language}\n${options.existingCode}\n\`\`\`` : ''}

上下文:
${options.context}

请生成代码。`
      }
    ];

    return this.generateObject({
      messages,
      system,
      schema: GeneratedCodeSchema,
      temperature: 0.2,
    });
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
   * 生成代码补丁
   */
  async generatePatch(options: {
    originalCode: string;
    task: string;
    language: string;
    sddConstraints?: string;
  }): Promise<GeneratedPatch> {
    const system = `你是一个专业的代码修改助手，负责生成最小化的代码补丁。

要求:
- 只修改必要的部分
- 保持代码风格一致
- 确保修改后代码语法正确

${options.sddConstraints ? `SDD 约束:\n${options.sddConstraints}` : ''}`;

    const messages: Message[] = [
      {
        role: 'user',
        content: `原始代码:
\`\`\`${options.language}
${options.originalCode}
\`\`\`

修改任务: ${options.task}

请生成补丁。`
      }
    ];

    return this.generateObject({
      messages,
      system,
      schema: GeneratedPatchSchema,
      temperature: 0.2,
    });
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
 * 生成的计划 Schema
 */
const GeneratedPlanSchema = z.object({
  summary: z.string().describe('计划的简要描述'),
  steps: z.array(z.object({
    description: z.string().describe('步骤描述'),
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
    params: z.record(z.unknown()).describe('工具参数'),
    reasoning: z.string().describe('为什么需要这个步骤'),
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
