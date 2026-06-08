# Reduce Executor Step Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce `Executor` class size by extracting the LangGraph step-feedback execution path while keeping public behavior stable.

**Architecture:** Move the private LangGraph phase graph construction and invocation into a focused helper beside the executor. `Executor.executeStepsWithErrorFeedback` remains the public entry point and delegates to the helper only when the LangGraph engine is selected.

**Tech Stack:** TypeScript, Vitest, LangGraph, existing executor phase-ordering and phase-runner contracts.

---

### Task 1: Extract LangGraph Feedback Runner

**Files:**
- Create: `packages/core/src/executor/step-feedback-runner.ts`
- Create: `packages/core/src/executor/step-feedback-runner.test.ts`
- Modify: `packages/core/src/executor/executor.ts`

- [ ] **Step 1: Write the failing helper test**

Add a Vitest test that imports `executeStepsWithErrorFeedbackViaLangGraph` from `step-feedback-runner.ts`, passes two independent steps, and verifies the injected `executeSinglePhaseWithRecovery` callback receives a phase group and returns accumulated results.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm --filter @frontagent/core test -- packages/core/src/executor/step-feedback-runner.test.ts`

Expected: FAIL because `packages/core/src/executor/step-feedback-runner.ts` does not exist yet.

- [ ] **Step 3: Move the LangGraph implementation**

Create `step-feedback-runner.ts` with the LangGraph-specific implementation currently inside `Executor.executeStepsWithErrorFeedbackViaLangGraph`. Keep callback signatures and `LangGraphRuntimeState` serialization unchanged.

- [ ] **Step 4: Delegate from Executor**

Remove the private `executeStepsWithErrorFeedbackViaLangGraph` method from `executor.ts`, import the helper, and call it from `executeStepsWithErrorFeedback` with the existing callbacks, config, and `executeSinglePhaseWithRecovery` delegate.

- [ ] **Step 5: Verify GREEN**

Run: `pnpm --filter @frontagent/core test -- packages/core/src/executor/step-feedback-runner.test.ts packages/core/src/executor/executor.test.ts`

Expected: PASS.

- [ ] **Step 6: Broaden verification**

Run: `pnpm typecheck`, `npx gitnexus detect-changes --scope all --repo FrontAgent`, and `pnpm quality:precommit`.

Expected: all commands exit 0, and detect_changes reports only the executor feedback helper, executor delegation, focused tests, and this plan.
