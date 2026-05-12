import { zodToJsonSchema } from 'zod-to-json-schema';
import type {
  LLMBackend,
  LLMGenerateObjectOptions,
  LLMGenerateTextOptions,
  Message,
} from '@frontagent/core';

interface SamplingServer {
  createMessage(params: Record<string, unknown>): Promise<{
    content?: { type: string; text?: string; data?: string; mimeType?: string };
    model?: string;
  }>;
  getClientCapabilities?(): {
    sampling?: object;
    tasks?: {
      requests?: {
        sampling?: object;
      };
    };
  } | undefined;
}

export interface SamplingLLMBackendOptions {
  server: SamplingServer;
  fallback: LLMBackend;
}

function supportsSampling(server: SamplingServer): boolean {
  const capabilities = server.getClientCapabilities?.();
  return Boolean(capabilities?.sampling || capabilities?.tasks?.requests?.sampling);
}

function toSamplingMessages(messages: Message[]): Array<{
  role: 'user' | 'assistant';
  content: { type: 'text'; text: string };
}> {
  return messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: {
        type: 'text' as const,
        text: message.content,
      },
    }));
}

function systemPromptFrom(options: LLMGenerateTextOptions): string | undefined {
  const systemMessages = options.messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content);
  const parts = [
    options.system,
    ...systemMessages,
  ].filter((value): value is string => Boolean(value?.trim()));
  return parts.length > 0 ? parts.join('\n\n') : undefined;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Sampling response was empty');
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue with fenced or embedded JSON extraction.
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return JSON.parse(fenced[1]);
  }

  const objectStart = trimmed.indexOf('{');
  const arrayStart = trimmed.indexOf('[');
  const startCandidates = [objectStart, arrayStart].filter((index) => index >= 0);
  const start = Math.min(...startCandidates);
  const end = trimmed.lastIndexOf(trimmed[start] === '[' ? ']' : '}');
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }

  throw new Error('Sampling response did not contain valid JSON');
}

export class SamplingLLMBackend implements LLMBackend {
  readonly name = 'sampling-auto';
  private readonly server: SamplingServer;
  private readonly fallback: LLMBackend;

  constructor(options: SamplingLLMBackendOptions) {
    this.server = options.server;
    this.fallback = options.fallback;
  }

  async generateText(options: LLMGenerateTextOptions): Promise<string> {
    if (!supportsSampling(this.server)) {
      return this.fallback.generateText(options);
    }

    try {
      const response = await this.server.createMessage({
        messages: toSamplingMessages(options.messages),
        systemPrompt: systemPromptFrom(options),
        maxTokens: options.maxTokens,
        temperature: options.temperature,
        modelPreferences: {
          intelligencePriority: 0.8,
          speedPriority: 0.4,
          costPriority: 0.3,
        },
      });
      if (response.content?.type === 'text' && typeof response.content.text === 'string') {
        return response.content.text;
      }
      return JSON.stringify(response.content ?? response);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/method not found|unsupported|sampling/i.test(message)) {
        return this.fallback.generateText(options);
      }
      throw error;
    }
  }

  async *streamText(options: LLMGenerateTextOptions): AsyncGenerator<string> {
    yield await this.generateText(options);
  }

  async generateObject<T>(options: LLMGenerateObjectOptions<T>): Promise<T> {
    if (!supportsSampling(this.server)) {
      return this.fallback.generateObject(options);
    }

    const schema = zodToJsonSchema(options.schema as never, {
      target: 'jsonSchema7',
    });
    const maxRetries = options.maxRetries ?? 2;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const text = await this.generateText({
          ...options,
          messages: [
            ...options.messages,
            {
              role: 'user',
              content: [
                'Return only valid JSON for the requested structured output.',
                'Do not include markdown fences, prose, comments, or trailing commas.',
                `JSON Schema:\n${JSON.stringify(schema, null, 2)}`,
              ].join('\n\n'),
            },
          ],
          temperature: attempt === 0
            ? options.temperature
            : Math.max(0.1, (options.temperature ?? 0.3) - attempt * 0.1),
        });
        const parsed = extractJson(text);
        return options.schema.parse(parsed);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
}
