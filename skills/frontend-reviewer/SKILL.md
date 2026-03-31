---
name: frontend-reviewer
description: Review frontend code, UI changes, generated implementations, and pull requests with severity-based findings and checklist-driven analysis. Use when auditing React/TypeScript/CSS code, validating AI-generated frontend output, performing acceptance review before merge, or checking whether a frontend change is safe to ship.
triggers:
  keywords:
    - "code review"
    - "acceptance review"
    - "quality audit"
    - "review frontend"
    - "frontend review"
    - "审查"
    - "审计"
    - "代码评审"
    - "验收评审"
  negative:
    - "landing page"
    - "restyle"
    - "dashboard redesign"
---

# Frontend Reviewer

Review relevant frontend files and produce concrete findings ordered by severity. Keep the review evidence-based, concise, and actionable.

## Workflow

1. Read `references/severity-rubric.md`.
2. Read `references/review-checklist.md`.
3. Read `references/frontend-quality-rules.md` when architecture, layering, or maintainability questions matter.
4. Inspect only the files relevant to the request, the diff, or the changed surfaces implied by the task.
5. Report findings grouped by severity, highest risk first.
6. If no findings exist, state that explicitly and mention residual risks or testing gaps.

## Output Contract

- Start with findings. Do not lead with a summary.
- For each finding include:
  - affected file path
  - optional line number when known
  - severity
  - why it matters
  - shortest viable fix direction
- Prefer one issue per finding. Split unrelated problems.
- Use exact evidence. Avoid generic advice.

## Guardrails

- Do not invent files, line numbers, or user intent.
- Do not upgrade style nits into blocking issues.
- Do not hide uncertainty. Mark assumptions when evidence is incomplete.
- Do not spend space on praise unless the user explicitly asks for it.
- Prefer behavioral regressions, data-flow bugs, accessibility issues, and missing tests over cosmetic commentary.
