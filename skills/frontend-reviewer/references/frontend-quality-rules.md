# Frontend Quality Rules

Apply these rules when the request involves frontend architecture, generated code, or acceptance review.

## Fit the existing system

- Preserve the established framework, styling system, and file organization.
- Prefer minimal diffs over broad rewrites.
- Avoid new dependencies unless the request or the codebase clearly justifies them.

## Favor explicit behavior

- Prefer clear state transitions over clever abstractions.
- Prefer deterministic rendering over hidden side effects.
- Prefer code that makes loading, error, and success states explicit.

## Respect boundaries

- Keep view logic close to the UI.
- Keep data transformation and business rules out of purely presentational components.
- Keep module imports aligned with existing project boundaries.

## Review generated code harder

- Check generated code for placeholder assumptions, missing imports, dead paths, and unsupported edge cases.
- Treat "looks plausible" as insufficient evidence.
- Look for missing acceptance details, not just syntax problems.

