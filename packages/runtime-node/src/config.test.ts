import { describe, expect, it, vi } from 'vitest';
import { redactForLog, resolveRuntimeConfig } from './index.js';

describe('runtime config', () => {
  it('prefers explicit settings over environment values', () => {
    vi.stubEnv('PROVIDER', 'anthropic');
    vi.stubEnv('MODEL', 'env-model');
    vi.stubEnv('ANTHROPIC_API_KEY', 'env-key');

    const config = resolveRuntimeConfig(
      {
        provider: 'openai',
        model: 'setting-model',
        apiKey: 'secret-key',
        baseUrl: 'https://example.test/v1/chat/completions',
      },
      process.cwd(),
    );

    expect(config.provider).toBe('openai');
    expect(config.model).toBe('setting-model');
    expect(config.llm.apiKey).toBe('secret-key');
    expect(config.llm.baseURL).toBe('https://example.test/v1');
    vi.unstubAllEnvs();
  });

  it('lets OpenAI RAG embeddings inherit the main LLM endpoint and key', () => {
    const config = resolveRuntimeConfig(
      {
        provider: 'openai',
        apiKey: 'main-key',
        baseUrl: 'https://api.example.test/v1',
      },
      process.cwd(),
    );

    expect(config.rag.embedding?.apiKey).toBe('main-key');
    expect(config.rag.embedding?.baseURL).toBe('https://api.example.test/v1/embeddings');
  });

  it('normalizes Anthropic base URLs to the Messages API base path', () => {
    expect(
      resolveRuntimeConfig(
        {
          provider: 'anthropic',
          baseUrl: 'https://token-plan-cn.xiaomimimo.com/anthropic',
        },
        process.cwd(),
      ).llm.baseURL,
    ).toBe('https://token-plan-cn.xiaomimimo.com/anthropic/v1');

    expect(
      resolveRuntimeConfig(
        {
          provider: 'anthropic',
          baseUrl: 'https://api.anthropic.com/v1/messages',
        },
        process.cwd(),
      ).llm.baseURL,
    ).toBe('https://api.anthropic.com/v1');
  });

  it('configures OpenViking composite RAG from explicit settings', () => {
    const config = resolveRuntimeConfig(
      {
        ragSource: 'composite',
        openVikingEndpoint: 'https://openviking.example.test/query',
        openVikingApiKey: 'ov-key',
        openVikingCorpus: 'wiki',
        openVikingNamespace: 'frontagent',
        openVikingL1Entry: 'docs/openviking/frontagent-l1.md',
        openVikingTimeoutMs: '1234',
      },
      process.cwd(),
    );

    expect(config.rag.source).toBe('composite');
    expect(config.rag.openViking).toMatchObject({
      enabled: true,
      endpoint: 'https://openviking.example.test/query',
      apiKey: 'ov-key',
      corpus: 'wiki',
      namespace: 'frontagent',
      l1Entry: 'docs/openviking/frontagent-l1.md',
      timeoutMs: 1234,
      fallbackToGit: true,
    });
  });

  it('defaults to composite when only OpenViking endpoint is configured', () => {
    vi.stubEnv('FRONTAGENT_OPENVIKING_ENDPOINT', 'https://openviking.example.test/query');

    const config = resolveRuntimeConfig({}, process.cwd());

    expect(config.rag.source).toBe('composite');
    expect(config.rag.openViking?.enabled).toBe(true);
    expect(config.rag.openViking?.l1Entry).toBe('docs/openviking/frontagent-l1.md');
    vi.unstubAllEnvs();
  });

  it('keeps RAG repository sync off by default and supports env opt-in', () => {
    vi.stubEnv('FRONTAGENT_RAG_SYNC_ON_QUERY', '');
    expect(resolveRuntimeConfig({}, process.cwd()).rag.syncOnQuery).toBe(false);

    vi.stubEnv('FRONTAGENT_RAG_SYNC_ON_QUERY', 'true');
    expect(resolveRuntimeConfig({}, process.cwd()).rag.syncOnQuery).toBe(true);

    expect(resolveRuntimeConfig({ ragSyncOnQuery: false }, process.cwd()).rag.syncOnQuery).toBe(
      false,
    );
    vi.unstubAllEnvs();
  });

  it('configures Filesense lightweight navigation budgets from env and explicit settings', () => {
    vi.stubEnv('FRONTAGENT_FILESENSE_ENABLED', 'false');
    vi.stubEnv('FRONTAGENT_FILESENSE_OUTPUT', 'candidates');
    vi.stubEnv('FRONTAGENT_FILESENSE_WRITE_MODE', 'none');
    vi.stubEnv('FRONTAGENT_FILESENSE_MAX_ENTRIES', '111');
    vi.stubEnv('FRONTAGENT_FILESENSE_MAX_BYTES', '222');
    vi.stubEnv('FRONTAGENT_FILESENSE_TIMEOUT_MS', '333');

    const envConfig = resolveRuntimeConfig({}, process.cwd());
    expect(envConfig.filesense).toMatchObject({
      enabled: false,
      output: 'candidates',
      writeMode: 'none',
      maxEntries: 111,
      maxBytes: 222,
      timeoutMs: 333,
    });

    const explicitConfig = resolveRuntimeConfig(
      {
        filesenseEnabled: true,
        filesenseOutput: 'verbose',
        filesenseWriteMode: 'cache',
        filesenseMaxEntries: '444',
      },
      process.cwd(),
    );
    expect(explicitConfig.filesense.enabled).toBe(true);
    expect(explicitConfig.filesense.output).toBe('verbose');
    expect(explicitConfig.filesense.writeMode).toBe('cache');
    expect(explicitConfig.filesense.maxEntries).toBe(444);
    vi.unstubAllEnvs();
  });
});

describe('runtime log redaction', () => {
  it('redacts secrets in nested values', () => {
    expect(redactForLog({ apiKey: 'abc', nested: { token: 'def' } })).toEqual({
      apiKey: '[REDACTED]',
      nested: { token: '[REDACTED]' },
    });
  });
});
