# Split Planner Phase Helpers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract Planner repository phase construction/injection helpers into a focused helper module without changing Planner public API or generated plan behavior.

**Architecture:** Keep `Planner.plan()` and `createPlanner()` unchanged. Move repository-management phase detection, acceptance-step collection, and repository step construction into `packages/core/src/planner-phase-helpers.ts`, with `Planner` passing its existing `createStep()` factory into the helper.

**Tech Stack:** TypeScript, Vitest, GitNexus CLI, pnpm workspace scripts.

---

### Task 1: Add Focused Helper Regression Tests

**Files:**
- Create: `packages/core/src/planner-phase-helpers.test.ts`
- Read: `packages/core/src/planner.test.ts`

- [x] **Step 1: Write failing extraction tests**

Add helper-level tests for repository-management phase injection, query-task skip behavior, and duplicate repository-phase skip behavior.

- [x] **Step 2: Run focused test and verify RED**

Run: `pnpm --dir packages/core test src/planner-phase-helpers.test.ts`
Expected: FAIL because `./planner-phase-helpers.js` does not exist yet.

### Task 2: Extract Phase Construction Helpers

**Files:**
- Create: `packages/core/src/planner-phase-helpers.ts`
- Modify: `packages/core/src/planner.ts`
- Test: `packages/core/src/planner-phase-helpers.test.ts`, `packages/core/src/planner.test.ts`

- [x] **Step 1: Create helper module**

Implement `injectRepositoryManagementPhase(task, steps, stepFactory)` plus local helper functions for code-change detection, duplicate repository phase detection, acceptance-step detection, and repository-management step construction. Copy command strings exactly from `Planner` to preserve output behavior.

- [x] **Step 2: Wire Planner to helper**

Import `injectRepositoryManagementPhase` from `./planner-phase-helpers.js`. Replace the constructor callback with `injectRepositoryManagementPhase(task, steps, { createStep: (options) => this.createStep(options) })`, and remove the moved private helper methods from `Planner`.

- [x] **Step 3: Run focused tests and verify GREEN**

Run: `pnpm --dir packages/core test src/planner-phase-helpers.test.ts src/planner.test.ts`
Expected: PASS.

### Task 3: Final Verification and PR

**Files:**
- Read: final git diff only.

- [x] **Step 1: Run required verification gates**

Run: `pnpm --dir packages/core test src/planner-phase-helpers.test.ts src/planner.test.ts`
Expected: PASS.

Run: `pnpm typecheck`
Expected: PASS.

Run: `pnpm quality:precommit`
Expected: PASS or document exact failure.

Run: `npx gitnexus detect-changes --repo /Users/ceilf6/Desktop/myrepos/Wiki/AI/3-Application/FrontAgent-app`
Expected: scoped changes in Planner and the new planner phase helper/test files.

- [ ] **Step 2: Create PR**

Push branch `improve/split-planner-phase-helpers` and open a PR to `develop` with `Closes #192` in the body.
