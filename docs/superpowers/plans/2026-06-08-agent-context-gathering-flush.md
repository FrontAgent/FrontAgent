# Agent Context Gathering Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the context gathering responsibility from `FrontAgent.gatherContext` into a focused agent helper while preserving public API and task execution behavior.

**Architecture:** Keep `FrontAgent` as the orchestrator and move request dispatch for `read_file`, `get_page`, and `rag_query` into `packages/core/src/agent/context-gathering.ts`. `FrontAgent.gatherContext` will remain private and delegate to the helper so existing `execute` and `planOnly` control flow does not change.

**Tech Stack:** TypeScript, Vitest, existing `ContextManager`, `Executor.callTool`, and RAG retrieval helpers.

---

### Task 1: Add Focused Context Gathering Helper Tests

**Files:**
- Create: `packages/core/src/agent/context-gathering.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests that call `gatherRequestedContext` with fake dependencies and verify:
- `read_file` successful results call `contextManager.addFile(taskId, path, content)`.
- `get_page` calls `browser_navigate` before `get_page_structure`, then calls `contextManager.setPageStructure`.
- `rag_query` calls `rag_query` with the normalized query and stores formatted RAG results.
- A thrown tool error calls `debugWarn` and does not stop later requests.

- [ ] **Step 2: Run focused test to verify RED**

Run: `pnpm --filter @frontagent/core test -- src/agent/context-gathering.test.ts`
Expected: FAIL because `context-gathering.ts` and `gatherRequestedContext` do not exist yet.

### Task 2: Extract Helper and Delegate from FrontAgent

**Files:**
- Create: `packages/core/src/agent/context-gathering.ts`
- Modify: `packages/core/src/agent/agent.ts`

- [ ] **Step 1: Implement `gatherRequestedContext`**

Create a helper that accepts `taskId`, `requests`, `executor`, `contextManager`, `ragDeps`, and `debugWarn`. Move the existing switch body from `FrontAgent.gatherContext` without changing request semantics.

- [ ] **Step 2: Delegate `FrontAgent.gatherContext`**

Import `gatherRequestedContext` in `agent.ts` and replace the private method body with a single helper call using existing dependencies.

- [ ] **Step 3: Run focused tests**

Run: `pnpm --filter @frontagent/core test -- src/agent/context-gathering.test.ts src/agent/agent.test.ts`
Expected: PASS.

### Task 3: Verify Scope and Gates

**Files:**
- Modify only files listed above.

- [ ] **Step 1: Run core tests**

Run: `pnpm --filter @frontagent/core test`
Expected: PASS.

- [ ] **Step 2: Run final quality gate**

Run: `pnpm quality:precommit`
Expected: PASS.

- [ ] **Step 3: Inspect GitNexus diff impact**

Run: `npx gitnexus detect-changes --scope compare --base-ref develop --repo FrontAgent-issue212`
Expected: changed symbols limited to agent context gathering helper and `FrontAgent.gatherContext`.
