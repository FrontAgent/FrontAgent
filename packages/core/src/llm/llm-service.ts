import { type AnthropicProviderSettings, createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { type CoreMessage, type LanguageModel, generateObject, generateText, streamText } from 'ai';
import type { z } from 'zod';
import type { LLMConfig, Message } from '../types.js';
import {
  analyzeCode as analyzeCodeImpl,
  analyzeErrorsAndGenerateRecovery as analyzeErrorsAndGenerateRecoveryImpl,
  generateCodeForFile as generateCodeForFileImpl,
  generateModifiedCode as generateModifiedCodeImpl,
} from './code-generation.js';
import { tryFixGeneratedObject } from './object-repair.js';
import {
  generatePlan as generatePlanImpl,
  generatePlanInTwoPhases as generatePlanInTwoPhasesImpl,
} from './plan-generation.js';
import type { ErrorRecoveryPlan, GeneratedPlan } from './schemas.js';

export function normalizeProviderBaseURL(
  provider: LLMConfig['provider'],
  baseURL: string | undefined,
): string | undefined {
  if (!baseURL) return undefined;
  const normalized = baseURL.replace(/\/+$/, '');
  if (provider === 'openai') {
    return normalized.replace(/\/chat\/completions$/, '');
  }
  if (provider === 'anthropic') {
    const anthropicBaseURL = normalized.replace(/\/messages$/, '');
    return anthropicBaseURL.endsWith('/v1') ? anthropicBaseURL : `${anthropicBaseURL}/v1`;
  }
  return normalized;
}

export class LLMService {
  private config: LLMConfig;
  private model?: LanguageModel;

  private static errorStats = {
    totalErrors: 0,
    fixedErrors: 0,
    fixStrategies: {
      unwrapDollarKeys: 0,
      deepParseStringified: 0,
      combined: 0,
      parseFromText: 0,
    },
    unfixedErrors: 0,
  };

  constructor(config: LLMConfig) {
    this.config = config;
    this.model = config.backend ? undefined : this.createModel();
  }

  get name(): string {
    return this.config.backend?.name ?? 'direct';
  }

  private isDebug(): boolean {
    return Boolean(this.config.debug || process.env.DEBUG);
  }

  private debugLog(...args: unknown[]): void {
    if (this.isDebug()) {
      console.log(...args);
    }
  }

  private debugWarn(...args: unknown[]): void {
    if (this.isDebug()) {
      console.warn(...args);
    }
  }

  private debugError(...args: unknown[]): void {
    if (this.isDebug()) {
      console.error(...args);
    }
  }

  static getErrorStats() {
    return { ...LLMService.errorStats };
  }

  static resetErrorStats() {
    LLMService.errorStats = {
      totalErrors: 0,
      fixedErrors: 0,
      fixStrategies: {
        unwrapDollarKeys: 0,
        deepParseStringified: 0,
        combined: 0,
        parseFromText: 0,
      },
      unfixedErrors: 0,
    };
  }

  private createModel(): LanguageModel {
    const { provider, model, apiKey, baseURL } = this.config;

    const key = apiKey ?? process.env[`${provider.toUpperCase()}_API_KEY`] ?? process.env.API_KEY;

    const endpoint = normalizeProviderBaseURL(
      provider,
      baseURL ?? process.env[`${provider.toUpperCase()}_BASE_URL`] ?? process.env.BASE_URL,
    );

    const modelName = process.env.MODEL ?? model;

    if (this.isDebug()) {
      this.debugLog('[LLMService] Creating model with config:', {
        provider,
        model: modelName,
        baseURL: endpoint,
        hasApiKey: !!key,
      });
    }

    switch (provider) {
      case 'openai': {
        const openai = createOpenAI({ apiKey: key, baseURL: endpoint });
        return openai(modelName);
      }
      case 'anthropic': {
        const betaHeaders: string[] = [];
        betaHeaders.push('advanced-tool-use-2025-11-20');

        const anthropicConfig: AnthropicProviderSettings = {
          apiKey: key,
          baseURL: endpoint,
        };

        if (betaHeaders.length > 0) {
          anthropicConfig.headers = {
            'anthropic-beta': betaHeaders.join(','),
          };
          this.debugLog('[LLMService] Using Anthropic beta headers:', betaHeaders.join(','));
        }

        const anthropic = createAnthropic(anthropicConfig);
        return anthropic(modelName);
      }
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private convertMessages(messages: Message[]): CoreMessage[] {
    return messages.map((msg) => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
    }));
  }

  private buildCallSettings(options: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
  }) {
    return {
      maxTokens: options.maxTokens ?? this.config.maxTokens ?? 4096,
      temperature: options.temperature ?? this.config.temperature ?? 0.7,
      topP: options.topP ?? this.config.topP,
      topK: options.topK ?? this.config.topK,
    };
  }

  async generateText(options: {
    messages: Message[];
    system?: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
  }): Promise<string> {
    if (this.config.backend) {
      return this.config.backend.generateText(options);
    }
    if (!this.model) {
      throw new Error('No LLM model is configured');
    }
    const result = await generateText({
      model: this.model,
      messages: this.convertMessages(options.messages),
      system: options.system,
      ...this.buildCallSettings(options),
    });

    return result.text;
  }

  async *streamText(options: {
    messages: Message[];
    system?: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
  }): AsyncGenerator<string> {
    if (this.config.backend?.streamText) {
      yield* this.config.backend.streamText(options);
      return;
    }
    if (this.config.backend) {
      yield await this.config.backend.generateText(options);
      return;
    }
    if (!this.model) {
      throw new Error('No LLM model is configured');
    }
    const result = streamText({
      model: this.model,
      messages: this.convertMessages(options.messages),
      system: options.system,
      ...this.buildCallSettings(options),
    });

    for await (const chunk of result.textStream) {
      yield chunk;
    }
  }

  // PLACEHOLDER_GENERATE_OBJECT

  async generateObject<T>(options: {
    messages: Message[];
    system?: string;
    schema: z.ZodType<T>;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
    maxRetries?: number;
  }): Promise<T> {
    if (this.config.backend) {
      return this.config.backend.generateObject(options);
    }
    if (!this.model) {
      throw new Error('No LLM model is configured');
    }
    const maxRetries = options.maxRetries ?? 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const temperature =
          attempt === 0
            ? (options.temperature ?? this.config.temperature ?? 0.3)
            : Math.max(0.1, (options.temperature ?? 0.3) - attempt * 0.1);

        if (attempt > 0) {
          this.debugLog(
            `[LLMService] Retry attempt ${attempt}/${maxRetries} with temperature ${temperature.toFixed(2)}`,
          );
        }

        const result = await generateObject({
          model: this.model,
          messages: this.convertMessages(options.messages),
          system: options.system,
          schema: options.schema,
          ...this.buildCallSettings({
            maxTokens: options.maxTokens,
            temperature,
            topP: options.topP,
            topK: options.topK,
          }),
        });

        if (attempt > 0) {
          this.debugLog(`[LLMService] ✅ Retry attempt ${attempt} succeeded`);
        }

        return result.object;
      } catch (error: unknown) {
        const isLastAttempt = attempt === maxRetries;

        this.debugLog(
          `[LLMService] generateObject failed (attempt ${attempt + 1}/${maxRetries + 1}), attempting to fix...`,
        );

        if (isLastAttempt) {
          LLMService.errorStats.totalErrors++;
        }

        const fixed = tryFixGeneratedObject(error, options.schema, {
          debugLog: this.debugLog.bind(this),
          debugError: this.debugError.bind(this),
          incrementStrategy: (strategy) => {
            LLMService.errorStats.fixStrategies[strategy]++;
          },
        });
        if (fixed) {
          if (isLastAttempt) {
            LLMService.errorStats.fixedErrors++;
          }
          this.debugLog('[LLMService] ✅ Error fixed successfully');
          this.debugLog('[LLMService] Error Stats:', LLMService.getErrorStats());
          return fixed as T;
        }

        if (!isLastAttempt) {
          this.debugLog('[LLMService] Fix failed, will retry with lower temperature...');
          await this.sleep(1000 * (attempt + 1));
          continue;
        }

        LLMService.errorStats.unfixedErrors++;
        this.debugError('[LLMService] ❌ All fix attempts and retries failed');
        this.debugLog('[LLMService] Error Stats:', LLMService.getErrorStats());
        throw error;
      }
    }

    throw new Error('Unexpected error in generateObject retry logic');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private get planDeps() {
    return {
      debugLog: this.debugLog.bind(this),
      debugWarn: this.debugWarn.bind(this),
      debugError: this.debugError.bind(this),
      generateObject: this.generateObject.bind(this),
    };
  }

  private get codeDeps() {
    return {
      debugLog: this.debugLog.bind(this),
      debugWarn: this.debugWarn.bind(this),
      debugError: this.debugError.bind(this),
      generateText: this.generateText.bind(this),
      generateObject: this.generateObject.bind(this),
    };
  }

  async generatePlanInTwoPhases(options: {
    task: string;
    context: string;
    sddConstraints?: string;
    skillContext?: string;
  }): Promise<GeneratedPlan> {
    return generatePlanInTwoPhasesImpl(options, this.planDeps);
  }

  async generatePlan(options: {
    task: string;
    context: string;
    sddConstraints?: string;
    skillContext?: string;
  }): Promise<GeneratedPlan> {
    return generatePlanImpl(options, this.planDeps);
  }

  async generateCodeForFile(options: {
    task: string;
    filePath: string;
    codeDescription: string;
    context: string;
    existingCode?: string;
    language: string;
    existingModules?: string[];
    sddConstraints?: string;
    skillContext?: string;
  }): Promise<string> {
    return generateCodeForFileImpl(options, this.codeDeps);
  }

  async analyzeCode(options: {
    code: string;
    language: string;
    question: string;
  }): Promise<string> {
    return analyzeCodeImpl(options, this.codeDeps);
  }

  async generateModifiedCode(options: {
    originalCode: string;
    changeDescription: string;
    filePath: string;
    language: string;
    skillContext?: string;
  }): Promise<string> {
    return generateModifiedCodeImpl(options, this.codeDeps);
  }

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
    return analyzeErrorsAndGenerateRecoveryImpl(options, this.codeDeps);
  }

  updateConfig(config: Partial<LLMConfig>): void {
    this.config = { ...this.config, ...config };
    this.model = this.createModel();
  }

  getConfig(): LLMConfig {
    return { ...this.config };
  }
}
