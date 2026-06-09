# Executor Tool-Call Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose `Executor.callTool` security, MCP invocation, and result classification into a focused internal helper while preserving public `Executor` APIs and security semantics.

**Architecture:** Keep `Executor.callTool(toolName, args)` as the public coordinator. Add an internal executor helper beside `executor.ts` that owns client lookup, security evaluation/emission, approval handling, MCP invocation, duration annotation, and tool-result success classification. `Executor` remains responsible for tool/client registration and browser URL state updates.

**Tech Stack:** TypeScript, Vitest, GitNexus, existing `SecurityManager`, existing `MCPClient` and `ExecutorConfig` types.

---

## GitNexus Impact

- `callTool`: LOW risk; 3 direct callers (`executeStep`, `validateBeforeExecution`, `rollback`), 2 affected process groups.
- `enforceSecurity`: HIGH risk; direct caller `callTool`, affected `callTool`, `executeStep`, and `rollback` flows.
- `emitSecurityDecision`: HIGH risk; direct caller `enforceSecurity`, affected security emission and rollback flows.
- `isSuccessfulToolResult`: HIGH risk; direct caller `callTool`, affected `callTool`, `executeStep`, and `rollback` flows.
- User has explicitly authorized continuing when HIGH/CRITICAL impact appears; tests must lock down security decision semantics before refactoring.

## Files

- Create: `packages/core/src/executor/tool-call-handler.ts`
- Modify: `packages/core/src/executor/executor.ts`
- Modify: `packages/core/src/executor/executor.test.ts`
- Create: this plan file

## Tasks

### Task 1: Focused Tool-Call Tests

- [ ] Add executor tests for approved security requests preserving emitted decisions and approved args.
- [ ] Add executor tests for non-interactive ask decisions returning the existing security-denied result shape.
- [ ] Add executor tests for browser navigation URL updates only when tool result is successful.
- [ ] Run focused executor tests and verify the new helper-oriented coverage fails before implementation where behavior is not directly observable.

### Task 2: Extract Helper

- [ ] Create `tool-call-handler.ts` with an internal `ExecutorToolCallHandler` class.
- [ ] Move security evaluation, audit emission, approval fallback, MCP client invocation, duration annotation, and success classification into the helper without changing result schemas.
- [ ] Keep `Executor.callTool` public and delegate to the helper using existing maps and config.
- [ ] Keep `Executor` responsible for assigning `currentBrowserUrl` from successful `browser_navigate`/`navigate` calls.

### Task 3: Verification And PR

- [ ] Run focused executor tests.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm quality:precommit`.
- [ ] Run `npx gitnexus detect-changes --scope all --repo <current-worktree>`.
- [ ] Open a PR to `develop` with `Closes #242` and a concrete GitNexus Impact Summary.
- [ ] Monitor repo-guard/CI feedback for up to 5 minutes and apply specific actionable fixes.
