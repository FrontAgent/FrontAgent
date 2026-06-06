# FrontAgent OSS Workflow

FrontAgent uses a lightweight open-source maintenance workflow. The goal is to keep contributor work small, reviewable, and verifiable without importing training-camp scoring or task-claim automation.

## Community Loop

For the detailed operational playbook, see [`docs/oss-harness-engineering-workflow.md`](oss-harness-engineering-workflow.md).

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

## Maintainer Triage

Maintainers should clarify scope, affected area, expected behavior, and verification before encouraging implementation. Large or ambiguous work should first become a design doc under `docs/superpowers/specs/` and an implementation plan under `docs/superpowers/plans/`.

## Contributor Rules

- Target PRs at `develop`.
- Keep PRs focused and independently reviewable.
- Link an issue, discussion, or explain standalone context in the PR.
- Run the local quality gates described in `CONTRIBUTING.md`.
- Fill the PR template with concrete verification.
- For critical skeleton changes, fill the GitNexus impact summary.
- Do not modify unrelated generated artifacts or vendored output.

## Agent Rules

Agents working in this repository should:

1. Read `CONTRIBUTING.md`, this file, and `docs/knowledge-contract.md` before larger edits.
2. Run `pnpm agent:bootstrap` and `pnpm quality:predev` before code changes when feasible.
3. Use GitNexus impact analysis before modifying functions, classes, methods, or critical skeleton paths.
4. Ask maintainers when docs conflict or the expected behavior is unclear.
5. Keep changes scoped to the requested work and existing architecture.
6. Run focused tests first, then broader gates as risk increases.

## Review And Merge

CI and Contract Guard provide minimum checks. Repo Guard provides advisory AI review. Maintainers decide whether to merge after reviewing product intent, design fit, tests, and risk.

This repository does not use `认领`, `score:*`, progress ledgers, `确认合并` auto-merge comments, or PR timeout-close automation.
