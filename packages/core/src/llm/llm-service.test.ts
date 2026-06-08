import { describe, expect, it, vi } from 'vitest';
import type { LLMConfig } from '../types.js';
import { LLMService, normalizeProviderBaseURL } from './llm-service.js';

describe('normalizeProviderBaseURL', () => {
  it('returns undefined for undefined input', () => {
    expect(normalizeProviderBaseURL('openai', undefined)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(normalizeProviderBaseURL('openai', '')).toBeUndefined();
  });

  it('strips trailing slashes', () => {
    expect(normalizeProviderBaseURL('openai', 'https://api.example.com/')).toBe(
      'https://api.example.com',
    );
  });

  it('strips /chat/completions for openai provider', () => {
    expect(normalizeProviderBaseURL('openai', 'https://api.example.com/chat/completions')).toBe(
      'https://api.example.com',
    );
  });

  it('strips /messages for anthropic provider', () => {
    expect(normalizeProviderBaseURL('anthropic', 'https://api.example.com/messages')).toBe(
      'https://api.example.com/v1',
    );
  });

  it('appends /v1 for anthropic if not present', () => {
    expect(normalizeProviderBaseURL('anthropic', 'https://api.example.com')).toBe(
      'https://api.example.com/v1',
    );
  });

  it('does not double-append /v1 for anthropic', () => {
    expect(normalizeProviderBaseURL('anthropic', 'https://api.example.com/v1')).toBe(
      'https://api.example.com/v1',
    );
  });

  it('returns URL as-is when no stripping needed', () => {
    expect(normalizeProviderBaseURL('openai', 'https://api.example.com/v1')).toBe(
      'https://api.example.com/v1',
    );
  });
});

describe('LLMService', () => {
  describe('constructor', () => {
    it('creates service with backend', () => {
      const backend = {
        name: 'test-backend',
        generateText: vi.fn().mockResolvedValue('hello'),
        generateObject: vi.fn(),
      };
      const service = new LLMService({ provider: 'openai', model: 'gpt-4', backend });
      expect(service.name).toBe('test-backend');
    });

    it('creates service with direct provider', () => {
      const service = new LLMService({
        provider: 'openai',
        model: 'gpt-4',
        apiKey: 'test-key',
      });
      expect(service.name).toBe('direct');
    });
  });

  describe('errorStats', () => {
    it('returns zero stats after reset', () => {
      LLMService.resetErrorStats();
      const stats = LLMService.getErrorStats();
      expect(stats.totalErrors).toBe(0);
      expect(stats.fixedErrors).toBe(0);
      expect(stats.unfixedErrors).toBe(0);
      expect(stats.fixStrategies.unwrapDollarKeys).toBe(0);
      expect(stats.fixStrategies.deepParseStringified).toBe(0);
      expect(stats.fixStrategies.combined).toBe(0);
      expect(stats.fixStrategies.parseFromText).toBe(0);
    });

    it('returns a copy of error stats', () => {
      LLMService.resetErrorStats();
      const stats1 = LLMService.getErrorStats();
      const stats2 = LLMService.getErrorStats();
      expect(stats1).toEqual(stats2);
      expect(stats1).not.toBe(stats2);
    });
  });

  describe('generateText with backend', () => {
    it('delegates to backend', async () => {
      const backend = {
        name: 'test',
        generateText: vi.fn().mockResolvedValue('hello world'),
        generateObject: vi.fn(),
      };
      const service = new LLMService({ provider: 'openai', model: 'gpt-4', backend });

      const result = await service.generateText({
        messages: [{ role: 'user', content: 'hi' }],
      });

      expect(result).toBe('hello world');
      expect(backend.generateText).toHaveBeenCalledWith({
        messages: [{ role: 'user', content: 'hi' }],
      });
    });
  });

  describe('streamText with backend', () => {
    it('delegates to backend streamText when available', async () => {
      async function* mockStream() {
        yield 'hello ';
        yield 'world';
      }
      const backend = {
        name: 'test',
        generateText: vi.fn(),
        generateObject: vi.fn(),
        streamText: vi.fn().mockReturnValue(mockStream()),
      };
      const service = new LLMService({ provider: 'openai', model: 'gpt-4', backend });

      const chunks: string[] = [];
      for await (const chunk of service.streamText({
        messages: [{ role: 'user', content: 'hi' }],
      })) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['hello ', 'world']);
    });

    it('falls back to generateText when no streamText', async () => {
      const backend = {
        name: 'test',
        generateText: vi.fn().mockResolvedValue('hello world'),
        generateObject: vi.fn(),
      };
      const service = new LLMService({ provider: 'openai', model: 'gpt-4', backend });

      const chunks: string[] = [];
      for await (const chunk of service.streamText({
        messages: [{ role: 'user', content: 'hi' }],
      })) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['hello world']);
    });
  });

  describe('generateObject with backend', () => {
    it('delegates to backend', async () => {
      const schema = { parse: (v: unknown) => v } as any;
      const backend = {
        name: 'test',
        generateText: vi.fn(),
        generateObject: vi.fn().mockResolvedValue({ result: 'ok' }),
      };
      const service = new LLMService({ provider: 'openai', model: 'gpt-4', backend });

      const result = await service.generateObject({
        messages: [{ role: 'user', content: 'hi' }],
        schema,
      });

      expect(result).toEqual({ result: 'ok' });
    });
  });

  describe('getConfig', () => {
    it('returns a copy of the config', () => {
      const config: LLMConfig = { provider: 'openai', model: 'gpt-4', apiKey: 'key' };
      const service = new LLMService(config);
      const returned = service.getConfig();
      expect(returned).toEqual(config);
      expect(returned).not.toBe(config);
    });
  });

  describe('updateConfig', () => {
    it('merges new config', () => {
      const backend = {
        name: 'test',
        generateText: vi.fn(),
        generateObject: vi.fn(),
      };
      const service = new LLMService({ provider: 'openai', model: 'gpt-4', backend });
      service.updateConfig({ temperature: 0.5 });
      const config = service.getConfig();
      expect(config.temperature).toBe(0.5);
      expect(config.model).toBe('gpt-4');
    });
  });
});
