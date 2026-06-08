# FrontAgent OSS Harness Design

Date: 2026-06-05
Repository: `FrontAgent/FrontAgent`
Base branch: `develop`
Reference: `/Users/ceilf6/Desktop/code-tape`

## Goal

Upgrade FrontAgent's repository Harness for an open-source community workflow. The Harness should help maintainers and contributors make small, reviewable changes with clear authority docs, reproducible local gates, GitNexus impact contracts, CI verification, and structured PR self-checks.

## Context

`code-tape` provides a mature Harness pattern: authority documents, local quality gates, GitNexus contract scripts, PR templates, CODEOWNERS, workflow tests, repo-guard review, issue claim automation, progress ledgers, and auto-merge rules.

FrontAgent should borrow the engineering control loop, but not the training-camp management loop. FrontAgent is an OSS project, so the Harness must support maintainers, external contributors, forks, maintainer review, and normal GitHub collaboration. It should not introduce scoring, classroom task ownership, or automatic merge rules built around training-camp commands.

## Design Principles

1. Keep authority explicit. Contributors and agents must know which documents define expected behavior before they edit code.
2. Keep local commands predictable. A contributor should be able to run the same named gates locally that CI runs remotely.
3. Keep GitNexus useful, not ritualistic. Critical skeleton changes must include concrete impact conclusions and matching tests.
4. Keep privileged workflows conservative. Workflows triggered by fork PRs must not run untrusted code with write tokens.
5. Keep OSS friction reasonable. The Harness should guide contributors without requiring training-camp claim comments, score labels, or progress files.

## Borrowed From code-tape

FrontAgent should adopt these `code-tape` patterns, adapted to pnpm, Turbo, Biome, and the `develop` base branch:

- `agent:bootstrap` to install hooks and print the required local workflow.
- `quality:predev`, `quality:precommit`, `quality:ci`, and `quality:local` scripts.
- GitNexus contract scripts with a critical skeleton allowlist and structured impact summary validation.
- `contract-guard.yml` that checks PR body impact summaries for critical skeleton changes.
- PR template sections for changed points, impact scope, GitNexus impact, and verification.
- Issue templates for clear bug reports, feature requests, and maintenance tasks.
- CODEOWNERS protection for workflow files, Harness scripts, agent instructions, and critical architecture documents.
- Workflow tests for contract parser behavior and workflow invariants.

## Explicitly Not Borrowed

The following `code-tape` mechanisms are training-camp specific and should not be part of the FrontAgent OSS Harness:

- `认领` issue claim comments.
- `score:*`, `stack:*`, and `status:*` classroom labels as required workflow state.
- Contributor score accounting.
- `docs/progress.json` and `docs/progress.md` ledgers.
- PR author must equal issue assignee.
- Maintainer `确认合并` comments as an auto-merge trigger.
- 24-hour PR timeout close automation.
- Auto-merge workflows that decide merges without normal maintainer action.

## OSS Workflow

The target community loop is:

```text
Issue or Discussion
-> maintainer triage
-> contributor fork or branch
-> pnpm install
-> pnpm agent:bootstrap
-> pnpm quality:predev
-> focused implementation and tests
-> pnpm quality:local before pushing
-> PR to develop with structured self-check
-> CI + Contract Guard + Repo Guard + maintainer review
-> maintainer merge
```

For small trusted-maintainer changes, direct branches are acceptable. External contributions should work through forks or normal feature branches and PRs.

## Authority Layer

FrontAgent already has product and architecture docs, but agent-facing authority is thin. The Harness should add or update:

- `CONTRIBUTING.md`: OSS contributor workflow, local setup, quality gates, PR expectations, security notes, and GitNexus impact guidance.
- `docs/workflow.md`: maintainer and agent workflow contract for issue triage, branch naming, PR review, and merge expectations.
- `docs/knowledge-contract.md`: GitNexus impact contract, critical skeleton categories, structured summary format, and local/CI behavior.
- `AGENTS.md` and `CLAUDE.md`: operational instructions that point agents to authority docs, local gates, and conflict-handling rules.

Authority priority should be:

1. `README.md` for public product positioning and user-facing commands.
2. `docs/architecture.md` and `docs/design.md` for architecture and SDD behavior.
3. `docs/workflow.md` and `docs/knowledge-contract.md` for contribution and Harness rules.
4. Issue or PR text for the specific change.
5. Existing code, unless it contradicts the above documents.

When docs disagree, contributors and agents should ask maintainers instead of silently choosing a new architecture.

## Local Gate Layer

Root `package.json` should expose these scripts:

```json
{
  "prepare": "pnpm hooks:install",
  "hooks:install": "node scripts/workflows/install-hooks.mjs",
  "agent:bootstrap": "node scripts/workflows/contract-check.mjs bootstrap",
  "contract:local": "node scripts/workflows/contract-check.mjs local",
  "contract:check": "node scripts/workflows/contract-check.mjs check",
  "contract:gitnexus": "node scripts/workflows/contract-check.mjs gitnexus",
  "quality:predev": "pnpm hooks:install && pnpm contract:local",
  "test:workflows": "node --test scripts/tests/*.test.mjs",
  "quality:precommit": "pnpm lint && pnpm typecheck && pnpm test && pnpm test:workflows",
  "quality:ci": "pnpm lint && pnpm typecheck && pnpm test && pnpm test:workflows && pnpm build",
  "quality:local": "pnpm contract:local && pnpm quality:ci"
}
```

This design intentionally keeps `quality:precommit` faster than `quality:local` by leaving full build to CI/pre-push. If maintainers prefer stricter commits, `quality:precommit` can include `pnpm build`, but the initial OSS Harness should optimize for regular contributor ergonomics.

Unlike the current `code-tape` reference, the hook installer must be paired with real hook files:

- `.githooks/pre-commit` runs `pnpm quality:precommit`.
- `.githooks/pre-push` runs `pnpm quality:local`.
- Both honor `SKIP_QUALITY_HOOKS=1` for maintainer emergencies and print that CI remains authoritative.

## Knowledge Contract

Critical skeleton changes should require both matching tests and a structured GitNexus impact summary.

Initial FrontAgent critical skeleton categories:

| Category | Paths | Matching tests |
| --- | --- | --- |
| agent-core | `packages/core/src/agent/`, `packages/core/src/planner.ts`, `packages/core/src/executor.ts` | `packages/core/src/**/*.test.ts`, `packages/core/src/**/*.test.tsx` |
| sdd-workflow | `packages/sdd/src/`, `docs/design.md`, `docs/architecture.md` | `packages/sdd/src/**/*.test.ts` |
| mcp-boundary | `packages/mcp-*/src/`, `packages/runtime-node/src/` | matching package tests |
| memory-boundary | `packages/mcp-memory/src/`, `packages/core/src/memory/` | matching package/core memory tests |
| repo-harness | `.github/workflows/`, `.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/CODEOWNERS`, `.githooks/`, `scripts/workflows/` | `scripts/tests/` |
| authority-docs | `README.md`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `docs/workflow.md`, `docs/knowledge-contract.md` | `scripts/tests/` |

The structured PR summary should be:

```md
## GitNexus Impact Summary

- Risk level: LOW|MEDIUM|HIGH|CRITICAL
- Critical skeleton changes: explain touched critical categories or say none
- GitNexus impact: mention detect_changes and at least one query/context/impact conclusion
- Verification: commands run and results, or a concrete reason a command could not run
```

The contract guard should reject placeholder values for critical skeleton changes.

## CI And Review Layer

FrontAgent's existing CI targets `develop`, so new workflows should also target `develop`.

Required workflows:

- `.github/workflows/ci.yml`: use `pnpm quality:ci` so CI and local script names stay aligned.
- `.github/workflows/contract-guard.yml`: run `pnpm contract:gitnexus` on PRs to `develop`.
- Harness tests run through `pnpm test:workflows`, which is included in `quality:precommit` and `quality:ci`.
- Existing `.github/workflows/repo-guard.yml`: keep as advisory AI review; do not give it merge authority.

Avoid new `pull_request_target` workflows unless the workflow only reads trusted base-branch metadata and never executes fork code with write tokens.

## Templates And Ownership

Issue templates should support OSS collaboration:

- Bug report: environment, reproduction, expected behavior, logs/screenshots, affected package.
- Feature request: problem, proposed behavior, alternatives, affected area, willingness to contribute.
- Maintenance task: reason, affected area, verification plan.

PR template should require:

- Linked issue or rationale.
- Summary of changes.
- Impact scope.
- GitNexus impact summary.
- Verification commands.
- Checklist for tests, docs, and critical skeleton changes.

CODEOWNERS should request maintainer review for:

- `.github/workflows/`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/ISSUE_TEMPLATE/`
- `.github/CODEOWNERS`
- `.githooks/`
- `scripts/workflows/`
- `scripts/tests/`
- `AGENTS.md`
- `CLAUDE.md`
- `CONTRIBUTING.md`
- `docs/workflow.md`
- `docs/knowledge-contract.md`
- `docs/design.md`
- `docs/architecture.md`
- core packages that define agent execution, SDD, MCP boundaries, and memory.

## Testing Strategy

Harness tests should cover:

- Contract path classification for critical and non-critical changes.
- Structured GitNexus impact summary parsing and placeholder rejection.
- Matching-test requirement for critical categories.
- Hook files exist and invoke the intended quality scripts.
- `package.json` exposes required Harness scripts.
- CI workflows target `develop` and call the correct scripts.
- PR template contains all fields enforced by the contract guard.
- Repo-guard remains advisory and is not wired into auto-merge.

Product tests remain owned by package-level test suites and Turbo.

## Rollout

1. Add design and implementation plan.
2. Add workflow scripts, tests, and hook files.
3. Add `package.json` Harness scripts.
4. Add contributor and knowledge-contract docs.
5. Add PR/Issue templates and CODEOWNERS.
6. Add contract guard workflow and align CI with `quality:ci`.
7. Run local script tests, quality gates where feasible, and GitNexus `detect_changes`.

## Verification

Completion requires evidence from:

- `pnpm test` or a focused Harness test command.
- `pnpm contract:check` or `pnpm contract:local`.
- `pnpm quality:precommit` at minimum.
- Static inspection of hook files and workflow YAML.
- GitNexus `detect_changes` over the final diff.

If full `pnpm quality:local` is too expensive or blocked by environment setup, the final report must state exactly which sub-command was not run and why.
