# mcp-memory In-Memory Index Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop `HybridRepositoryKnowledgeBase.query()` from re-reading and re-parsing `index.json` from disk on every invocation by caching the parsed `RepositoryIndex` in a private field (Issue #275).

**Architecture:** Add a `cachedIndex: RepositoryIndex | null` private field to `HybridRepositoryKnowledgeBase`. `ensureIndex()` consults the in-memory cache first via the existing `canReuseWarmIndex()` check (which already encodes all reuse preconditions: no force refresh, no `syncOnQuery`, repo dir present, repoUrl/branch/repoDir/chunking config match). On a cache miss it falls back to the current disk-read path and populates the cache with whatever index it returns (disk-reused, `canReuseIndex`-reused after sync, or freshly built). Invalidation is automatic: `refresh: true` and `syncOnQuery` both make `canReuseWarmIndex` return false, and config changes require a new instance (config is normalized once in the constructor and readonly).

**Tech Stack:** TypeScript, vitest, pnpm workspace (`@frontagent/mcp-memory`).

**Out of scope (noted in issue as optional):** BM25 posting lists and typed-array embeddings — these change the on-disk index format (`INDEX_VERSION` bump) and are not required to remove per-query disk I/O. Keep the PR focused.

**Behavioral note (intended, per issue):** if an external process rewrites `index.json` while an instance holds a warm in-memory index, the instance keeps serving the in-memory copy until `refresh: true` or a new instance. The issue explicitly requests this trade-off ("reuse it when canReuseWarmIndex passes, invalidate on refresh").

---

### Task 1: In-memory index cache in `HybridRepositoryKnowledgeBase`

**Files:**
- Modify: `packages/mcp-memory/src/rag/knowledge-base.ts` (field near line 53, `ensureIndex` lines 268–320)
- Test: `packages/mcp-memory/src/rag/knowledge-base.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to the `describe('HybridRepositoryKnowledgeBase', ...)` block in `packages/mcp-memory/src/rag/knowledge-base.test.ts`:

```ts
  it('serves distinct queries from the in-memory index without re-reading index.json', async () => {
    const { cacheDir, kb } = await createFixture();

    const first = await kb.query({ query: 'hybrid repository handler' });
    expect(first.success).toBe(true);
    expect(first.sourceRevision).toBe('test-revision');

    // Rewrite the on-disk index with a different revision. A warm instance must
    // keep serving the parsed in-memory index instead of re-reading the file.
    const mutated = makeIndex(join(cacheDir, 'repo'));
    mutated.source.revision = 'rewritten-revision';
    await writeFile(join(cacheDir, 'index.json'), JSON.stringify(mutated), 'utf-8');

    const second = await kb.query({ query: 'repository concepts' });
    expect(second.success).toBe(true);
    expect(second.timing?.cacheHit).toBe(false);
    expect(second.sourceRevision).toBe('test-revision');
  });

  it('keeps serving distinct queries after index.json becomes unreadable', async () => {
    const { cacheDir, kb } = await createFixture();

    const first = await kb.query({ query: 'hybrid repository handler' });
    expect(first.success).toBe(true);

    await writeFile(join(cacheDir, 'index.json'), 'not json', 'utf-8');

    const second = await kb.query({ query: 'validates query input' });
    expect(second.success).toBe(true);
    expect(second.sourceRevision).toBe('test-revision');
  });

  it('reads the index from disk again when syncOnQuery disables warm reuse', async () => {
    const { cacheDir, kb } = await createFixture({ syncOnQuery: true });
    // syncOnQuery instances never reuse the warm index, so they must not be
    // pinned to a stale in-memory copy either. We cannot run a real git sync in
    // this fixture, so only assert the warm-reuse gate stays closed: the cached
    // field must not short-circuit ensureIndex when syncOnQuery is true.
    const mutated = makeIndex(join(cacheDir, 'repo'));
    mutated.source.revision = 'rewritten-revision';
    await writeFile(join(cacheDir, 'index.json'), JSON.stringify(mutated), 'utf-8');

    const result = await kb.query({ query: 'hybrid repository handler' });
    // ensureRepositoryCheckout will fail in the fixture (repo dir is not a git
    // checkout), proving the in-memory cache did not bypass the sync path.
    expect(result.success).toBe(false);
  });
```

Note: `syncOnQuery` must exist on `KnowledgeBaseConfig` (verify in `types.ts`; `this.config.syncOnQuery` is already referenced at lines 277 and 329, so it does). If the third test's failure mode is flaky (e.g., git happens to succeed because tmpdir is inside a real repo), replace it with a `canReuseWarmIndex`-level assertion or drop it — the first two tests are the load-bearing ones.

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `pnpm vitest run packages/mcp-memory/src/rag/knowledge-base.test.ts`
Expected: the first new test FAILS with `expected 'rewritten-revision' to be 'test-revision'` (old code re-reads disk). The unreadable-index test FAILS with `success: false`. The syncOnQuery test should already pass (guards regression).

- [ ] **Step 3: Implement the cache**

In `packages/mcp-memory/src/rag/knowledge-base.ts`:

Add a field after `queryCache` (line 53):

```ts
  private cachedIndex: RepositoryIndex | null = null;
```

Replace `ensureIndex` (lines 268–320) with:

```ts
  private async ensureIndex(forceRefresh: boolean): Promise<RepositoryIndex> {
    mkdirSync(this.config.cacheDir, { recursive: true });
    const targetRepoDir = this.getRepoDir();
    if (this.cachedIndex && this.canReuseWarmIndex(this.cachedIndex, targetRepoDir, forceRefresh)) {
      return this.cachedIndex;
    }

    this.cachedIndex = null;
    const existing = await this.readIndex();
    if (existing && this.canReuseWarmIndex(existing, targetRepoDir, forceRefresh)) {
      this.cachedIndex = existing;
      return existing;
    }

    const shouldSyncRepository =
      forceRefresh || this.config.syncOnQuery || !existing || !existsSync(targetRepoDir);
    const repoDir = await ensureRepositoryCheckout({
      repoUrl: this.config.repoUrl,
      branch: this.config.branch,
      repoDir: targetRepoDir,
      sync: shouldSyncRepository,
    });
    const revision = await getRepositoryHead(repoDir);
    const submodulePaths = await getSubmodulePaths(repoDir);
    const excludedPathPrefixes = [
      ...new Set([...this.config.excludedPathPrefixes, ...submodulePaths].map(normalizeRepoPath)),
    ];

    if (
      existing &&
      canReuseIndex(existing, {
        repoUrl: this.config.repoUrl,
        branch: this.config.branch,
        revision,
        repoDir,
        excludedPathPrefixes,
        excludedSubmodulePaths: submodulePaths,
        chunkSize: this.config.chunkSize,
        chunkOverlap: this.config.chunkOverlap,
        maxFileSizeBytes: this.config.maxFileSizeBytes,
      })
    ) {
      this.cachedIndex = existing;
      return existing;
    }

    const index = await buildRepositoryIndex({
      repoDir,
      repoUrl: this.config.repoUrl,
      branch: this.config.branch,
      revision,
      excludedPathPrefixes,
      excludedSubmodulePaths: submodulePaths,
      chunkSize: this.config.chunkSize,
      chunkOverlap: this.config.chunkOverlap,
      maxFileSizeBytes: this.config.maxFileSizeBytes,
    });
    await this.writeIndex(index);
    this.cachedIndex = index;
    return index;
  }
```

Only structural changes vs the original: the warm check now runs against `this.cachedIndex` first (before any disk I/O), and every return path assigns `this.cachedIndex`. `mkdirSync` stays first so behavior for a missing cache dir is unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run packages/mcp-memory/src/rag/knowledge-base.test.ts`
Expected: all tests PASS (4 existing + 3 new).

- [ ] **Step 5: Run the package test suite and typecheck**

Run: `pnpm vitest run packages/mcp-memory` and the repo typecheck for the package (`pnpm -C packages/mcp-memory exec tsc --noEmit` or repo-level `pnpm quality:precommit` later).
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/mcp-memory/src/rag/knowledge-base.ts packages/mcp-memory/src/rag/knowledge-base.test.ts
git commit -m "perf(mcp-memory): cache parsed repository index in memory across queries"
```

### Task 2: Benchmark evidence (optional, for PR body only — not committed)

- [ ] **Step 1: Generate a large synthetic index and measure `ensureIndexMs`**

Write a throwaway script (do NOT commit) at `/tmp/kb-bench.mjs` that builds a synthetic `index.json` with ~5,000 chunks (reuse the shapes from `knowledge-base.test.ts`), instantiates `HybridRepositoryKnowledgeBase` (embedding + reranker disabled), runs 20 distinct queries, and prints mean `timing.ensureIndexMs` and `timing.bm25Ms`. Run it once against the develop build and once against the branch build (use `npx tsx` pointing at the source file). Record numbers for the PR body. If wiring the script against the workspace takes more than ~15 minutes, skip — the repo-guard constraint marks this as non-blocking.

### Task 3: Quality gates and PR

- [ ] **Step 1: Run `pnpm quality:precommit`** — expected PASS.
- [ ] **Step 2: Run GitNexus `detect_changes`** — expected: only `knowledge-base.ts` symbols (`ensureIndex`, `HybridRepositoryKnowledgeBase`) and the 4 `query` execution flows affected.
- [ ] **Step 3: Push branch, open PR to `develop` titled `perf(mcp-memory): cache parsed repository index in memory across queries` with `Closes #275`, repo PR template, GitNexus impact summary (LOW risk, 1 direct caller `query`, Rag module), and benchmark table if Task 2 produced numbers.**

## Self-Review

- Spec coverage: issue's required fix (private field + reuse on `canReuseWarmIndex` + invalidate on refresh/revision/config) → Task 1. Optional posting lists/typed arrays → explicitly out of scope. Optional benchmark → Task 2. Covered.
- Placeholder scan: none; all code inline.
- Type consistency: `cachedIndex` field name used consistently; `RepositoryIndex` already imported in both files.
