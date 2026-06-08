# Decompose FrontAgent Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract one precise FrontAgent orchestration responsibility while preserving the public API and runtime behavior.

**Architecture:** Move execute-step callback construction from `FrontAgent.executeSteps` into a focused agent helper. `FrontAgent` will still own dependencies and execution, while the helper owns callback assembly for step started, step completed, phase started, phase error, and phase complete handlers.

**Tech Stack:** TypeScript, Vitest, pnpm, GitNexus.

---

### Task 1: Extract Execute Callback Wiring

**Files:**
- Create: `packages/core/src/agent/execution-callbacks.ts`
- Create: `packages/core/src/agent/execution-callbacks.test.ts`
- Modify: `packages/core/src/agent/agent.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/agent/execution-callbacks.test.ts` with a test that calls `createExecutionCallbacks`, invokes `onStepStarted` and `onPhaseStarted`, and asserts the emitted event payloads are unchanged from the inline `FrontAgent.executeSteps` behavior.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/core/src/agent/execution-callbacks.test.ts`

Expected: FAIL because `./execution-callbacks.js` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/agent/execution-callbacks.ts` exporting `createExecutionCallbacks`. The helper should accept the existing callback dependencies, task, execution plan, execution context, validations, and optional abort signal, then return named callbacks:

```ts
{
  onStepStarted,
  onStepComplete,
  onPhaseStarted,
  onPhaseError,
  onPhaseComplete,
}
```

The helper must delegate completed/error/phase-complete behavior to the existing `createOnStepComplete`, `createOnPhaseError`, and `createOnPhaseComplete` functions.

- [ ] **Step 4: Replace inline callback construction in `agent.ts`**

Modify only `FrontAgent.executeSteps` wiring so it calls `createExecutionCallbacks(...)` and passes the returned callbacks to `executor.executeStepsWithErrorFeedback` in the same argument order.

- [ ] **Step 5: Verify focused tests**

Run:

```bash
pnpm vitest run packages/core/src/agent/execution-callbacks.test.ts packages/core/src/agent/agent.test.ts
```

Expected: PASS.

- [ ] **Step 6: Verify broader contracts**

Run:

```bash
pnpm typecheck
npx gitnexus detect-changes --repo /Users/ceilf6/.config/superpowers/worktrees/FrontAgent-app/improve-decompose-frontagent-orchestration
pnpm quality:precommit
```

Expected: PASS, with GitNexus showing only the callback helper extraction and plan/test files.
