# RAG Semantic Search Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract semantic retrieval orchestration from `HybridRepositoryKnowledgeBase.query` while preserving query result shape, warnings, timing, and cache behavior.

**Architecture:** Add one focused helper next to the existing RAG helpers that owns semantic candidate retrieval and fallback warnings only. `HybridRepositoryKnowledgeBase.query` continues to own validation, cache lookup, BM25, fusion, rerank, result shaping, and timing.

**Tech Stack:** TypeScript, Vitest, pnpm workspace scripts, GitNexus impact/detect_changes.

---

## File Structure

- Create: `packages/mcp-memory/src/rag/semantic-orchestration.ts`
  - Exports `runSemanticSearchOrchestration`.
  - Accepts explicit dependencies for embedding-store and Weaviate index operations so private class methods remain private.
  - Returns semantic document candidates, search mode, and warnings.
- Modify: `packages/mcp-memory/src/rag/knowledge-base.ts`
  - Replace the semantic retrieval block inside `HybridRepositoryKnowledgeBase.query` with a helper call.
  - Keep timing assignment in `query` so `semanticMs`, cache behavior, fusion, rerank, and result mapping remain unchanged.
- Modify: `packages/mcp-memory/src/rag/semantic-orchestration.test.ts`
  - Add focused helper tests for unchanged local embedding fallback behavior.

## Task 1: Guard Existing Fallback Behavior

**Files:**
- Create: `packages/mcp-memory/src/rag/semantic-orchestration.test.ts`

- [ ] **Step 1: Add a focused fallback test**

Add a test that enables embeddings with an API key and local vector store, injects a compatible partial embedding cache after `ensureEmbeddings` fails, and asserts the existing partial-cache warning text still appears.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm --filter @frontagent/mcp-memory test -- src/rag/semantic-orchestration.test.ts`

Expected: FAIL because `semantic-orchestration.ts` does not exist yet.

## Task 2: Extract Semantic Orchestration Helper

**Files:**
- Create: `packages/mcp-memory/src/rag/semantic-orchestration.ts`
- Modify: `packages/mcp-memory/src/rag/knowledge-base.ts`

- [ ] **Step 1: Implement the helper boundary**

Create `runSemanticSearchOrchestration` with these responsibilities only:
- Skip semantic work when embeddings are disabled.
- Warn when embedding API key is missing.
- Handle Weaviate base URL fallback.
- Ensure/search Weaviate when configured.
- Ensure/read local embedding store, including partial-cache fallback warning.
- Aggregate semantic chunk candidates into document candidates using existing metadata filters.
- Return `searchMode: 'hybrid'` only when semantic document candidates are non-empty.

- [ ] **Step 2: Wire `query` to the helper**

In `HybridRepositoryKnowledgeBase.query`, keep `semanticStartedAt` and `timing.semanticMs` in place, call the helper, append returned warnings, and pass returned candidates into existing fusion unchanged.

- [ ] **Step 3: Run focused tests and verify GREEN**

Run: `pnpm --filter @frontagent/mcp-memory test -- src/rag/semantic-orchestration.test.ts src/rag/knowledge-base.test.ts`

Expected: PASS.

## Task 3: Verify Package and Repository Gates

**Files:**
- No additional source files.

- [ ] **Step 1: Run package tests**

Run: `pnpm --filter @frontagent/mcp-memory test`

Expected: PASS.

- [ ] **Step 2: Run package typecheck**

Run: `pnpm --filter @frontagent/mcp-memory typecheck`

Expected: PASS.

- [ ] **Step 3: Run precommit quality gate**

Run: `pnpm quality:precommit`

Expected: PASS.

- [ ] **Step 4: Inspect final diff impact**

Run: `npx gitnexus detect-changes --scope compare --base-ref develop --repo FrontAgent-rag-semantic-search-orchestration`

Expected: only the plan file and RAG semantic orchestration/query/test surface are reported.
