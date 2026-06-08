import { describe, expect, it } from 'vitest';
import { normalizeConfig, normalizeFiltersForCache, validateMetadataFilters } from './config.js';
import type { KnowledgeBaseConfig } from './types.js';

function baseConfig(overrides: Partial<KnowledgeBaseConfig> = {}): KnowledgeBaseConfig {
  return {
    repoUrl: 'https://github.com/user/repo.git',
    branch: 'main',
    cacheDir: '/tmp/rag-cache',
    ...overrides,
  };
}

describe('normalizeConfig', () => {
  it('fills all defaults from minimal config', () => {
    const result = normalizeConfig(baseConfig());
    expect(result.repoUrl).toBe('https://github.com/user/repo.git');
    expect(result.branch).toBe('main');
    expect(result.syncOnQuery).toBe(false);
    expect(result.maxResults).toBe(5);
    expect(result.chunkSize).toBe(1200);
    expect(result.chunkOverlap).toBe(200);
    expect(result.keywordWeight).toBe(0.45);
    expect(result.semanticWeight).toBe(0.55);
    expect(result.embedding.enabled).toBe(true);
    expect(result.embedding.provider).toBe('openai-compatible');
    expect(result.reranker.enabled).toBe(false);
    expect(result.vectorStore.provider).toBe('local');
  });

  it('respects explicit overrides', () => {
    const result = normalizeConfig(
      baseConfig({
        maxResults: 20,
        chunkSize: 800,
        syncOnQuery: true,
        keywordWeight: 0.6,
        semanticWeight: 0.4,
      }),
    );
    expect(result.maxResults).toBe(20);
    expect(result.chunkSize).toBe(800);
    expect(result.syncOnQuery).toBe(true);
    expect(result.keywordWeight).toBe(0.6);
    expect(result.semanticWeight).toBe(0.4);
  });

  it('resolves cacheDir to absolute path', () => {
    const result = normalizeConfig(baseConfig({ cacheDir: './relative/path' }));
    expect(result.cacheDir).toMatch(/^\//);
  });

  it('normalizes embedding baseURL with /embeddings suffix', () => {
    const result = normalizeConfig(
      baseConfig({
        embedding: { baseURL: 'https://api.openai.com/v1' },
      }),
    );
    expect(result.embedding.baseURL).toBe('https://api.openai.com/v1/embeddings');
  });
});

describe('normalizeFiltersForCache', () => {
  it('returns undefined for no filters', () => {
    expect(normalizeFiltersForCache(undefined)).toBeUndefined();
  });

  it('sorts arrays for stable cache keys', () => {
    const result = normalizeFiltersForCache({
      topLevelDirs: ['docs', 'src', 'apps'],
      extensions: ['.tsx', '.ts'],
    });
    expect(result?.topLevelDirs).toEqual(['apps', 'docs', 'src']);
    expect(result?.extensions).toEqual(['.ts', '.tsx']);
  });

  it('preserves undefined fields', () => {
    const result = normalizeFiltersForCache({ topLevelDirs: ['src'] });
    expect(result?.extensions).toBeUndefined();
    expect(result?.pathPrefixes).toBeUndefined();
  });
});

describe('validateMetadataFilters', () => {
  it('returns undefined for no filters', () => {
    expect(validateMetadataFilters(undefined)).toBeUndefined();
  });

  it('returns undefined for safe paths', () => {
    expect(validateMetadataFilters({ pathPrefixes: ['src/utils'] })).toBeUndefined();
    expect(validateMetadataFilters({ topLevelDirs: ['packages'] })).toBeUndefined();
  });

  it('rejects absolute paths', () => {
    const error = validateMetadataFilters({ pathPrefixes: ['/etc/passwd'] });
    expect(error).toContain('Unsafe');
  });

  it('rejects path traversal', () => {
    const error = validateMetadataFilters({ pathPrefixes: ['src/../../../etc'] });
    expect(error).toContain('Unsafe');
  });

  it('rejects traversal in excludePathPrefixes', () => {
    const error = validateMetadataFilters({ excludePathPrefixes: ['../secret'] });
    expect(error).toContain('Unsafe');
  });

  it('rejects traversal in topLevelDirs', () => {
    const error = validateMetadataFilters({ topLevelDirs: ['/root'] });
    expect(error).toContain('Unsafe');
  });
});
