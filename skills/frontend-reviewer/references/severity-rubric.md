# Severity Rubric

Use these severities consistently:

- `error`
  Use for correctness bugs, broken builds, runtime failures, invalid data flow, security issues, accessibility blockers, or hard constraint violations.
- `warning`
  Use for likely regressions, fragile logic, maintainability risks, missing edge-case handling, weak test coverage, or architecture drift.
- `note`
  Use only for optional improvements that do not affect correctness or acceptance.

Escalation rules:

- Prefer `warning` unless there is clear user-visible breakage or a hard constraint violation.
- Missing tests are usually `warning`, not `error`, unless the missing test hides a severe regression risk.
- Pure style disagreements are not findings unless they create inconsistency that materially harms the codebase.

Output rules:

- Order by severity, then by likely impact.
- Keep each finding scoped to one concrete problem.
- Include the shortest credible remediation path.
