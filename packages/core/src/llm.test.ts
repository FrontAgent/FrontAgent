import { describe, expect, it } from 'vitest';
import { normalizeProviderBaseURL } from './llm.js';

describe('LLM provider base URL normalization', () => {
  it('keeps OpenAI-compatible base URLs at the chat API root', () => {
    expect(
      normalizeProviderBaseURL('openai', 'https://example.test/v1/chat/completions/'),
    ).toBe('https://example.test/v1');
  });

  it('normalizes Anthropic base URLs to the Messages API base path', () => {
    expect(
      normalizeProviderBaseURL('anthropic', 'https://token-plan-cn.xiaomimimo.com/anthropic'),
    ).toBe('https://token-plan-cn.xiaomimimo.com/anthropic/v1');

    expect(
      normalizeProviderBaseURL('anthropic', 'https://api.anthropic.com/v1/messages'),
    ).toBe('https://api.anthropic.com/v1');
  });
});
