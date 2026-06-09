# Runtime MCP Tool Handler Helpers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract shared runtime MCP run/plan tool invocation setup without changing public MCP tools, payloads, or error behavior.

**Architecture:** Keep the public `createFrontAgentMcpServer` dispatch table in `packages/runtime-node/src/mcp-server.ts`, but move the duplicated run/plan setup into a private helper in the same module. Reuse existing `toRuntimeInput`, `toRunOptions`, `collectSecurityDecisions`, and response shaping so tool schemas and output fields remain stable.

**Tech Stack:** TypeScript, MCP SDK request handlers, Vitest contract tests, GitNexus impact checks.

---

### Task 1: Lock Existing MCP Run/Plan Behavior

**Files:**
- Modify: `packages/runtime-node/src/mcp-server.test.ts`

- [x] Add focused tests for `frontagent_run_task` and `frontagent_plan_task` that assert the existing payload fields, `isError` behavior, run log path propagation, and security decision collection.
- [x] Run `pnpm --filter @frontagent/runtime-node test -- mcp-server.test.ts` and confirm the tests pass before refactoring, proving the expected behavior is already covered.

### Task 2: Extract Shared Run/Plan Invocation Setup

**Files:**
- Modify: `packages/runtime-node/src/mcp-server.ts`

- [x] Add a private helper that creates `events`, `securityDecisions`, `runLogPathRef`, normalized runtime input, sampling/direct backend, and `RunFrontAgentTaskOptions`.
- [x] Replace the duplicated setup in `frontagent_run_task` and `frontagent_plan_task` with the helper.
- [x] Preserve the two tool-specific result payloads exactly: run returns `executedStepsSummary`; plan returns `plan`; both keep `success`, `taskId`, `error`, `duration`, `runLogPath`, `securityDecisions`, and `isError = !result.success`.

### Task 3: Verify And Prepare PR

**Files:**
- Modify: `docs/superpowers/plans/2026-06-08-runtime-mcp-tool-handler-helpers.md`

- [x] Run `pnpm --filter @frontagent/runtime-node test`.
- [x] Run `pnpm --filter @frontagent/runtime-node typecheck`.
- [x] Run `pnpm quality:precommit`; if it fails due unrelated pre-existing authority/GitNexus document drift, record that explicitly and verify target commands still pass.
- [x] Run `npx gitnexus detect-changes --scope compare --base-ref origin/develop` and include the result in the PR impact summary.
- [ ] Open a PR to `develop` with `Closes #211`, GitNexus impact summary, verification evidence, and unchanged public MCP API note.
