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

  // 错误统计（类级别的静态成员）
  private static errorStats = {
    totalErrors: 0,
    fixedErrors: 0,
    fixStrategies: {
      unwrapDollarKeys: 0,
      deepParseStringified: 0,
      combined: 0,
      parseFromText: 0
    },
    unfixedErrors: 0
  };

  constructor(config: LLMConfig) {
    this.config = config;
    this.model = this.createModel();
  }

  /**
   * 获取错误统计信息
   */
  static getErrorStats() {
    return { ...LLMService.errorStats };
  }

  /**
   * 重置错误统计
   */
  static resetErrorStats() {
    LLMService.errorStats = {
      totalErrors: 0,
      fixedErrors: 0,
      fixStrategies: {
        unwrapDollarKeys: 0,
        deepParseStringified: 0,
        combined: 0,
        parseFromText: 0
      },
      unfixedErrors: 0
    };
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
    switch (provider) {
      case 'openai': {
        const openai = createOpenAI({ apiKey: key, baseURL: endpoint });
        return openai(modelName);
      }
      case 'anthropic': {
        // 构建 Anthropic beta headers
        // 启用高级工具使用特性以提高结构化输出的可靠性
        const betaHeaders: string[] = [];

        // 启用高级工具使用（2025-11-20）
        // 包括: Tool Search, Programmatic Tool Calling, Tool Use Examples
        betaHeaders.push('advanced-tool-use-2025-11-20');

        // 可选：启用更高效的 token 使用（2025-02-19）
        // betaHeaders.push('token-efficient-tools-2025-02-19');

        const anthropicConfig: any = {
          apiKey: key,
          baseURL: endpoint,
        };

        // 只有在有 beta headers 时才添加
        if (betaHeaders.length > 0) {
          anthropicConfig.headers = {
            'anthropic-beta': betaHeaders.join(',')
          };
          console.log('[LLMService] Using Anthropic beta headers:', betaHeaders.join(','));
        }

        const anthropic = createAnthropic(anthropicConfig);
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
   * 生成结构化对象（带重试机制）
   */
  async generateObject<T>(options: {
    messages: Message[];
    system?: string;
    schema: z.ZodType<T>; // Zod 做 强Schema 约束
    maxTokens?: number;
    temperature?: number;
    maxRetries?: number; // 最大重试次数
  }): Promise<T> {
    const maxRetries = options.maxRetries ?? 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // 对于重试，逐渐降低温度以获得更确定性的输出
        const temperature = attempt === 0
          ? (options.temperature ?? this.config.temperature ?? 0.3)
          : Math.max(0.1, (options.temperature ?? 0.3) - (attempt * 0.1));

        if (attempt > 0) {
          console.log(`[LLMService] Retry attempt ${attempt}/${maxRetries} with temperature ${temperature.toFixed(2)}`);
        }

        const result = await generateObject({
          model: this.model,
          messages: this.convertMessages(options.messages),
          system: options.system,
          schema: options.schema,
          maxTokens: options.maxTokens ?? this.config.maxTokens ?? 4096,
          temperature,
        });

        if (attempt > 0) {
          console.log(`[LLMService] ✅ Retry attempt ${attempt} succeeded`);
        }

        return result.object;
      } catch (error: any) {
        const isLastAttempt = attempt === maxRetries;

        console.log(`[LLMService] generateObject failed (attempt ${attempt + 1}/${maxRetries + 1}), attempting to fix...`);

        // 统计错误（只在最后一次尝试时统计）
        if (isLastAttempt) {
          LLMService.errorStats.totalErrors++;
        }

        // 尝试修复并返回
        const fixed = this.tryFixGeneratedObject(error, options.schema);
        if (fixed) {
          if (isLastAttempt) {
            LLMService.errorStats.fixedErrors++;
          }
          console.log('[LLMService] ✅ Error fixed successfully');
          console.log('[LLMService] Error Stats:', LLMService.getErrorStats());
          return fixed as T;
        }

        // 如果修复失败，且还有重试机会，继续重试
        if (!isLastAttempt) {
          console.log(`[LLMService] Fix failed, will retry with lower temperature...`);
          await this.sleep(1000 * (attempt + 1)); // 指数退避
          continue;
        }

        // 如果是最后一次尝试且修复失败，抛出错误
        LLMService.errorStats.unfixedErrors++;
        console.error('[LLMService] ❌ All fix attempts and retries failed');
        console.log('[LLMService] Error Stats:', LLMService.getErrorStats());
        throw error;
      }
    }

    // 理论上不会到达这里
    throw new Error('Unexpected error in generateObject retry logic');
  }

  /**
   * 简单的延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 尝试修复 generateObject 失败的响应
   * 实现多种修复策略，提高鲁棒性
   */
  private tryFixGeneratedObject<T>(error: any, schema: z.ZodType<T>): T | null {
    const errorToCheck = error.cause || error;

    if (!errorToCheck.value || typeof errorToCheck.value !== 'object') {
      console.log('[LLMService] No value to fix');
      return null;
    }

    // 详细日志：错误类型和结构
    console.log('[LLMService] ========================================');
    console.log('[LLMService] Schema Validation Error Detected');
    console.log('[LLMService] ========================================');
    console.log('[LLMService] Error name:', error.name);
    console.log('[LLMService] Error type:', error.constructor.name);
    console.log('[LLMService] Has cause:', !!error.cause);
    console.log('[LLMService] Original value keys:', Object.keys(errorToCheck.value));
    console.log('[LLMService] Original value structure:', JSON.stringify(errorToCheck.value, null, 2).substring(0, 500) + '...');

    // 如果有 Zod 错误信息，打印出来
    if (errorToCheck.cause?.issues) {
      console.log('[LLMService] Zod validation issues:');
      errorToCheck.cause.issues.forEach((issue: any, index: number) => {
        console.log(`[LLMService]   Issue ${index + 1}:`, {
          path: issue.path.join('.'),
          message: issue.message,
          expected: issue.expected,
          received: issue.received
        });
      });
    }

    // 策略 1: 检测并解包 $ 包装键
    const unwrapped = this.unwrapDollarKeys(errorToCheck.value);
    if (unwrapped !== errorToCheck.value) {
      console.log('[LLMService] Strategy 1: Unwrapped $ keys');
      try {
        const validated = schema.parse(unwrapped);
        LLMService.errorStats.fixStrategies.unwrapDollarKeys++;
        console.log('[LLMService] ✅ Strategy 1 succeeded');
        return validated as T;
      } catch (validationError) {
        console.log('[LLMService] Strategy 1 failed, trying next...');
      }
    }

    // 策略 2: 深度递归解析字符串化的 JSON 字段
    const deepFixed = this.deepParseStringifiedFields(errorToCheck.value);
    if (deepFixed !== errorToCheck.value) {
      console.log('[LLMService] Strategy 2: Deep parsed stringified fields');
      try {
        const validated = schema.parse(deepFixed);
        LLMService.errorStats.fixStrategies.deepParseStringified++;
        console.log('[LLMService] ✅ Strategy 2 succeeded');
        return validated as T;
      } catch (validationError) {
        console.log('[LLMService] Strategy 2 failed, trying next...');
      }
    }

    // 策略 3: 组合策略 - 先解包再解析
    const combined = this.deepParseStringifiedFields(unwrapped);
    if (combined !== errorToCheck.value) {
      console.log('[LLMService] Strategy 3: Combined unwrap + parse');
      try {
        const validated = schema.parse(combined);
        LLMService.errorStats.fixStrategies.combined++;
        console.log('[LLMService] ✅ Strategy 3 succeeded');
        return validated as T;
      } catch (validationError) {
        console.log('[LLMService] Strategy 3 failed, trying next...');
      }
    }

    // 策略 4: 尝试从 text 字段中提取 JSON
    if (errorToCheck.text && typeof errorToCheck.text === 'string') {
      console.log('[LLMService] Strategy 4: Parsing from error.text field');
      try {
        const parsed = JSON.parse(errorToCheck.text);
        const fixed = this.deepParseStringifiedFields(this.unwrapDollarKeys(parsed));
        const validated = schema.parse(fixed);
        LLMService.errorStats.fixStrategies.parseFromText++;
        console.log('[LLMService] ✅ Strategy 4 succeeded');
        return validated as T;
      } catch (parseError) {
        console.log('[LLMService] Strategy 4 failed');
      }
    }

    console.log('[LLMService] All repair strategies failed');
    return null;
  }

  /**
   * 解包以 $ 开头的包装键
   */
  private unwrapDollarKeys(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.unwrapDollarKeys(item));
    }

    // 查找 $ 开头的键
    const dollarKeys = Object.keys(obj).filter(key => key.startsWith('$'));

    if (dollarKeys.length === 1 && Object.keys(obj).length === 1) {
      // 如果只有一个 $ 键，解包它
      console.log(`[LLMService] Unwrapping ${dollarKeys[0]}`);
      return this.unwrapDollarKeys(obj[dollarKeys[0]]);
    }

    // 递归处理所有字段
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (!key.startsWith('$')) {
        result[key] = this.unwrapDollarKeys(value);
      }
    }

    return result;
  }

  /**
   * 深度递归解析字符串化的 JSON 字段
   */
  private deepParseStringifiedFields(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepParseStringifiedFields(item));
    }

    const result: any = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && value.trim().length > 0) {
        // 尝试解析以 [ 或 { 开头的字符串
        if (value.trim().startsWith('[') || value.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(value);
            console.log(`[LLMService] Parsed string field "${key}"`);
            result[key] = this.deepParseStringifiedFields(parsed);
            continue;
          } catch (parseError) {
            // 无法解析，保持原样
          }
        }
      }

      // 递归处理对象和数组
      result[key] = this.deepParseStringifiedFields(value);
    }

    return result;
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

根据任务类型选择需要的阶段：
- 分析类任务：只需阶段1
- 修改类任务：阶段1 → 阶段2 → 阶段4
- 创建类任务：完整的阶段1-6

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

# SDD 约束
${options.sddConstraints ?? '无特殊约束'}

# 输出格式
输出一个 JSON 对象，包含：
- summary: 任务概要描述
- stepOutlines: 步骤列表，每个步骤包含 description、action、phase
- risks: 潜在风险列表
- alternatives: 备选方案列表

确保每个步骤都有明确的 phase 字段，用于分阶段执行。`;

    const outline = await this.generateObject({
      messages: [
        {
          role: 'user',
          content: `任务：${options.task}\n\n项目上下文：\n${options.context}\n\n🚨 关键提醒：输出的每个步骤都必须包含 phase 字段，且不同类型的步骤应归属不同阶段！`
        }
      ],
      system: outlineSystem,
      schema: PlanOutlineSchema,
      temperature: 0.3,
      maxTokens: 8192,
    });

    console.log(`[LLMService] Phase 1 complete: ${outline.stepOutlines.length} step outlines generated`);

    // 🔧 Phase 1 后处理：检查并修正"未分组"问题
    const ungroupedCount = outline.stepOutlines.filter(s => !s.phase || s.phase === '未分组').length;
    if (ungroupedCount > outline.stepOutlines.length * 0.5) {
      console.warn(`[LLMService] ⚠️  Detected ${ungroupedCount}/${outline.stepOutlines.length} steps with "未分组" or missing phase`);
      console.log('[LLMService] 🔧 Auto-fixing phase assignments based on action types...');

      // 自动分配阶段
      for (let i = 0; i < outline.stepOutlines.length; i++) {
        const step = outline.stepOutlines[i];

        // 如果phase缺失或为"未分组"，根据action类型自动分配
        if (!step.phase || step.phase === '未分组') {
          if (step.action === 'list_directory' || step.action === 'search_code' ||
              (step.action === 'read_file' && i < 10)) {
            step.phase = '阶段1-分析';
          } else if (step.action === 'create_file') {
            step.phase = '阶段2-创建';
          } else if (step.action === 'run_command') {
            // 根据描述判断
            if (step.description.includes('安装') || step.description.includes('install')) {
              step.phase = '阶段3-安装';
            } else if (step.description.includes('类型检查') || step.description.includes('typecheck') ||
                       step.description.includes('tsc')) {
              step.phase = '阶段4-验证';
            } else if (step.description.includes('启动') || step.description.includes('dev') ||
                       step.description.includes('serve')) {
              step.phase = '阶段5-启动';
            } else {
              step.phase = '阶段4-验证';
            }
          } else if (step.action === 'browser_navigate' || step.action === 'browser_screenshot' ||
                     step.action === 'get_page_structure' || step.action === 'browser_click') {
            step.phase = '阶段6-浏览器验证';
          } else if (step.action === 'apply_patch') {
            step.phase = '阶段2-创建';
          } else {
            step.phase = '阶段1-分析';
          }

          console.log(`[LLMService]   Fixed step ${i + 1}: "${step.description}" → ${step.phase}`);
        }
      }

      console.log('[LLMService] ✅ Phase assignment auto-fix complete');
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

## 命令执行
- **run_command**: params 需要 command
- 安装依赖: "npm install" 或 "pnpm install"
- 类型检查: "npm run typecheck" 或 "tsc --noEmit"
- 启动服务: "nohup npm run dev > /dev/null 2>&1 & sleep 3"

## 浏览器操作
- **browser_navigate**: params 需要 url
  ⚠️ 重要：使用项目上下文中提供的"开发服务器端口"，不要猜测端口号！
  如果上下文中提供了端口信息，使用 http://localhost:{端口}/
- **browser_screenshot**: params 可选 fullPage: true
- **get_page_structure**: params 可为空对象

# 重要提示
- create_file 和 apply_patch 必须设置 needsCodeGeneration: true
- 文件路径必须包含完整扩展名（如 .ts, .tsx, .json）
- 保持 phase 字段与输入一致

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

      // 验证并修复 phase 字段
      for (let j = 0; j < steps.length; j++) {
        const step = steps[j];
        const batchItem = batch[j];

        // 如果步骤缺少 phase 或 phase 为空，从原始 batch 中恢复
        if (!step.phase || step.phase.trim() === '') {
          if (batchItem?.phase) {
            console.warn(`[LLMService] Restoring missing phase for step: ${batchItem.phase}`);
            step.phase = batchItem.phase;
          } else {
            console.warn(`[LLMService] Both step and batch item missing phase, using default`);
            step.phase = '未分组';
          }
        }
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
    const system = `你是一位经验丰富的高级软件工程师，拥有跨多种编程语言和框架的专家级知识。

# 你的工作方式

当收到任务时，你会：
1. **深度理解问题** - 仔细阅读任务，理解用户真正想要什么
2. **分析上下文** - 了解项目技术栈和代码结构
3. **制定计划** - 将任务拆分为清晰的、可验证的步骤
4. **考虑风险** - 识别可能的问题和备选方案

# 计划结构

根据任务类型组织步骤：
- **分析类**: 使用 list_directory、read_file 了解项目
- **创建类**: 创建文件 → 安装依赖 → 类型检查 → 启动 → 浏览器验证
- **修改类**: 读取文件 → 修改 → 验证

# 可用工具
- **read_file**: { path: "文件路径" }
- **list_directory**: { path: "目录", recursive: true/false }
- **create_file**: { path: "完整路径含扩展名", codeDescription: "描述" }, needsCodeGeneration: true
- **apply_patch**: { path: "完整路径含扩展名", changeDescription: "描述" }, needsCodeGeneration: true
- **run_command**: { command: "命令" }
- **search_code**: { pattern: "搜索模式" }
- **browser_navigate**: { url: "地址" }
- **browser_screenshot**: { fullPage: true }
- **get_page_structure**: {}

# SDD 约束
${options.sddConstraints ?? '无特殊约束'}

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
        content: `任务: ${options.task}\n\n上下文:\n${options.context}\n\n请生成执行计划。`
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
    /** SDD 约束（可选） */
    sddConstraints?: string;
  }): Promise<string> {
    // 提取上下文中已存在的模块
    const existingModulesInfo = options.existingModules?.length
      ? `\n# 可用模块\n以下模块已创建，可以导入使用：\n${options.existingModules.map(m => `- ${m}`).join('\n')}\n\n外部 npm 包（react、tailwindcss 等）可以正常使用。未列出的内部模块不存在，如需相关功能请在当前文件中实现。`
      : '';

    // 添加 SDD 约束信息
    const sddConstraintsInfo = options.sddConstraints
      ? `\n# 项目约束\n${options.sddConstraints}\n`
      : '';

    const system = `你是一位经验丰富的软件工程师。直接输出代码，不要任何解释或 markdown 标记。

# 任务
- 文件: ${options.filePath}
- 语言: ${options.language}
- 要求: ${options.codeDescription}
${existingModulesInfo}
${sddConstraintsInfo}
${options.filePath.match(/\.(json|config\.(js|ts|mjs))$/) ? `
# 配置文件格式
直接输出标准格式，如：
- tsconfig.json: { "compilerOptions": {...}, "include": [...] }
- package.json: { "name": "...", "dependencies": {...} }（建议包含 "typecheck" 脚本）
- vite.config.ts: export default defineConfig({...})
` : ''}
# 代码质量
- 遵循最佳实践
- 代码清晰可维护
- 使用 TypeScript 类型
- 按 codeDescription 要求实现`;

    const messages: Message[] = [
      {
        role: 'user',
        content: `${options.context ? `上下文:\n${options.context}\n\n` : ''}${options.existingCode ? `现有代码:\n${options.existingCode}\n\n` : ''}请生成代码。`
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
    const system = `你是一位经验丰富的软件工程师。直接输出修改后的完整代码，不要任何解释或 markdown 标记。

# 任务
- 文件: ${options.filePath}
- 语言: ${options.language}
- 修改要求: ${options.changeDescription}

# 要求
- 只修改必要部分
- 保持原有代码风格
- 确保语法正确
- 保留未修改的代码`;

    const messages: Message[] = [
      {
        role: 'user',
        content: `原始代码:\n${options.originalCode}\n\n请按要求修改并输出完整代码。`
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
   * 解析 TypeScript 编译错误
   */
  private parseTypeScriptErrors(failedSteps: Array<{ error: string; params: Record<string, unknown> }>): Array<{
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
      // Check if this is a TypeScript compilation error
      const isTscCommand =
        step.params.command?.toString().includes('tsc') ||
        step.params.command?.toString().includes('typecheck');

      if (!isTscCommand) continue;

      // Parse TypeScript error format: "file.ts(line,col): error TSxxxx: message"
      const tsErrorRegex = /([^\s:]+\.tsx?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)/g;
      let match;

      while ((match = tsErrorRegex.exec(step.error)) !== null) {
        tsErrors.push({
          file: match[1],
          line: parseInt(match[2], 10),
          column: parseInt(match[3], 10),
          errorCode: match[4],
          message: match[5],
          rawError: match[0]
        });
      }

      // Also try alternative format: "file.ts:line:col - error TSxxxx: message"
      const altFormatRegex = /([^\s:]+\.tsx?):(\d+):(\d+)\s+-\s+error\s+(TS\d+):\s+(.+)/g;

      while ((match = altFormatRegex.exec(step.error)) !== null) {
        tsErrors.push({
          file: match[1],
          line: parseInt(match[2], 10),
          column: parseInt(match[3], 10),
          errorCode: match[4],
          message: match[5],
          rawError: match[0]
        });
      }
    }

    return tsErrors;
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
    // Parse TypeScript errors if present
    const tsErrors = this.parseTypeScriptErrors(options.failedSteps);
    const hasTsErrors = tsErrors.length > 0;

    if (hasTsErrors) {
      console.log('[LLMService] ========================================');
      console.log(`[LLMService] Detected ${tsErrors.length} TypeScript errors`);
      console.log('[LLMService] ========================================');
      for (const err of tsErrors) {
        console.log(`[LLMService] ${err.file}:${err.line}:${err.column} - ${err.errorCode}: ${err.message}`);
      }
      console.log('[LLMService] Generating intelligent fix steps...');
      console.log('[LLMService] ========================================');
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

### 5.1 "Cannot find name 'X'" (TS2304)
**原因**: 缺少类型导入或变量声明
**修复**: 生成 apply_patch 步骤，添加缺失的 import 语句
**示例**:
\`\`\`
{
  action: "apply_patch",
  tool: "apply_patch",
  params: {
    path: "src/components/Button.tsx",
    changeDescription: "在文件顶部添加缺失的类型导入: import type { ButtonProps } from './types'",
    ...
  },
  needsCodeGeneration: true
}
\`\`\`

### 5.2 "Type 'X' is not assignable to type 'Y'" (TS2322)
**原因**: 类型不匹配
**修复**: 生成 apply_patch 步骤，修正类型注解或添加类型转换
**示例**:
\`\`\`
{
  action: "apply_patch",
  params: {
    path: "src/utils/helper.ts",
    changeDescription: "修正函数返回类型: 将 Promise<string> 改为 Promise<number>",
    ...
  }
}
\`\`\`

### 5.3 "Parameter 'X' implicitly has an 'any' type" (TS7006)
**原因**: 缺少参数类型注解
**修复**: 生成 apply_patch 步骤，添加明确的类型注解
**示例**:
\`\`\`
{
  action: "apply_patch",
  params: {
    path: "src/api/handler.ts",
    changeDescription: "为参数 'data' 添加类型注解: data: RequestData",
    ...
  }
}
\`\`\`

### 5.4 "Property 'X' does not exist on type 'Y'" (TS2339)
**原因**: 访问了不存在的属性
**修复**: 生成 apply_patch 步骤，添加属性定义或修正属性名
**示例**:
\`\`\`
{
  action: "apply_patch",
  params: {
    path: "src/types/user.ts",
    changeDescription: "在 UserType 接口中添加缺失的属性: email: string",
    ...
  }
}
\`\`\`

### 5.5 "'X' is declared but its value is never read" (TS6133)
**原因**: 未使用的变量或导入
**修复**: 生成 apply_patch 步骤，删除未使用的声明
**示例**:
\`\`\`
{
  action: "apply_patch",
  params: {
    path: "src/components/Card.tsx",
    changeDescription: "删除未使用的导入: 移除 import { unused } from './utils'",
    ...
  }
}
\`\`\`

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

    const errorSummary = options.failedSteps.map((step, idx) =>
      `${idx + 1}. [${step.action}] ${step.description}
   参数: ${JSON.stringify(step.params, null, 2)}
   错误: ${step.error}`
    ).join('\n\n');

    // Add TypeScript error details if present
    let tsErrorDetails = '';
    if (hasTsErrors && tsErrors.length > 0) {
      tsErrorDetails = `\n\n🔥 检测到 ${tsErrors.length} 个 TypeScript 编译错误 🔥\n`;
      tsErrorDetails += '请为这些错误生成实际的代码修复步骤（apply_patch），而不是仅仅查看错误。\n\n';

      // Group errors by file
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
