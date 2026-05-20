import { describe, expect, it, vi } from 'vitest';
import {
  createKnowledgeBase,
  normalizeKnowledgeBaseSource,
  normalizeOpenVikingConfig,
  normalizeOpenVikingMatches,
  type KnowledgeBaseConfig,
} from './rag.js';

function baseConfig(overrides: Partial<KnowledgeBaseConfig> = {}): KnowledgeBaseConfig {
  return {
    repoUrl: 'https://example.test/repo.git',
    branch: 'main',
    cacheDir: '/tmp/frontagent-rag-test',
    ...overrides,
  };
}

describe('OpenViking knowledge provider', () => {
  it('selects composite source when OpenViking is enabled', () => {
    expect(normalizeKnowledgeBaseSource(baseConfig())).toBe('git');
    expect(normalizeKnowledgeBaseSource(baseConfig({ openViking: { enabled: true } }))).toBe('composite');
    expect(normalizeKnowledgeBaseSource(baseConfig({ source: 'openviking' }))).toBe('openviking');
  });

  it('normalizes OpenViking config and default L1 entry', () => {
    expect(normalizeOpenVikingConfig({ endpoint: 'https://example.test/query/' })).toMatchObject({
      enabled: true,
      endpoint: 'https://example.test/query',
      l1Entry: 'docs/openviking/frontagent-l1.md',
    });
  });

  it('adapts OpenViking payloads into RAG matches', () => {
    const matches = normalizeOpenVikingMatches(
      {
        results: [
          {
            id: 'doc-1',
            type: 'wiki',
            title: 'FrontAgent L1',
            url: 'https://wiki.example.test/frontagent',
            path: 'docs/openviking/frontagent-l1.md',
            score: 0.9,
            content: 'RAG lives in packages/mcp-memory/src/rag.ts',
          },
        ],
      },
      normalizeOpenVikingConfig({ corpus: 'wiki', namespace: 'frontagent' }),
      5,
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      id: 'doc-1',
      type: 'wiki',
      title: 'FrontAgent L1',
      path: 'docs/openviking/frontagent-l1.md',
      metadata: {
        provider: 'openviking',
        corpus: 'wiki',
        namespace: 'frontagent',
        l1Entry: 'docs/openviking/frontagent-l1.md',
      },
    });
  });

  it('queries OpenViking endpoint with corpus namespace and l1 entry', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ results: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const knowledgeBase = createKnowledgeBase(baseConfig({
      source: 'openviking',
      openViking: {
        endpoint: 'https://openviking.example.test/query',
        apiKey: 'secret',
        corpus: 'wiki',
        namespace: 'frontagent',
        l1Entry: 'docs/openviking/frontagent-l1.md',
      },
    }));

    await expect(knowledgeBase.query({ query: 'FrontAgent RAG', maxResults: 3 })).resolves.toMatchObject({
      success: true,
      searchMode: 'openviking',
      results: [],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://openviking.example.test/query');
    expect(init.headers).toMatchObject({ authorization: 'Bearer secret' });
    expect(JSON.parse(String(init.body))).toMatchObject({
      query: 'FrontAgent RAG',
      maxResults: 3,
      corpus: 'wiki',
      namespace: 'frontagent',
      l1Entry: 'docs/openviking/frontagent-l1.md',
    });

    vi.unstubAllGlobals();
  });
});
