# GitGuardian CI Workflow Design

Date: 2026-06-11
Repository: `FrontAgent/FrontAgent`
Base branch: `develop`

## Goal

Add an independent GitGuardian secret-scanning workflow that uses the repository secret
`GITGUARDIAN_API_KEY` and follows the existing FrontAgent CI trigger pattern.

## Context

FrontAgent already runs CI, Contract Guard, and Repo Guard from `.github/workflows/`.
Existing CI and Contract Guard target `develop`, so the GitGuardian workflow should use
the same branch policy unless maintainers explicitly broaden the security coverage.

GitGuardian's current GitHub Actions documentation recommends running ggshield from
GitHub Actions, checking out full history with `fetch-depth: 0`, and passing
`GITGUARDIAN_API_KEY` through the environment.

## Selected Approach

Create a standalone `.github/workflows/gitguardian.yml` workflow.

This keeps secret scanning separate from Node quality checks and makes the
`GitGuardian scan` status easy to add as a required check. The workflow should trigger
on pushes to `develop` and pull requests targeting `develop`.

## Workflow Behavior

- Workflow name: `GitGuardian scan`.
- Events:
  - `push` to `develop`.
  - `pull_request` targeting `develop`.
- Permissions: `contents: read`.
- Concurrency:
  - Group by PR number when available, otherwise by ref.
  - Cancel in-progress runs for pull request updates.
- Job:
  - Runs on `ubuntu-latest`.
  - Checks out the repository with `actions/checkout@v6`.
  - Uses `fetch-depth: 0` so ggshield can scan the relevant commit range.
  - Runs `GitGuardian/ggshield/actions/secret@v1.51.0`.
  - Passes the official GitHub SHA environment variables plus
    `GITGUARDIAN_API_KEY: ${{ secrets.GITGUARDIAN_API_KEY }}`.

## Error Handling

The workflow should fail when GitGuardian detects exposed secrets or when the
configured API key is missing/invalid. No local fallback or soft-fail behavior is
included because this is a security gate.

## Testing

Local verification should include:

- YAML structure inspection by reading the new workflow file.
- `pnpm quality:precommit`, because `.github/workflows/` is a repo-harness critical
  skeleton path in `docs/knowledge-contract.md`.
- `mcp__gitnexus.detect_changes` before final review to confirm the affected scope.

## Out Of Scope

- Adding a `.gitguardian.yaml` ignore policy.
- Enabling GitGuardian full-history repository monitoring outside GitHub Actions.
- Changing branch protection settings.
- Modifying existing CI, Contract Guard, or Repo Guard behavior.
