# Open-Source Harness Engineering Workflow

This document is the detailed repository asset for the FrontAgent OSS Harness engineering workflow. It expands the lightweight loop in `docs/workflow.md` into an operational playbook that agents, maintainers, and contributors can follow for non-trivial repository work.

The workflow is adapted from prior maintainer Harness research, but it is scoped to open-source community maintenance. It deliberately excludes training-camp mechanics such as task claiming, scoring, progress ledgers, timeout-close automation, private cohort reports, and comment-triggered auto-merge.

## Goals

- Keep work small, reviewable, and independently verifiable.
- Make authority documents explicit before code changes.
- Require GitNexus impact evidence before risky edits and before final review.
- Keep local gates, CI, Contract Guard, Repo Guard, and maintainer review aligned.
- Preserve maintainer judgment as the final merge-readiness authority.

## Non-Goals

Do not add or depend on:

- `认领` or other task-claim comments.
- `score:*` labels, leaderboards, contributor scoring, or penalty mechanics.
- Progress ledgers or cohort progress reports.
- GitHub ID to personal-name mapping for reporting.
- `确认合并` or other comment-triggered auto-merge commands.
- PR timeout-close automation for volunteer contributors.
- CR-as-points workflows or reviewer ownership comments.
- Workflows that run untrusted fork code with write tokens.

## Authority Order

When documents and code disagree, use this order:

1. `README.md` for public product positioning and user-facing commands.
2. `docs/architecture.md` and `docs/design.md` for architecture and SDD behavior.
3. `CONTRIBUTING.md`, `docs/workflow.md`, and `docs/knowledge-contract.md` for OSS contribution, Harness, and GitNexus contract rules.
4. Issue, discussion, or PR text for the specific change request.
5. Existing code as implementation evidence.

If expected behavior remains unclear, ask maintainers instead of silently choosing a new architecture.

## Workflow Phases

### 1. Scope And Authority

**Goal:** Anchor work in public project authority and maintainer intent.

**Actions:**

- Start from an issue, discussion, PR comment, or maintainer-approved task.
- Clarify affected area, expected behavior, and verification before implementation.
- For large or ambiguous work, create or request a design doc under `docs/superpowers/specs/` and an implementation plan under `docs/superpowers/plans/`.
- Read the authority documents relevant to the change before editing.

**Evidence to keep:**

- Linked issue, discussion, PR comment, or standalone maintainer instruction.
- Brief scope statement with affected area and expected verification.
- Notes on any relevant authority docs consulted.

**Gate:** Do not implement when scope, expected behavior, or verification is unclear.

### 2. Bootstrap And Branch

**Goal:** Prepare a deterministic local environment and contract context.

**Actions:**

- Install dependencies when needed:

  ```bash
  pnpm install
  ```

- Use a short-lived branch from `develop`:

  ```text
  feat/<topic>
  fix/<topic>
  docs/<topic>
  chore/<topic>
  ```

- Run bootstrap and pre-development gates when feasible:

  ```bash
  pnpm agent:bootstrap
  pnpm quality:predev
  ```

- Keep generated, vendored, cache, and index-only churn out of ordinary PRs.

**Evidence to keep:**

- Branch name and base branch.
- Bootstrap and predev command results, or a short reason if skipped.
- Any local setup exception and compensating verification.

**Gate:** Proceed to edits only after setup and contract context are ready, or after documenting why they cannot run.

### 3. Pre-Change Intelligence

**Goal:** Prevent hidden blast radius from shared code changes.

**Actions:**

- Use GitNexus `query` for unfamiliar flows before changing them.
- Use GitNexus `context` when a specific symbol needs caller/callee and process context.
- Before editing any symbol, and especially any function, class, method, or critical skeleton path, run upstream GitNexus impact analysis.
- Record risk level, direct callers, affected processes, and affected modules.
- Warn maintainers or users before continuing on HIGH or CRITICAL risk.
- Use GitNexus rename tooling for symbol renames; never use blind find-and-replace for symbol renames.

**Evidence to keep:**

```md
- Risk level: LOW|MEDIUM|HIGH|CRITICAL
- Direct callers: ...
- Affected processes: ...
- Affected modules: ...
- Decision: ...
```

**Gate:** Do not edit symbols until impact analysis is captured. Pause before HIGH or CRITICAL changes.

### 4. Implementation

**Goal:** Deliver the smallest reviewable change aligned with FrontAgent architecture.

**Actions:**

- Implement only the approved scope.
- Preserve SDD, MCP-controlled execution, minimal diff, rollback, and validation boundaries.
- Avoid unrelated refactors and formatting churn.
- For critical skeleton surfaces, add matching tests in the same PR.
- Review `.gitnexus/lbug` and `.gitnexus/meta.json` drift before including it. Commit these files only for explicit knowledge-base refreshes, Harness/GitNexus contract changes, or maintainer-requested canonical index updates.

**Critical skeleton categories:**

| Category | Paths | Matching tests |
| --- | --- | --- |
| agent-core | `packages/core/src/agent/`, `packages/core/src/planner.ts`, `packages/core/src/executor.ts` | `packages/core/src/**/*.test.ts`, `packages/core/src/**/*.test.tsx` |
| sdd-workflow | `packages/sdd/src/`, `docs/design.md`, `docs/architecture.md` | `packages/sdd/src/**/*.test.ts` |
| mcp-boundary | `packages/mcp-*/src/`, `packages/runtime-node/src/` | matching package tests |
| memory-boundary | `packages/mcp-memory/src/`, `packages/core/src/memory/` | matching package or core memory tests |
| repo-harness | `.github/workflows/`, `.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/CODEOWNERS`, `.claude/workflows/`, `.claude/skills/`, `.githooks/`, `scripts/workflows/` | `scripts/tests/` |
| authority-docs | `README.md`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `docs/workflow.md`, `docs/knowledge-contract.md` | `scripts/tests/` |

**Gate:** If the diff expands beyond the approved scope, split the work or return to design/plan review.

### 5. Local Verification

**Goal:** Validate with cost-tiered checks before asking maintainers to review.

**Actions:**

- Run focused tests for the touched area first.
- Before final review, run at minimum:

  ```bash
  pnpm quality:precommit
  ```

- Before pushing, run the full local gate when feasible:

  ```bash
  pnpm quality:local
  ```

- Use the CI-equivalent product gate when contract refresh is not feasible but product checks are needed:

  ```bash
  pnpm quality:ci
  ```

- Use `SKIP_QUALITY_HOOKS=1` only as an emergency/local escape hatch. CI remains authoritative.

**Gate:** Do not request final review with failing relevant tests or unexplained skipped minimum gates.

### 6. Final Impact Review

**Goal:** Catch scope drift before commit or PR finalization.

**Actions:**

- Run GitNexus `detect_changes` on the final diff.
- Confirm affected symbols and execution flows match the intended scope.
- If unexpected flows appear, investigate with GitNexus `context`, `query`, or additional tests.

**Evidence to keep:**

- `detect_changes` summary.
- Expected affected symbols and flows.
- Explanation for any unexpected affected flow, or confirmation that none were found.

**Gate:** Do not finalize a PR until final diff impact is inspected and unexpected scope is resolved or documented.

### 7. PR Preparation

**Goal:** Make PRs machine-checkable and human-reviewable.

**Actions:**

- Open PRs to `develop`.
- Link the issue, discussion, PR context, or explain why the PR stands alone.
- Fill the PR template with summary, impact scope, verification, focused diff checklist, and gate results.
- For critical skeleton changes, fill a concrete GitNexus Impact Summary.

**Required GitNexus Impact Summary format:**

```md
## GitNexus Impact Summary

- Risk level: LOW|MEDIUM|HIGH|CRITICAL
- Critical skeleton changes: explain touched critical categories or say none
- GitNexus impact: mention detect_changes and at least one query/context/impact conclusion
- Verification: commands run and results, or why unavailable
```

**Gate:** Critical skeleton PRs must not use placeholders, and must include matching tests plus a structured impact summary.

### 8. CI, Review, And Merge Readiness

**Goal:** Preserve community maintainer control while using automated and AI-assisted review.

**Actions:**

- Wait for GitHub Actions, Contract Guard, Repo Guard, Codex, Copilot, and maintainer feedback as applicable.
- Treat CI and Contract Guard as minimum required checks.
- Treat Repo Guard, Codex, Copilot, and other AI reviewers as advisory review-assist signals.
- Address actionable review comments with follow-up commits.
- Rerun relevant gates after follow-up changes.
- Let maintainers decide merge readiness through normal GitHub review and branch protection.

**Gate:** Merge only through maintainer judgment and standard GitHub controls. Do not add comment-triggered auto-merge or scoring systems.

### 9. Harness Maintenance

**Goal:** Keep the Harness contract itself synchronized and tested.

When changing any of these surfaces:

- `.github/workflows/`
- `.github/ISSUE_TEMPLATE/`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/CODEOWNERS`
- `.claude/workflows/`
- `.claude/skills/`
- `.githooks/`
- `scripts/workflows/`
- `scripts/tests/`
- `README.md`
- `AGENTS.md`
- `CLAUDE.md`
- `CONTRIBUTING.md`
- `docs/workflow.md`
- `docs/knowledge-contract.md`

also check whether to update:

- `scripts/tests/workflow-rules.test.mjs`
- `scripts/workflows/contract-rules.mjs`
- `package.json` scripts
- `CONTRIBUTING.md`
- `docs/workflow.md`
- `docs/knowledge-contract.md`

**Rules:**

- Keep workflow YAML thin by invoking named package scripts.
- Keep Contract Guard focused on critical skeleton changes and structured impact summaries.
- Keep non-critical GitNexus results advisory.
- Keep Repo Guard advisory, not a merge authority.
- Do not change Harness policy without synchronized docs, scripts, and tests.

## Saveable Workflow Prompt

Use this condensed prompt when saving a reusable workflow command:

```md
Run the FrontAgent OSS Harness workflow.

Scope:
- This is an open-source community workflow, not a training-camp workflow.
- Do not use claim comments, score labels, progress ledgers, timeout-close automation, private cohort reporting, or comment-triggered auto-merge.

Phases:
1. Confirm scope and authority:
   - Start from issue/discussion/PR/maintainer-approved task.
   - Follow authority order: README; docs/architecture.md and docs/design.md; CONTRIBUTING.md, docs/workflow.md, docs/knowledge-contract.md; issue/PR text; existing code.
   - Ask maintainers if docs conflict.

2. Bootstrap:
   - Use branch from develop: feat/, fix/, docs/, or chore/.
   - Run pnpm install when needed.
   - Run pnpm agent:bootstrap and pnpm quality:predev when feasible.

3. Pre-change intelligence:
   - Use GitNexus query/context for unfamiliar flows.
   - Before editing any symbol/function/class/method, run upstream GitNexus impact.
   - Report risk, direct callers, affected processes, and modules.
   - Warn before HIGH/CRITICAL risk.
   - Use GitNexus rename for symbol renames.

4. Implement:
   - Make the smallest independently reviewable change.
   - Avoid unrelated refactors and generated/index-only churn.
   - For critical skeleton changes, add matching tests.

5. Verify:
   - Run focused tests for touched areas.
   - Run pnpm quality:precommit before final review at minimum.
   - Run pnpm quality:local before pushing when feasible.
   - Explain skipped gates.

6. Final impact:
   - Run GitNexus detect_changes on final diff.
   - Confirm affected symbols/flows match intended scope.
   - Investigate unexpected scope.

7. PR:
   - Open PR to develop.
   - Fill template with linked context, summary, impact scope, verification, focused diff, and gates.
   - For critical skeleton changes, fill GitNexus Impact Summary with risk level, critical skeleton changes, detect_changes plus query/context/impact, and verification.

8. Review:
   - Wait for CI, Contract Guard, Repo Guard, Codex/Copilot, and maintainer comments.
   - Treat Repo Guard and AI comments as advisory.
   - Address actionable review comments with follow-up commits and rerun relevant gates.
   - Maintainers decide merge readiness.

9. Harness maintenance:
   - If changing workflows, hooks, contract scripts, templates, authority docs, or package scripts, update docs + scripts + tests together.
   - Keep workflow YAML thin by invoking package scripts.
   - Do not commit .gitnexus seed-index drift unless explicitly in scope.
```

## Source Notes

This asset was produced from repository evidence in:

- `CLAUDE.md`
- `CONTRIBUTING.md`
- `docs/workflow.md`
- `docs/knowledge-contract.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/workflows/ci.yml`
- `.github/workflows/contract-guard.yml`
- `package.json`
- `scripts/workflows/contract-rules.mjs`
- `scripts/tests/workflow-rules.test.mjs`

It also incorporates reusable, non-training-specific Harness practices from maintainer research while excluding training-camp governance mechanics.
