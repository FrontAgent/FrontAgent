# Open Memory Gateway Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Open Memory Gateway-compatible adapter so FrontAgent can persist reviewable draft memories and recall active gateway memories.

**Architecture:** Keep `MemoryStore` as FrontAgent's stable memory facade and add a small local adapter for Open Memory Gateway's Markdown storage contract. Gateway mode is opt-in via `memory.gateway.enabled`; when disabled or unavailable, existing `.frontagent/memory` preload, recall, and persistence remain the default fallback.

**Tech Stack:** TypeScript, Node `fs`/`path` APIs, Vitest, existing FrontAgent memory lifecycle.

---

### Task 1: Add Gateway Configuration And Adapter Tests

**Files:**
- Modify: `packages/core/src/memory/types.ts`
- Create: `packages/core/src/memory/open-memory-gateway.ts`
- Create: `packages/core/src/memory/open-memory-gateway.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests proving:
- `OpenMemoryGatewayAdapter.captureDraft()` writes a draft under `memory/inbox`.
- `listActive()` reads only `memory/active/*.md`.
- malformed gateway files are ignored.
- config names are `memory.gateway.enabled`, `memory.gateway.rootDir`, `memory.gateway.captureSource`, and `memory.gateway.autoApprove`.

Run: `pnpm --dir packages/core exec vitest run src/memory/open-memory-gateway.test.ts`
Expected: FAIL because the adapter does not exist.

- [ ] **Step 2: Implement adapter**

Create a synchronous adapter that writes Open Memory Gateway-compatible Markdown files with frontmatter fields: `id`, `status`, `scope`, `source`, `tags`, `createdAt`, `updatedAt`. Use `memory/inbox` for `draft` and `memory/active` for active memories.

- [ ] **Step 3: Verify adapter tests**

Run: `pnpm --dir packages/core exec vitest run src/memory/open-memory-gateway.test.ts`
Expected: PASS.

### Task 2: Wire Gateway Into MemoryStore

**Files:**
- Modify: `packages/core/src/memory/store.ts`
- Modify: `packages/core/src/memory/store.test.ts`
- Modify: `packages/core/src/memory/index.ts`

- [ ] **Step 1: Write failing MemoryStore tests**

Add tests proving:
- when `memory.gateway.enabled` is true, `persist()` captures a draft gateway memory containing task, created files, dependencies, and error resolutions.
- when active gateway memories exist, `preload()` includes them before local topic memory.
- when gateway mode is disabled, existing behavior remains unchanged.
- when gateway root is unavailable, local fallback remains non-blocking.

Run: `pnpm --dir packages/core exec vitest run src/memory/store.test.ts`
Expected: FAIL because `MemoryStore` does not use the adapter yet.

- [ ] **Step 2: Implement MemoryStore gateway integration**

Instantiate the adapter only when `memory.gateway.enabled === true`. Default `gateway.rootDir` to `projectRoot`, `gateway.captureSource` to `frontagent`, and `gateway.autoApprove` to `false`. Keep existing local topic persistence and recall behavior as fallback.

- [ ] **Step 3: Verify MemoryStore tests**

Run: `pnpm --dir packages/core exec vitest run src/memory/store.test.ts`
Expected: PASS.

### Task 3: Verify And Prepare PR

**Files:**
- Modify: `.claude/repo-evolver.local.md`

- [ ] **Step 1: Run verification**

Run:
- `pnpm --dir packages/core exec vitest run src/memory/open-memory-gateway.test.ts src/memory/store.test.ts`
- `pnpm typecheck`
- `pnpm test`
- GitNexus MCP `detect_changes` with scope `all`.

- [ ] **Step 2: Commit and PR**

Commit with `feat: integrate open memory gateway`. Push `codex/open-memory-gateway-integration` and open a PR against `develop` with `Closes #164`, explicitly documenting the config names and fallback behavior.
