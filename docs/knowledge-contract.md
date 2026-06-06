# FrontAgent GitNexus Knowledge Contract

This document defines how FrontAgent uses GitNexus in local development and PR review. GitNexus is a code intelligence tool for understanding symbol impact and affected execution flows; it is not a substitute for tests or maintainer judgment.

## Local Workflow

Run:

```bash
pnpm agent:bootstrap
pnpm quality:predev
```

`quality:predev` installs hooks and runs the local GitNexus contract check. The contract check refreshes the local GitNexus index with:

```bash
npx --yes --prefer-offline gitnexus analyze --force --index-only
```

The default local timeout is 60 seconds. CI uses 180 seconds. Set `GITNEXUS_ANALYZE_TIMEOUT_MS` only when the repository genuinely needs more time.

## Critical Skeleton

Critical skeleton changes require matching tests and a structured PR impact summary.

| Category | Paths | Matching tests |
| --- | --- | --- |
| agent-core | `packages/core/src/agent/`, `packages/core/src/planner.ts`, `packages/core/src/executor.ts` | `packages/core/src/**/*.test.ts`, `packages/core/src/**/*.test.tsx` |
| sdd-workflow | `packages/sdd/src/`, `docs/design.md`, `docs/architecture.md` | `packages/sdd/src/**/*.test.ts` |
| mcp-boundary | `packages/mcp-*/src/`, `packages/runtime-node/src/` | matching package tests |
| memory-boundary | `packages/mcp-memory/src/`, `packages/core/src/memory/` | matching package or core memory tests |
| repo-harness | `.github/workflows/`, `.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/CODEOWNERS`, `.githooks/`, `scripts/workflows/` | `scripts/tests/` |
| authority-docs | `README.md`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `docs/workflow.md`, `docs/knowledge-contract.md` | `scripts/tests/` |

## PR Summary Format

Fill this section in the PR template:

```md
## GitNexus Impact Summary

- Risk level: LOW|MEDIUM|HIGH|CRITICAL
- Critical skeleton changes: explain touched critical categories or say none
- GitNexus impact: mention detect_changes and at least one query/context/impact conclusion
- Verification: commands run and results, or why unavailable
```

Do not use placeholders such as `-`, `none`, `n/a`, `todo`, or `tbd` for critical skeleton changes.

## CI Contract

`pnpm contract:gitnexus` runs in Contract Guard on PRs to `develop`. It checks:

- Changed files, including additions, copies, deletions, modifications, renames, type changes, unmerged paths, unknown paths, and broken pairs.
- Whether critical skeleton categories have matching test changes.
- Whether the PR body contains a structured impact summary for critical changes.
- Whether the summary mentions `detect_changes` and at least one of `query`, `context`, or `impact`.

For non-critical changes, GitNexus is advisory.

## Versioned Index Files

FrontAgent keeps `.gitnexus/lbug` and `.gitnexus/meta.json` in the repository as a seed index
for local code intelligence. These files are generated and may change after `gitnexus analyze`,
so contributors should not include index-only churn in ordinary PRs.

Only commit `.gitnexus/*` changes when the task explicitly refreshes the repository knowledge
base, changes the Harness/GitNexus contract, or a maintainer requests a canonical index update.
If local hooks or verification refresh the index after a commit or push, leave the resulting
working-tree drift out of follow-up commits unless it is part of the reviewed scope.

## Expected Evidence

Before final review, contributors and agents should be able to state:

- Which critical skeleton categories changed, if any.
- Which direct callers, affected processes, or modules GitNexus reported.
- Which tests or gates were run.
- Which verification could not run and why.
