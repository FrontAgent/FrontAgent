# FrontAgent Task Execution Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract focused task execution setup from `FrontAgent.execute` while preserving public APIs, emitted event sequences, planner/executor contracts, SDD behavior, and memory persistence semantics.

**Architecture:** Add an internal helper that prepares the shared task inputs, setup status emissions, memory preload, SDD system prompts, and project planning preparation currently owned inline by `FrontAgent.execute`. `FrontAgent.execute` remains the high-level coordinator for task creation, initial task event emission, planning, execution, final output, memory persistence, and cleanup.

**Tech Stack:** TypeScript, Vitest, pnpm, GitNexus CLI.

---

### Task 1: Add Focused Setup Helper

**Files:**
- Create: `packages/core/src/agent/task-execution-setup.ts`
- Modify: `packages/core/src/agent/agent.ts`
- Test: `packages/core/src/agent/task-execution-setup.test.ts`

**GitNexus Blast Radius:**
- `execute` in `packages/core/src/agent/agent.ts`: upstream direct callers 0, affected processes 0, affected modules 0, risk LOW.
- `planOnly` in `packages/core/src/agent/agent.ts`: upstream direct callers 0, affected processes 0, affected modules 0, risk LOW.
- `context execute` shows dependency on `preloadMemory`, `prepareProjectPlanningContext`, `emit`, `emitStatus`, and abort/status helpers; the helper will preserve those calls and order for the setup phase.

**Helper Scope:**
- Shared inputs: pre-created `AgentTask`, original task description, matched skill names, skill prompt context, task id, task context metadata, and context manager task context.
- Status phase: setup-only status emissions after `task_started`/initialization, covering memory-load and planning preparation labels.
- Memory phase: `memoryStore.resetSession()` and `preloadMemory(...)` only; final `persistMemory(...)` remains in `FrontAgent.execute` `finally`.
- SDD phase: constitution prompt and generated SDD prompt insertion into the context manager.
- Planning preparation phase: `prepareProjectPlanningContext(...)` invocation and `rag_retrieved` event emission.
- Non-scope: planner retry/fallback handling, executor step execution, final answer generation, memory persistence, cleanup, and tool registration methods.

- [x] **Step 1: Write failing helper tests**

Create `packages/core/src/agent/task-execution-setup.test.ts` with tests that call the helper directly using stubbed dependencies:

```ts
expect(events.map((event) => event.type)).toEqual([
  'status_update',
  'status_update',
  'status_update',
  'status_update',
  'rag_retrieved',
]);
expect(preloadMemory).toHaveBeenCalledOnce();
expect(context.collectedContext.metadata.originalTaskDescription).toBe('Use @skill-a for this');
expect(context.collectedContext.skillContext).toBe('skill prompt');
expect(context.collectedContext.matchedSkillNames).toEqual(['skill-a']);
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @frontagent/core exec vitest run src/agent/task-execution-setup.test.ts
```

Expected: FAIL because `./task-execution-setup.js` does not exist yet.

- [x] **Step 3: Implement minimal helper**

Create `packages/core/src/agent/task-execution-setup.ts` exporting `prepareTaskExecutionSetup(...)`. It should accept dependencies from `FrontAgent.execute`, perform only the setup/helper scope above, and return `{ task, context, planningPreparation, skillContext, matchedSkillNames }`.

- [x] **Step 4: Replace inline setup in `FrontAgent.execute`**

Modify `packages/core/src/agent/agent.ts` so `execute` delegates setup through `prepareTaskExecutionSetup(...)`, then keeps the existing planning, retry/fallback, execution, final answer, failure, persistence, and cleanup orchestration unchanged.

- [x] **Step 5: Verify focused behavior**

Run:

```bash
pnpm --filter @frontagent/core exec vitest run src/agent/task-execution-setup.test.ts src/agent/agent.test.ts src/agent/execution-callbacks.test.ts
```

Expected: PASS.

- [x] **Step 6: Verify contracts before PR**

Run:

```bash
pnpm typecheck
npx gitnexus detect-changes --scope all --repo /Users/ceilf6/.config/superpowers/worktrees/FrontAgent-app/improve-frontagent-task-execution-setup
pnpm quality:precommit
```

Expected: PASS, with GitNexus showing only the task execution setup helper extraction, focused test, plan file, and expected `FrontAgent.execute` impact.
