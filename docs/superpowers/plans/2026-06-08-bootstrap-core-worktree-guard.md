# Bootstrap Core Worktree Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fail agent bootstrap and local contract checks when Git resolves the repository root to a different workspace than the current one.

**Architecture:** Add a small guard in `scripts/workflows/contract-check.mjs` before bootstrap hook installation and before GitNexus local/CI contract analysis. The guard compares the current workspace root with `git rev-parse --show-toplevel` and optional `git config --get core.worktree`, then throws a clear repair-oriented error on mismatch.

**Tech Stack:** Node.js ESM, `node:child_process`, `node:test`, Git CLI.

---

### Task 1: Add Workflow Coverage

**Files:**
- Modify: `scripts/tests/workflow-rules.test.mjs`

- [x] Add a normal-case test for matching workspace root, Git toplevel, and `core.worktree`.
- [x] Add a mismatch test that verifies the failure includes the current workspace path, Git-resolved path, `core.worktree`, and a repair hint.
- [x] Run `pnpm test:workflows` and confirm the new tests fail before implementation.

### Task 2: Add Bootstrap/Contract Guard

**Files:**
- Modify: `scripts/workflows/contract-check.mjs`

- [x] Export a testable workspace-root guard with injectable Git output.
- [x] Call it at the start of `runBootstrap()`.
- [x] Call it at the start of `runGitNexusContract()`.
- [x] Keep the change scoped to the workflow script and tests.

### Task 3: Verify and Prepare PR

**Files:**
- Modify: `scripts/tests/workflow-rules.test.mjs`
- Modify: `scripts/workflows/contract-check.mjs`

- [x] Run `pnpm test:workflows`, `pnpm agent:bootstrap`, `pnpm quality:predev`, and `pnpm quality:precommit`.
- [x] Run `npx gitnexus detect_changes --repo <current-worktree> --scope compare --base-ref develop`.
- [ ] Open a PR to `develop` with `Closes #209` and a GitNexus impact summary.
