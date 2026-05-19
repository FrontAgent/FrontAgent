import { describe, expect, it } from 'vitest';
import { resolveProviderBaseURL } from './bootstrap.js';

describe('CLI bootstrap provider base URL resolution', () => {
  it('normalizes OpenAI-compatible chat completion URLs', () => {
    expect(
      resolveProviderBaseURL('openai', 'https://example.test/v1/chat/completions/'),
    ).toBe('https://example.test/v1');
  });

  it('normalizes Anthropic Messages API base URLs', () => {
    expect(
      resolveProviderBaseURL('anthropic', 'https://token-plan-cn.xiaomimimo.com/anthropic'),
    ).toBe('https://token-plan-cn.xiaomimimo.com/anthropic/v1');

    expect(
      resolveProviderBaseURL('anthropic', 'https://api.anthropic.com/v1/messages'),
    ).toBe('https://api.anthropic.com/v1');
  });
});
