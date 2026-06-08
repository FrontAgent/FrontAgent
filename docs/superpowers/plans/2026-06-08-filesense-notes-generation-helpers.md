# Filesense Notes Generation Helpers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract mcp-filesense notes generation heuristics and result building from `engine.ts` without changing public APIs or persisted output.

**Architecture:** Add a focused `engine-notes.ts` module for notes inference and `FILES.notes.json` construction. Keep `summarize`, tool schemas, query result shaping, indexing, scoring, and persisted formats unchanged.

**Tech Stack:** TypeScript, Vitest, pnpm workspace filters, GitNexus CLI.

---

## GitNexus Impact

- `buildNotesFile`: LOW risk; direct caller `summarize`; affected flows include `summarize` and `handleFilesenseTool`.
- `summarize`: LOW risk; direct callers include `engine.test.ts`, `syncAndSummarize`, and `handleFilesenseTool`.
- `inferAgentHints`: HIGH risk; flows include `buildNotesFile`, `summarize`, and `handleFilesenseTool`.
- `inferConventions`: HIGH risk; direct callers include `buildNotesFile` and `navigate`; flows include `summarize`, `navigate`, and `handleFilesenseTool`.
- `inferKeyEntrypoints`: HIGH risk; flows include `buildNotesFile`, `summarize`, and `handleFilesenseTool`.
- Maintainer authorization allows continuing despite HIGH impact. Mitigation: pure relocation, direct helper tests, package test, package typecheck, and final `detect_changes`.

## Tasks

- [ ] Add focused tests for notes helper behavior: inferred notes shape, previous-field preservation, and force overwrite.
- [ ] Create `packages/mcp-filesense/src/engine-notes.ts` with `buildNotesFile`, `inferAgentHints`, `inferConventions`, and `inferKeyEntrypoints`.
- [ ] Update `packages/mcp-filesense/src/engine.ts` imports and remove the extracted helper bodies; keep `summarize` behavior and response shape unchanged.
- [ ] Run `pnpm --filter @frontagent/mcp-filesense test`.
- [ ] Run `pnpm --filter @frontagent/mcp-filesense typecheck`.
- [ ] Run `pnpm quality:precommit` because this touches the mcp-boundary critical skeleton category.
- [ ] Run `npx gitnexus detect_changes --repo /Users/ceilf6/.config/superpowers/worktrees/FrontAgent-app/improve-filesense-notes-generation-helpers` and summarize the result in the PR.
