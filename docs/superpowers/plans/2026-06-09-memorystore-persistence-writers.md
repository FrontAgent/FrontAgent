# MemoryStore Persistence Writers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract `MemoryStore` persistence writer logic into a focused internal helper while preserving public `MemoryStore.persist()` behavior and all on-disk memory formats.

**Architecture:** Keep `MemoryStore` as the public single-writer entry and filesystem owner. Move pure topic/index/gateway payload construction into `packages/core/src/memory/persistence-writers.ts`, so `store.ts` still performs reads/writes, error isolation, and gateway capture timing.

**Tech Stack:** TypeScript, Vitest, existing `packages/core` memory types.

---

## Blast Radius

- `MemoryStore.persist`: LOW. Direct upstream: `packages/core/src/memory/store.test.ts`; affected processes: none.
- `persistGateway`: LOW. Direct upstream: `MemoryStore.persist`; second-order: `store.test.ts`; affected processes: none.
- `persistProjectStructure`: LOW. Direct upstream: `MemoryStore.persist`; second-order: `store.test.ts`; affected processes: none.
- `persistDependencies`: LOW. Direct upstream: `MemoryStore.persist`; second-order: `store.test.ts`; affected processes: none.
- `persistErrors`: LOW. Direct upstream: `MemoryStore.persist`; second-order: `store.test.ts`; affected processes: none.
- `rebuildIndex`: LOW. Direct upstream: `MemoryStore.persist`; second-order: `store.test.ts`; affected processes: none.

## Files

- Create: `packages/core/src/memory/persistence-writers.ts`
- Modify: `packages/core/src/memory/store.ts`
- Modify: `packages/core/src/memory/store.test.ts`

## Tasks

- [ ] Add focused tests in `store.test.ts` that assert persistence writes include project structure, dependencies, errors, facts snapshot, rebuilt index, and Gateway draft content after helper extraction.
- [ ] Run `pnpm --dir packages/core exec vitest run src/memory/store.test.ts` and confirm the new helper import path fails before implementation.
- [ ] Create `persistence-writers.ts` with pure functions for project structure topic, dependencies topic, errors topic, memory index, gateway capture text, and file path tags.
- [ ] Update `MemoryStore.persist()` to delegate construction to the helper while retaining `writeFactsSnapshot`, `loadTopic`, `writeTopic`, `writeIndex`, local persistence error swallowing, and Gateway capture after the local try/catch.
- [ ] Run focused memory tests, then `pnpm --dir packages/core typecheck`, then `pnpm quality:precommit`.
- [ ] Run `npx gitnexus detect-changes --scope all --repo <current-worktree>` and include the result in the PR body with `Closes #241`.
