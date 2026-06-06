# Contributing To FrontAgent

Thanks for helping improve FrontAgent. This repository uses a lightweight OSS Harness: local quality gates, GitNexus impact checks, CI, Repo Guard, and maintainer review. It does not use training-camp claim, score, progress-ledger, timeout-close, or auto-merge commands.

## Setup

```bash
pnpm install
pnpm agent:bootstrap
pnpm quality:predev
```

`pnpm agent:bootstrap` installs repository git hooks and prints the expected local workflow. `pnpm quality:predev` refreshes GitNexus contract context before development.

## Local Quality Gates

- `pnpm quality:precommit`: fast gate for commit-time checks. It runs lint, typecheck, and tests.
- `pnpm quality:ci`: CI-equivalent product gate. It runs lint, typecheck, tests, and build.
- `pnpm quality:local`: full local gate for push-time checks. It runs GitNexus contract checks and `quality:ci`.

The repository hooks run `quality:precommit` on commit and `quality:local` on push. If hooks are unavailable, run the same commands manually. Maintainers may use `SKIP_QUALITY_HOOKS=1` for emergencies, but CI remains authoritative.

## Branches And PRs

Open PRs against `develop`. Use short-lived branches such as:

```text
feat/mcp-server-sampling
fix/sdd-validation-error
docs/contributor-workflow
```

External contributors should use forks or normal feature branches. Keep each PR focused on one behavior, fix, or maintenance task.

## GitNexus Impact Summary

Critical skeleton changes require a concrete GitNexus impact summary in the PR template. Run GitNexus before changing shared symbols and before final review:

```bash
pnpm contract:check
```

For symbol changes, use GitNexus `impact`, `query`, or `context` to inspect blast radius. For final PR preparation, use `detect_changes` to inspect affected execution flows.

Fill the PR section like this:

```md
- Risk level: LOW
- Critical skeleton changes: packages/core/src/agent helpers only; no public MCP boundary changes.
- GitNexus impact: detect_changes shows agent helper tests affected; context on createOnPhaseComplete found planner callbacks only.
- Verification: pnpm quality:precommit passed.
```

Do not leave placeholder values for critical skeleton changes.

## Documentation Authority

Use this priority when documents and code disagree:

1. `README.md` for public product positioning and user-facing commands.
2. `docs/architecture.md` and `docs/design.md` for architecture and SDD behavior.
3. `docs/workflow.md` and `docs/knowledge-contract.md` for contribution and Harness rules.
4. Issue or PR text for the specific change.
5. Existing code, unless it contradicts the documents above.

If the documents conflict, ask maintainers instead of silently choosing a new architecture.

## Security

Do not paste secrets into issues, PRs, tests, screenshots, or run logs. Workflows for fork PRs must not execute untrusted code with write tokens. Repo Guard is advisory; maintainers still decide merges.
