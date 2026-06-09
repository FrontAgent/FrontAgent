# Executor Validation Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose `Executor.executeStep` validation and skip-result handling for Issue #232 without changing executor behavior.

**Architecture:** Keep all changes inside the existing executor boundary. Add private helpers in `packages/core/src/executor/executor.ts` that centralize skipped `ExecutorOutput` construction and pre-validation skip classification while leaving trace recording, tool invocation, security approval, rollback, LangGraph, and public APIs unchanged.

**Tech Stack:** TypeScript, Vitest, pnpm workspace, GitNexus contract checks.

---

## GitNexus Impact

- `npx gitnexus impact executeStep --direction upstream --repo "/Users/ceilf6/.config/superpowers/worktrees/FrontAgent-app/improve-executor-validation-handling" --kind Method --file packages/core/src/executor/executor.ts`
- Risk level: LOW.
- Blast radius: 1 direct indexed dependent, 1 affected module (`Executor`), 1 affected process group with 3 intra-executor flows: `ExecuteStep -> WithStage`, `ExecuteStep -> ValidateStepParams`, and `ExecuteStep -> Finish`.
- `npx gitnexus context --uid "Method:packages/core/src/executor/executor.ts:Executor.executeStep#2" --repo "/Users/ceilf6/.config/superpowers/worktrees/FrontAgent-app/improve-executor-validation-handling"` shows callers in executor wiring and focused executor/security tests; callees include validation helpers, `callTool`, and `StepTraceRecorder.finish`.
- Critical skeleton changes: yes, `packages/core/src/executor/executor.ts` is under the agent-core critical skeleton category. Maintainer authorization allows continuing despite critical skeleton scope.

## Files

- Modify: `packages/core/src/executor/executor.ts`
- Modify: `packages/core/src/executor/executor.test.ts`
- Verify unchanged behavior with: `packages/core/src/executor/trace.test.ts`

### Task 1: Characterize Validation Skip Outputs

- [x] **Step 1: Add focused executor tests**

Add tests in `packages/core/src/executor/executor.test.ts` under `describe('executeStep')` that assert:

```ts
expect(result.stepResult).toEqual(
  expect.objectContaining({
    success: true,
    output: {
      skipped: true,
      reason: 'read_file requires non-empty path parameter',
    },
  }),
);
expect(result.validation).toEqual({ pass: true, results: [] });
expect(result.needsRollback).toBe(false);
```

Also cover pre-execution read-file file-not-found skip preserving `exists: false`.

- [x] **Step 2: Run focused tests before refactor**

Run: `pnpm --filter @frontagent/core test -- src/executor/executor.test.ts`

Expected: PASS, because these are behavior-preserving characterization tests for a refactor.

### Task 2: Extract Skip Result Helpers

- [x] **Step 1: Add private helper types and methods in executor**

In `packages/core/src/executor/executor.ts`, add helpers equivalent to:

```ts
private buildSkippedStepOutput(
  reason: string | undefined,
  startTime: number,
  options: { exists?: false } = {},
): ExecutorOutput {
  return {
    stepResult: {
      success: true,
      output: { skipped: true, reason, ...options },
      duration: Date.now() - startTime,
    },
    validation: { pass: true, results: [] },
    needsRollback: false,
  };
}

private getPreValidationSkipReason(step: ExecutionStep, validation: ValidationResult): { reason: string; exists?: false } | undefined {
  const reason = validation.blockedBy?.join('; ') || '';
  const isDirectoryError = reason.includes('is not a file') || reason.includes('Not a file');
  const isFileNotExist = reason.includes('does not exist') && step.action === 'read_file';
  return isDirectoryError || isFileNotExist ? { reason, exists: false } : undefined;
}
```

- [x] **Step 2: Replace repeated skip-result construction in `executeStep`**

Use `trace.finish(this.buildSkippedStepOutput(...))` for invalid params, pre-validation skips, and skippable tool errors. Keep existing debug messages and stage order.

- [x] **Step 3: Run focused executor tests**

Run: `pnpm --filter @frontagent/core test -- src/executor/executor.test.ts`

Expected: PASS.

### Task 3: Final Verification

- [x] **Step 1: Run required focused tests**

Run: `pnpm --filter @frontagent/core test -- src/executor/executor.test.ts src/executor/trace.test.ts`

Expected: PASS.

- [x] **Step 2: Run core typecheck**

Run: `pnpm --filter @frontagent/core typecheck`

Expected: PASS.

- [x] **Step 3: Run precommit gate**

Run: `pnpm quality:precommit`

Expected: PASS.

- [x] **Step 4: Inspect final GitNexus diff**

Run: `npx gitnexus detect_changes --scope all --repo "/Users/ceilf6/.config/superpowers/worktrees/FrontAgent-app/improve-executor-validation-handling"`

Expected: Diff maps to executor validation helper/test changes only.
