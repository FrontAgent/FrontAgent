# ContextManager Filesystem Facts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract `ContextManager.updateFileSystemFacts` low-level filesystem fact mutation into a focused helper while preserving the public facade and behavior.

**Architecture:** Keep `ContextManager.updateFileSystemFacts(taskId, toolName, params, result)` as the public API and revision-bump owner. Add `packages/core/src/context/filesystem-facts-update.ts` with a pure mutating helper that receives `ProjectFacts`, tool metadata, and tool result, returning whether facts changed. The helper owns filesense deltas, filesense index enrichment, file/list/search tool-result contracts, and set/map mutation semantics.

**Tech Stack:** TypeScript, Vitest, existing `ProjectFacts` types and context helper utilities.

---

### Task 1: Focused Helper Contract Test

**Files:**
- Modify: `packages/core/src/context/context-manager.test.ts`
- Create later: `packages/core/src/context/filesystem-facts-update.ts`

- [ ] **Step 1: Add a failing helper-level test**

Add an import:

```ts
import { updateFilesystemFactsFromToolResult } from './filesystem-facts-update.js';
```

Add this test in `describe('updateFileSystemFacts', ...)`:

```ts
it('keeps filesystem helper mutations independent from revision bumping', () => {
  const manager = new ContextManager();
  const context = manager.createContext(makeTask({ id: 't1' }));

  const changed = updateFilesystemFactsFromToolResult(context.facts, 'search_code', {}, {
    success: true,
    files: ['src/app.ts'],
  });

  expect(changed).toBe(true);
  expect(context.facts.filesystem.existingFiles.has('src/app.ts')).toBe(true);
  expect(context.facts.filesystem.existingDirectories.has('src')).toBe(true);
  expect(context.facts.revision).toBe(0);
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
pnpm --filter @frontagent/core test -- src/context/context-manager.test.ts
```

Expected: FAIL because `./filesystem-facts-update.js` does not exist yet.

### Task 2: Extract Filesystem Facts Helper

**Files:**
- Create: `packages/core/src/context/filesystem-facts-update.ts`
- Modify: `packages/core/src/context/context-manager.ts`

- [ ] **Step 1: Create the helper module**

Move the existing low-level filesystem fact mutation logic into:

```ts
export function updateFilesystemFactsFromToolResult(
  facts: ProjectFacts,
  toolName: string,
  params: Record<string, unknown>,
  result: { success?: boolean; error?: string; [key: string]: unknown },
): boolean
```

Use helper-local `addToSet`, `removeFromSet`, and `setStringArrayMap` functions with the same semantics currently used by `ContextManager.updateFileSystemFacts`.

- [ ] **Step 2: Keep the ContextManager facade**

Replace the body of `ContextManager.updateFileSystemFacts` after context lookup with:

```ts
if (updateFilesystemFactsFromToolResult(context.facts, toolName, params, result)) {
  this.bumpFactsRevision(context.facts);
}
```

Do not rename `ContextManager.updateFileSystemFacts` and do not change its parameters or return type.

- [ ] **Step 3: Run focused tests**

Run:

```bash
pnpm --filter @frontagent/core test -- src/context/context-manager.test.ts
```

Expected: PASS.

### Task 3: Verification and PR Prep

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run required checks**

Run:

```bash
pnpm --filter @frontagent/core typecheck
npx gitnexus detect_changes --scope all --repo FrontAgent
```

Expected: typecheck exits 0; `detect_changes` reports only the plan, context manager facade, helper module, and focused test scope.

- [ ] **Step 2: Run broader gate if needed**

Because this touches core context fact propagation, run:

```bash
pnpm quality:precommit
```

Expected: exits 0.

- [ ] **Step 3: Open PR**

Push `improve/contextmanager-filesystem-facts` and open a PR to `develop` with `Closes #233` and a GitNexus Impact Summary containing:

```md
Risk level:
Critical skeleton changes:
GitNexus impact:
Verification:
```

Use `detect_changes` with an underscore in the PR body.
