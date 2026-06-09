# Memory Preload Recall Helpers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract `MemoryStore` preload rendering and recall budget selection helpers without changing public memory behavior or persisted file formats.

**Architecture:** Add a focused memory formatting module beside `store.ts` for pure preload formatting, truncation, and recall budget selection. Keep `MemoryStore` responsible for filesystem, gateway access, scoring, and session deduplication.

**Tech Stack:** TypeScript, Vitest, existing `packages/core` memory types.

---

### Task 1: Helper Module Tests

**Files:**
- Create: `packages/core/src/memory/preload-recall-helpers.test.ts`
- Create: `packages/core/src/memory/preload-recall-helpers.ts`

- [ ] **Step 1: Add failing preload formatting and budget tests**

Add tests for:

```ts
buildPreload({
  budget: 800,
  maxTopicFiles: 10,
  gatewayMemories,
  topics,
});
```

Expected behaviors:
- Gateway memories render before local topic sections.
- Empty gateway/topic input returns `null`.
- Long gateway preload output is truncated within the configured budget.
- Recall candidates over the remaining budget are skipped and injected keys are reported only for selected results.

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
pnpm --dir packages/core exec vitest run src/memory/preload-recall-helpers.test.ts
```

Expected: FAIL because `preload-recall-helpers.js` does not exist.

- [ ] **Step 3: Implement helper module**

Create `packages/core/src/memory/preload-recall-helpers.ts` with:
- `PRELOAD_HEADER`
- `buildPreload`
- `selectRecallResultsWithinBudget`
- private pure helpers for gateway section rendering, topic section rendering, part measurement, separator length, and truncation.

- [ ] **Step 4: Verify helper tests pass**

Run:

```bash
pnpm --dir packages/core exec vitest run src/memory/preload-recall-helpers.test.ts
```

Expected: PASS.

### Task 2: MemoryStore Delegation

**Files:**
- Modify: `packages/core/src/memory/store.ts`
- Test: `packages/core/src/memory/store.test.ts`

- [ ] **Step 1: Delegate preload formatting to helper**

Keep index/topic filesystem loading inside `MemoryStore`, then call `buildPreload` with sorted loaded topics and active gateway memories.

- [ ] **Step 2: Delegate recall budget handling to helper**

Keep scoring and dedup filtering inside `MemoryStore`, then call `selectRecallResultsWithinBudget` and add only returned injected keys to the session set.

- [ ] **Step 3: Run focused memory tests**

Run:

```bash
pnpm --dir packages/core exec vitest run src/memory/store.test.ts src/memory/preload-recall-helpers.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.
