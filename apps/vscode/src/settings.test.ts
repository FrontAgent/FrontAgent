import { describe, expect, it } from 'vitest';
import { resolveConfigStatusFromSources } from './settings.js';

describe('VS Code config resolution', () => {
  it('requires explicit provider, model, base URL, and API key from settings/secrets/env', () => {
    const status = resolveConfigStatusFromSources({
      settings: {},
      secrets: {},
      env: {},
    });

    expect(status.configured).toBe(false);
    expect(status.missing).toEqual(['provider', 'model', 'baseUrl', 'apiKey']);
  });

  it('uses settings and provider secret before env fallback', () => {
    const status = resolveConfigStatusFromSources({
      settings: {
        provider: 'openai',
        model: 'zai-org/GLM-4.6',
        baseUrl: 'https://api.siliconflow.cn/v1',
      },
      secrets: {
        providerApiKey: 'secret-key',
      },
      env: {
        PROVIDER: 'anthropic',
        MODEL: 'env-model',
        API_KEY: 'env-key',
      },
    });

    expect(status).toMatchObject({
      provider: 'openai',
      model: 'zai-org/GLM-4.6',
      baseUrl: 'https://api.siliconflow.cn/v1',
      hasApiKey: true,
      configured: true,
      missing: [],
    });
  });

  it('accepts API key from settings when SecretStorage is empty', () => {
    const status = resolveConfigStatusFromSources({
      settings: {
        provider: 'openai',
        model: 'zai-org/GLM-4.6',
        baseUrl: 'https://api.siliconflow.cn/v1',
        apiKey: 'settings-key',
      },
      secrets: {},
      env: {},
    });

    expect(status.configured).toBe(true);
    expect(status.hasApiKey).toBe(true);
  });

  it('falls back to provider-specific env values', () => {
    const status = resolveConfigStatusFromSources({
      settings: {},
      secrets: {},
      env: {
        PROVIDER: 'openai',
        MODEL: 'env-model',
        OPENAI_BASE_URL: 'https://example.test/v1',
        OPENAI_API_KEY: 'env-key',
      },
    });

    expect(status.configured).toBe(true);
    expect(status.provider).toBe('openai');
    expect(status.baseUrl).toBe('https://example.test/v1');
    expect(status.hasApiKey).toBe(true);
  });
});
