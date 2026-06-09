# FrontAgent Facts Update Flush Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract facts update flushing from `FrontAgent` into a focused helper while preserving public API, task execution, memory persistence, and callback ordering.

**Architecture:** Keep `FrontAgent` as the orchestrator and move the pending facts update queue plus reentrant flush guard into `packages/core/src/agent/facts-update-flush.ts`. The helper receives `ContextManager` and debug logging dependencies and exposes `enqueue()` plus `reset()` so `planOnly()` and `execute()` lifecycle cleanup remains explicit.

**Tech Stack:** TypeScript, Vitest, GitNexus, pnpm workspace scripts.

---

## GitNexus Impact

- `npx gitnexus impact FrontAgent --repo <worktree> --direction upstream --depth 3 --include-tests`: LOW; direct upstream symbols are `createAgent`, `packages/core/src/agent/index.ts`, and `packages/core/src/agent/agent.test.ts`; no affected execution flows.
- `npx gitnexus impact flushFactsUpdates --repo <worktree> --direction upstream --depth 3 --include-tests`: LOW; direct caller is `enqueueFactsUpdate`; affected flows are `EnqueueFactsUpdate -> AddToSet`, `EnqueueFactsUpdate -> RemoveFromSet`, and `EnqueueFactsUpdate -> DebugLog`.
- `npx gitnexus impact mergeFactsUpdate --repo <worktree> --direction upstream --depth 3 --include-tests`: LOW; direct callers are `flushFactsUpdates` and `context-manager.test.ts`; same facts update flows are affected.
- `constructor`, `phaseCheckDeps`, `planOnly`, and `execute` disambiguated with `--file packages/core/src/agent/agent.ts --kind Method`: LOW; no upstream dependents reported.

## Tasks

### Task 1: Add focused facts flush tests

**Files:**
- Create: `packages/core/src/agent/facts-update-flush.test.ts`

- [ ] Add a test that enqueues multiple updates and verifies they are merged in order with the existing debug log message.
- [ ] Add a test that injects a nested enqueue during `mergeFactsUpdate` and verifies the helper drains the queued update after the active flush, preserving the current reentrant state-machine behavior.
- [ ] Run `pnpm --filter @frontagent/core test -- packages/core/src/agent/facts-update-flush.test.ts` and confirm it fails because the helper module does not exist yet.

### Task 2: Extract helper and wire FrontAgent

**Files:**
- Create: `packages/core/src/agent/facts-update-flush.ts`
- Modify: `packages/core/src/agent/agent.ts`

- [ ] Implement `FactsUpdateFlusher` with private `pendingFactsUpdates`, private `flushInProgress`, `enqueue(taskId, update)`, and `reset()`.
- [ ] Preserve the existing flush loop semantics: return immediately during an active flush, clear the in-progress flag in `finally`, and restart flushing when queued updates were added during the active pass.
- [ ] Replace `FrontAgent` facts queue fields and private flush methods with a `FactsUpdateFlusher` instance.
- [ ] Keep `phaseCheckDeps.enqueueFactsUpdate` as the callback boundary and call `factsUpdateFlusher.reset()` in the same lifecycle positions where queue state was previously cleared.

### Task 3: Verify scope

**Files:**
- Modify only files listed above plus this plan.

- [ ] Run the focused facts flush test.
- [ ] Run `pnpm --filter @frontagent/core test`.
- [ ] Run `pnpm --filter @frontagent/core typecheck`.
- [ ] Run `npx gitnexus detect_changes --repo <worktree>` and record affected symbols and risk.
- [ ] Run `pnpm quality:precommit` because this touches the agent-core critical skeleton.
