import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { LLMBackend } from '@frontagent/core';
import { SamplingLLMBackend } from './sampling-llm.js';

function createFallback(overrides: Partial<LLMBackend> = {}): LLMBackend {
  return {
    name: 'direct-fallback',
    generateText: vi.fn(async () => 'direct text'),
    generateObject: vi.fn(async () => ({ ok: false })),
    ...overrides,
  } as LLMBackend;
}

describe('SamplingLLMBackend', () => {
  it('uses MCP sampling for text and structured output when supported', async () => {
    const fallback = createFallback({
      generateText: vi.fn(async () => {
        throw new Error('direct fallback should not be used');
      }),
      generateObject: vi.fn(async () => {
        throw new Error('direct fallback should not be used');
      }),
    });
    const createMessage = vi.fn(async (params: Record<string, unknown>) => ({
      content: {
        type: 'text',
        text: JSON.stringify(params).includes('Return only valid JSON')
          ? JSON.stringify({ ok: true })
          : 'sampled text',
      },
    }));

    const backend = new SamplingLLMBackend({
      server: {
        getClientCapabilities: () => ({ sampling: {} }),
        createMessage,
      },
      fallback,
    });

    await expect(backend.generateText({
      messages: [{ role: 'user', content: 'hello' }],
    })).resolves.toBe('sampled text');

    await expect(backend.generateObject({
      messages: [{ role: 'user', content: 'json' }],
      schema: z.object({ ok: z.boolean() }),
    })).resolves.toEqual({ ok: true });

    expect(createMessage).toHaveBeenCalledTimes(2);
    expect(fallback.generateText).not.toHaveBeenCalled();
    expect(fallback.generateObject).not.toHaveBeenCalled();
  });

  it('falls back to direct LLM when sampling is unavailable', async () => {
    const fallback = createFallback();
    const backend = new SamplingLLMBackend({
      server: {
        getClientCapabilities: () => ({}),
        createMessage: vi.fn(async () => ({ content: { type: 'text', text: 'sampled' } })),
      },
      fallback,
    });

    await expect(backend.generateText({
      messages: [{ role: 'user', content: 'hello' }],
    })).resolves.toBe('direct text');

    expect(fallback.generateText).toHaveBeenCalledTimes(1);
  });
});
