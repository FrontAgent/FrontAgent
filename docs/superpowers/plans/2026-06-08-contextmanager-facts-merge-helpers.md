# ContextManager Facts Merge Helpers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract `ContextManager` facts update merge and snapshot replacement clone mechanics into a focused helper module without changing public APIs or serialized shapes.

**Architecture:** `ContextManager` remains the public task-scoped facade. A new context-local helper module owns `ProjectFacts` snapshot export, snapshot materialization, and `ProjectFactsUpdate` mutation logic using the existing `ProjectFacts`, `ProjectFactsSnapshot`, and `ProjectFactsUpdate` types.

**Tech Stack:** TypeScript, Vitest, pnpm workspace, GitNexus.

---

## Impact And Risk

- GitNexus impact before edits:
  - `ContextManager` class: CRITICAL, 23 impacted symbols, 12 direct, 5 affected Agent processes (`planOnly`, `execute`, `enqueueFactsUpdate`, `executeSteps`, `constructor`).
  - `exportFactsSnapshot`: LOW, 0 impacted symbols.
  - `mergeFactsUpdate`: LOW, 2 impacted symbols; direct caller `FrontAgent.flushFactsUpdates`; affected process `enqueueFactsUpdate`.
  - `replaceFactsFromSnapshot`: LOW, 0 impacted symbols.
  - private set/mapping helpers: LOW; direct users include existing ContextManager facts methods.
- Risk handling: keep `ContextManager` public methods and external types unchanged; only delegate existing logic to helper functions.

## Files

- Create: `packages/core/src/context/facts-merge-helpers.ts`
- Modify: `packages/core/src/context/context-manager.ts`
- Modify: `packages/core/src/context/context-manager.test.ts`

## Tasks

- [x] Add focused tests that assert exported snapshots and replaced facts are independent deep clones for module arrays, directory contents, and errors.
- [x] Add focused tests that assert merged `ProjectFactsUpdate` clones mutable arrays/errors from the update payload and reports unchanged updates without revision bumps.
- [x] Run focused context tests to confirm any new regression-focused assertions fail before helper extraction if they expose currently under-specified behavior.
- [x] Implement `exportProjectFactsSnapshot`, `projectFactsFromSnapshot`, and `mergeProjectFactsUpdate` in `facts-merge-helpers.ts`.
- [x] Replace low-level facts merge/snapshot logic in `ContextManager` with helper delegation while preserving unknown-task behavior.
- [x] Run focused tests: `pnpm --filter @frontagent/core test -- src/context/context-manager.test.ts src/context/fact-serializer.test.ts`.
- [x] Run typecheck: `pnpm --filter @frontagent/core typecheck`.
- [x] Run `pnpm quality:precommit` because `packages/core/src/context/` is an agent-core critical skeleton path.
- [x] Run `npx gitnexus detect_changes --scope staged` and include the output summary in the PR body.
