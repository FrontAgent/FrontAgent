# ContextManager Module Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the module dependency graph update logic from `ContextManager` while preserving its public API and behavior.

**Architecture:** Keep `ContextManager.updateModuleDependencyGraph` as the public entrypoint and delegate graph mutation to a focused helper in `packages/core/src/context/module-dependency-graph.ts`. The helper owns parsing module metadata, dependency resolution, and reverse dependency cleanup for successful file mutations.

**Tech Stack:** TypeScript, Vitest, existing context helper functions.

---

### Task 1: Extract Module Graph Update Helper

**Files:**
- Create: `packages/core/src/context/module-dependency-graph.ts`
- Modify: `packages/core/src/context/context-manager.ts`
- Test: `packages/core/src/context/module-dependency-graph.test.ts`

- [ ] Add `updateModuleDependencyGraphFromToolResult` that accepts a `ModuleDependencyGraph`, tool name, params, and result, returning `true` when the graph changed.
- [ ] Move the current create/apply_patch success filtering, JS/TS path filtering, import/export parsing, dependency resolution, module upsert, dependency replacement, and reverse dependency cleanup into the helper.
- [ ] Replace the body of `ContextManager.updateModuleDependencyGraph` with helper delegation and call `bumpFactsRevision` only when the helper returns `true`.
- [ ] Add focused tests for unchanged non-code/failed tool results and reverse dependency replacement on repeated module updates.
- [ ] Run `pnpm exec vitest run packages/core/src/context/module-dependency-graph.test.ts packages/core/src/context/context-manager.test.ts` and `pnpm typecheck`.
