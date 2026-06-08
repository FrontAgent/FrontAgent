# Executor Progress Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract native `Executor.executeSteps` progress enforcement into a focused executor helper while preserving public API and execution behavior.

**Architecture:** Keep `Executor` responsible for public orchestration and step execution, and move dependency readiness, status transitions, callback dispatch, completed-step tracking, and rollback skipping into `packages/core/src/executor/progress-enforcement.ts`. The helper receives an `executeStep` dependency so it has no MCP, security, trace, or skills knowledge.

**Tech Stack:** TypeScript, Vitest, existing executor types from `@frontagent/shared` and `packages/core/src/types.ts`.

---

### Task 1: Lock Progress Enforcement Behavior

**Files:**
- Create: `packages/core/src/executor/progress-enforcement.test.ts`

- [ ] **Step 1: Add focused helper tests**

Create tests for dependency-ready ordering, status/result updates, callback ordering, rollback skip behavior, and missing dependency errors.

- [ ] **Step 2: Run test to verify RED**

Run: `pnpm --dir packages/core exec vitest run src/executor/progress-enforcement.test.ts`

Expected: FAIL because `packages/core/src/executor/progress-enforcement.ts` does not exist yet.

### Task 2: Extract Progress Enforcement Helper

**Files:**
- Create: `packages/core/src/executor/progress-enforcement.ts`
- Modify: `packages/core/src/executor/executor.ts`

- [ ] **Step 1: Create the helper**

Create `packages/core/src/executor/progress-enforcement.ts` with `executeStepsWithProgressEnforcement`. The helper owns the native sequential progress loop: `pendingSteps`, dependency readiness, `running`/`completed`/`failed` transitions, result assignment, callback invocation, completed-step tracking, and rollback-driven pending step skips.

- [ ] **Step 2: Delegate from Executor**

In `packages/core/src/executor/executor.ts`, import the helper and replace the body of `executeSteps` with a delegation that passes `this.executeStep`.

- [ ] **Step 3: Run focused tests**

Run: `pnpm --dir packages/core exec vitest run src/executor/progress-enforcement.test.ts src/executor/executor.test.ts`

Expected: PASS.

### Task 3: Final Verification And PR Prep

**Files:**
- Verify: `packages/core/src/executor/executor.ts`
- Verify: `packages/core/src/executor/progress-enforcement.ts`
- Verify: `packages/core/src/executor/progress-enforcement.test.ts`
- Verify: `docs/superpowers/plans/2026-06-08-executor-progress-enforcement.md`

- [ ] **Step 1: Run executor-focused tests**

Run: `pnpm --dir packages/core exec vitest run src/executor/progress-enforcement.test.ts src/executor/executor.test.ts src/executor/phase-runner.test.ts src/executor/step-feedback-runner.test.ts`

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 3: Run precommit gate**

Run: `pnpm quality:precommit`

Expected: PASS.

- [ ] **Step 4: Inspect GitNexus final diff**

Run: `npx gitnexus detect-changes --repo /Users/ceilf6/.config/superpowers/worktrees/FrontAgent-app/improve-executor-progress-enforcement --scope all`

Expected: changed symbols are limited to executor progress helper, `Executor.executeSteps`, focused executor tests, and the plan document.
