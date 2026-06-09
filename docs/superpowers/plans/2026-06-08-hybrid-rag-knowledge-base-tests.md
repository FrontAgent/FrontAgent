# Hybrid RAG Knowledge Base Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add direct, network-free tests for `HybridRepositoryKnowledgeBase` query orchestration.

**Architecture:** Create a warm `index.json` fixture in a temporary cache directory so `ensureIndex` reuses the local index and avoids git checkout, embeddings, and Weaviate. Exercise `query()` through the public class API only.

**Tech Stack:** Vitest, Node temp filesystem helpers, existing mcp-memory RAG types.

---

### Task 1: Focused Knowledge Base Tests

**Files:**
- Create: `packages/mcp-memory/src/rag/knowledge-base.test.ts`

- [ ] **Step 1: Add warm-index fixture helpers**

```ts
async function createKnowledgeBaseFixture() {
  const cacheDir = await mkdtemp(join(tmpdir(), 'frontagent-rag-kb-'));
  const repoDir = join(cacheDir, 'repo');
  await mkdir(repoDir, { recursive: true });
  const index = makeIndex(repoDir);
  await writeFile(join(cacheDir, 'index.json'), JSON.stringify(index), 'utf-8');
  return {
    cacheDir,
    kb: new HybridRepositoryKnowledgeBase({
      repoUrl: index.source.repoUrl,
      branch: index.source.branch,
      cacheDir,
      embedding: { enabled: false },
      reranker: { enabled: false },
    }),
  };
}
```

- [ ] **Step 2: Cover query validation**

```ts
const { kb } = await createKnowledgeBaseFixture();
await expect(kb.query({ query: '   ' })).resolves.toMatchObject({
  success: false,
  error: 'query is required',
});
await expect(kb.query({ query: 'handler', filters: { pathPrefixes: ['../src'] } })).resolves.toMatchObject({
  success: false,
  error: 'Unsafe RAG metadata filter path: ../src',
});
```

- [ ] **Step 3: Cover keyword-only retrieval and metadata filters**

```ts
const result = await kb.query({
  query: 'hybrid repository handler',
  maxResults: 2,
  filters: { topLevelDirs: ['src'], extensions: ['.ts'] },
});
expect(result.success).toBe(true);
expect(result.searchMode).toBe('keyword_only');
expect(result.results?.[0]?.path).toBe('src/rag/knowledge-base.ts');
```

- [ ] **Step 4: Cover cache hit behavior**

```ts
const first = await kb.query({ query: 'hybrid repository handler', maxResults: 1 });
const second = await kb.query({ query: 'hybrid repository handler', maxResults: 1 });
expect(first.timing?.cacheHit).toBe(false);
expect(second.timing?.cacheHit).toBe(true);
expect(second.results).toEqual(first.results);
```

- [ ] **Step 5: Cover warning fallback without external network**

```ts
const kb = new HybridRepositoryKnowledgeBase({
  repoUrl: index.source.repoUrl,
  branch: index.source.branch,
  cacheDir,
  embedding: { enabled: true, apiKey: '' },
  reranker: { enabled: false },
});
const result = await kb.query({ query: 'hybrid repository handler' });
expect(result.success).toBe(true);
expect(result.searchMode).toBe('keyword_only');
expect(result.warnings).toContain('Embedding API key is not configured; keyword-only search was used.');
```

- [ ] **Step 6: Verify**

Run:

```bash
pnpm --dir packages/mcp-memory test
pnpm typecheck
```

Expected: both commands exit 0.
