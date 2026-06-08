# Executor executeStep Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose one focused trace lifecycle boundary out of `Executor.executeStep` while preserving executor behavior and public APIs.

**Architecture:** Extract trace stage timing and final trace emission into an internal `StepTraceRecorder` helper under `packages/core/src/executor/`. Keep `executeStep` responsible for validation, tool preparation, tool invocation, output shaping, rollback decisions, and LangGraph/native execution wiring.

**Tech Stack:** TypeScript, Vitest, GitNexus, pnpm workspace scripts.

---

## GitNexus Blast Radius

- Target: `Method:packages/core/src/executor/executor.ts:Executor.executeStep#2`
- Risk level: LOW
- Direct dependents: indexed `executeStep` self-flow, `packages/core/src/executor/executor.test.ts`, `packages/core/src/security.test.ts`
- Affected process groups: `ExecuteStep -> Builtin`, `ExecuteStep -> EmitSecurityDecision`, `ExecuteStep -> DebugLog`, `ExecuteStep -> NowMs`, `ExecuteStep -> IsSuccessfulToolResult`, `ExecuteStep -> IsTraceEnabled`, `ExecuteStep -> ValidateStepParams`
- Decision: proceed with a trace-only helper extraction; do not touch security approval, action skill semantics, rollback, LangGraph execution, or public executor APIs.

### Task 1: Pin Trace Helper Behavior

**Files:**
- Modify: `packages/core/src/executor/trace.test.ts`
- Create: `packages/core/src/executor/step-trace-recorder.ts`

- [ ] **Step 1: Write failing tests**

Add tests that import `createStepTraceRecorder` from `./step-trace-recorder.js`, verify a skipped output emits the same trace payload shape, and verify `withStage` records failed stage errors.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @frontagent/core test -- src/executor/trace.test.ts`
Expected: FAIL because `step-trace-recorder.js` does not exist.

- [ ] **Step 3: Implement helper**

Create `packages/core/src/executor/step-trace-recorder.ts` with `finish`, `withStage`, `addSubStage`, and `markCatchIfEmpty` methods. Keep timing injected through `nowMs` so `Executor` preserves its current monotonic timing behavior.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm --filter @frontagent/core test -- src/executor/trace.test.ts`
Expected: PASS.

### Task 2: Wire Executor To Helper

**Files:**
- Modify: `packages/core/src/executor/executor.ts`
- Test: `packages/core/src/executor/executor.test.ts`
- Test: `packages/core/src/executor/trace.test.ts`

- [ ] **Step 1: Replace inline trace lifecycle**

In `executeStep`, replace local `traceEnabled`, `traceStartedAt`, `traceStages`, `subStages`, `finish`, and `withStage` closures with `const trace = createStepTraceRecorder(...)`.

- [ ] **Step 2: Preserve call sites**

Use `trace.withStage(...)`, `trace.addSubStage(...)`, `trace.markCatchIfEmpty(...)`, and `trace.finish(...)` at the existing orchestration points. Do not move validation, tool call, post-validation, rollback, or security logic.

- [ ] **Step 3: Run focused verification**

Run: `pnpm --filter @frontagent/core test -- src/executor/executor.test.ts src/executor/trace.test.ts`
Expected: PASS.

- [ ] **Step 4: Run typecheck**

Run: `pnpm --filter @frontagent/core typecheck`
Expected: PASS.

### Task 3: Final Gates And PR

**Files:**
- Modify: `.github` only if PR tooling requires body template discovery; otherwise no source changes.

- [ ] **Step 1: Run broader gate**

Run: `pnpm quality:precommit`
Expected: PASS.

- [ ] **Step 2: Inspect final impact**

Run: `npx gitnexus detect_changes --repo "/Users/ceilf6/.config/superpowers/worktrees/FrontAgent-app/improve-executor-executestep-orchestration"`
Expected: changed symbols limited to executor trace helper, `Executor.executeStep`, tests, and this plan.

- [ ] **Step 3: Open PR**

Create a PR to `develop` with `Closes #222` and a GitNexus Impact Summary containing `Risk level`, `Critical skeleton changes`, `GitNexus impact`, and `Verification`.
