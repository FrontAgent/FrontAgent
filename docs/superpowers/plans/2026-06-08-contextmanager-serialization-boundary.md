# ContextManager Serialization Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose ContextManager fact serialization and prompt-budget limits into a focused helper without changing `serializeFactsForLLM` output.

**Architecture:** Keep `ContextManager.serializeFactsForLLM(taskId)` as the stable public API that owns task lookup and module dependency validation. Move LLM-readable fact formatting and hardcoded list limits into `packages/core/src/context/fact-serializer.ts`, with focused tests covering the helper output and budget behavior.

**Tech Stack:** TypeScript, Vitest, GitNexus, pnpm/turbo.

---

### Task 1: Add Focused Serializer Tests

**Files:**
- Create: `packages/core/src/context/fact-serializer.test.ts`
- Read: `packages/core/src/types.ts`

- [ ] **Step 1: Write a failing helper test for stable output and budgets**

Add a focused Vitest suite that imports `serializeProjectFactsForLLM` from `./fact-serializer.js`, builds a `ProjectFacts` fixture with long directory contents, exports, missing module references, and errors, then asserts the current serialization headings and prompt-budget limits.

- [ ] **Step 2: Run focused test and verify RED**

Run: `pnpm --dir packages/core test src/context/fact-serializer.test.ts`
Expected: FAIL because `./fact-serializer.js` does not exist.

### Task 2: Extract Serialization Helper

**Files:**
- Create: `packages/core/src/context/fact-serializer.ts`
- Modify: `packages/core/src/context/context-manager.ts`
- Test: `packages/core/src/context/fact-serializer.test.ts`

- [ ] **Step 1: Implement the helper with named budget constants**

Create `serializeProjectFactsForLLM(facts, options)` in `fact-serializer.ts`. Preserve the existing section headings, ordering, newline placement, directory content limit of 5, export limit of 3, missing module reference limit of 10, and recent error limit of 5.

- [ ] **Step 2: Delegate from ContextManager**

Import the helper and replace the body of `serializeFactsForLLM` after context lookup with:

```ts
return serializeProjectFactsForLLM(context.facts, {
  missingModuleReferences: this.validateModuleDependencies(taskId),
});
```

- [ ] **Step 3: Run focused helper and ContextManager tests**

Run: `pnpm --dir packages/core test src/context/fact-serializer.test.ts src/context/context-manager.test.ts`
Expected: PASS.

### Task 3: Verify and Prepare PR

**Files:**
- Inspect: final git diff
- Exclude: `.gitnexus/lbug`, `.gitnexus/meta.json`

- [ ] **Step 1: Run required gates**

Run: `pnpm --dir packages/core test src/context/fact-serializer.test.ts src/context/context-manager.test.ts`
Expected: PASS.

Run: `pnpm typecheck`
Expected: PASS.

Run: `pnpm quality:precommit`
Expected: PASS.

- [ ] **Step 2: Run GitNexus detect_changes**

Run: `npx gitnexus detect-changes --scope all --repo /Users/ceilf6/.config/superpowers/worktrees/FrontAgent-app/improve-contextmanager-serialization-boundary-clone`
Expected: scoped changes in context serializer/helper/tests/plan only.

- [ ] **Step 3: Open PR**

Push `improve/contextmanager-serialization-boundary` and open a PR to `develop` with `Closes #182`, the GitNexus impact summary, and verification results.
