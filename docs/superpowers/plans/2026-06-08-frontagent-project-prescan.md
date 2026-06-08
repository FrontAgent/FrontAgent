# FrontAgent Project Pre-Scan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the duplicated `planOnly`/`execute` project preparation scan into a shared helper without changing public FrontAgent APIs, result shapes, memory lifecycle, facts flushing, planning retry, or callback ordering.

**Architecture:** Keep `FrontAgent` as the orchestrator and add `packages/core/src/agent/project-prescan-preparation.ts` as a narrow helper for project structure scanning, config pre-read, dev server port detection, and RAG retrieval. `planOnly` and `execute` continue to emit the same status labels in the same order by passing `emitStatus` and RAG event emission through the helper dependencies.

**Tech Stack:** TypeScript, Vitest, existing `Executor.callTool`, `detectDevServerPort`, and `retrieveRagContext`.

---

**GitNexus impact before code edits:**
- `npx gitnexus impact planOnly --direction upstream --file packages/core/src/agent/agent.ts --kind Method --include-tests --repo /Users/ceilf6/.config/superpowers/worktrees/FrontAgent-app/improve-frontagent-project-prescan`: LOW; 0 direct callers, 0 affected processes, 0 affected modules.
- `npx gitnexus impact execute --direction upstream --file packages/core/src/agent/agent.ts --kind Method --include-tests --repo /Users/ceilf6/.config/superpowers/worktrees/FrontAgent-app/improve-frontagent-project-prescan`: LOW; 0 direct callers, 0 affected processes, 0 affected modules.
- `npx gitnexus impact detectDevServerPort --direction upstream --file packages/core/src/agent/dev-server-detection.ts --kind Function --include-tests --repo /Users/ceilf6/.config/superpowers/worktrees/FrontAgent-app/improve-frontagent-project-prescan`: LOW; direct callers are `FrontAgent.planOnly`, `FrontAgent.execute`, and `dev-server-detection.test.ts`; affected process groups include `planOnly` and `execute`.
- `npx gitnexus context FrontAgent --file packages/core/src/agent/agent.ts --repo /Users/ceilf6/.config/superpowers/worktrees/FrontAgent-app/improve-frontagent-project-prescan`: `FrontAgent` is imported by `packages/core/src/agent/index.ts` and `packages/core/src/agent/agent.test.ts`, and constructed by `createAgent`.
- `npx gitnexus query "FrontAgent execute planOnly project prescan RAG context" --repo /Users/ceilf6/.config/superpowers/worktrees/FrontAgent-app/improve-frontagent-project-prescan`: query surfaced the agent/context/RAG area; this supports treating the change as agent-core risk even though symbol-level impact is LOW.

### Task 1: Shared Pre-Scan Helper

**Files:**
- Create: `packages/core/src/agent/project-prescan-preparation.ts`
- Create: `packages/core/src/agent/project-prescan-preparation.test.ts`
- Modify: `packages/core/src/agent/agent.ts`

- [ ] **Step 1: Write the failing helper test**

Create a Vitest test that imports `prepareProjectPlanningContext`, stubs `executor.callTool`, `detectDevServerPort` through real behavior, and verifies:
- status order stays `扫描项目结构`, `检测开发服务器端口`, `检索知识库`;
- `list_directory` excludes `node_modules` and `.git` files from `projectStructure`;
- package/vite config contents are read and passed into port detection;
- RAG formatted results and event payload are returned.

Run: `pnpm --filter @frontagent/core test -- src/agent/project-prescan-preparation.test.ts`
Expected: FAIL because `project-prescan-preparation.ts` does not exist.

- [ ] **Step 2: Implement the helper**

Add `prepareProjectPlanningContext(deps, input)` that:
- emits the existing status labels and operation strings;
- calls `list_directory` recursively at `projectRoot`;
- builds the same `项目文件列表（共 N 个文件）` string;
- reads `package.json` and `vite.config*` files best-effort;
- calls `detectDevServerPort`;
- calls `retrieveRagContext`;
- returns `{ projectStructure, devServerPort, ragResults, ragEvent }`.

Preserve existing debug warnings by accepting a `preScanFailureLabel` string so `planOnly` keeps `[Agent] Failed to pre-scan project structure for plan-only:` and `execute` keeps `[Agent] Failed to pre-scan project structure:`.

- [ ] **Step 3: Replace duplicated orchestration**

In `FrontAgent.planOnly` and `FrontAgent.execute`, replace the duplicated scan/read/port/RAG block with one `prepareProjectPlanningContext` call. Keep the planner input fields unchanged, and continue to emit `rag_retrieved` only when `config.rag?.enabled !== false`.

- [ ] **Step 4: Verify focused tests**

Run:
`pnpm --filter @frontagent/core test -- src/agent/project-prescan-preparation.test.ts src/agent/agent.test.ts src/agent/context-gathering.test.ts`

### Task 2: Final Gates and Review

**Files:**
- Modify: implementation and test files from Task 1

- [ ] **Step 1: Typecheck**

Run: `pnpm --filter @frontagent/core typecheck`

- [ ] **Step 2: Precommit gate**

Run: `pnpm quality:precommit`

- [ ] **Step 3: GitNexus final diff**

Run: `npx gitnexus detect_changes --repo /Users/ceilf6/.config/superpowers/worktrees/FrontAgent-app/improve-frontagent-project-prescan`

- [ ] **Step 4: PR**

Push `improve/frontagent-project-prescan` and open a PR to `develop`. The PR body must include `Closes #231`, a GitNexus Impact Summary with `detect_changes`, verification commands, and note that this is not a critical skeleton rewrite beyond extracting shared helper logic.
