# FrontAgent Repo Guard Design

Date: 2026-05-20
Repository: `ceilf6/FrontAgent`
Base branch: `develop`

## Goal

Apply `ceilf6/repo-guard` to FrontAgent so pull requests into `develop`, newly opened issues, and explicit `@repo-guard` or `/review` comments receive AI review.

## Constraints

- Do not touch the existing `refactor/structured-logger` checkout or its uncommitted work.
- Work only in an isolated worktree based on `origin/develop`.
- Never write the LLM API key into repository files.
- Enable both PR and issue review.

## Design

Add `.github/workflows/repo-guard.yml` as an independent workflow. It should run on:

- `pull_request` targeting `develop`, for PR code review.
- `issues` with `opened`, for issue quality review.
- `issue_comment` with `created`, for manual `@repo-guard` or `/review` review on issues or PRs.

The workflow grants only the permissions repo-guard needs:

- `contents: read`
- `pull-requests: write`
- `issues: write`

The workflow calls `ceilf6/repo-guard@main` with `type: both`, `language: zh`, and the model configuration supplied through GitHub repository settings:

- Secret `LLM_API_KEY`
- Variable `LLM_PROVIDER`
- Variable `LLM_BASE_URL`
- Variable `LLM_MODEL`

## GitHub Settings

Set these repository values through `gh`:

- `LLM_API_KEY`: user-provided key, stored as a secret.
- `LLM_PROVIDER`: `anthropic`
- `LLM_BASE_URL`: `https://token-plan-cn.xiaomimimo.com/anthropic`
- `LLM_MODEL`: `mimo-v2.5-pro`

## Verification

- The workflow YAML parses as valid YAML.
- The workflow references `${{ secrets.LLM_API_KEY }}` rather than a literal key.
- GitHub lists the expected secret and variables after configuration.
- The branch contains only the repo-guard workflow plus these planning docs.

## Out Of Scope

- Changing FrontAgent source code.
- Changing existing CI behavior.
- Adding issue templates or PR templates.
- Storing API credentials in files.
