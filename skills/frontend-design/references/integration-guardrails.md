# Integration Guardrails

Use these rules to keep design ambition compatible with FrontAgent's engineering goals.

## Respect the codebase

- Keep the existing framework, styling system, routing setup, and file organization.
- If the request is scoped, keep the diff scoped.
- Reuse existing tokens, utilities, and primitives before inventing new ones.

## Respect design specification and project rules

- Treat the project design specification as a hard boundary for allowed technologies, module edges, and protected files.
- If visual goals conflict with explicit project constraints, follow the constraints and explain the tradeoff.
- Do not add font packages, UI kits, or animation libraries without clear justification.

## Existing design system rule

- If a design system already exists, enhance within it:
  - improve composition
  - improve hierarchy
  - improve spacing
  - improve state presentation
- Do not replace established system tokens or component primitives unless asked.

## New build rule

- If the task is a new page or standalone surface, you may be bolder:
  - stronger typography
  - more atmospheric backgrounds
  - more pronounced motion
  - more distinctive composition

## Maintainability

- Favor CSS variables, reusable classes, and predictable structure over one-off hacks.
- Avoid visual complexity that creates brittle code or hard-to-maintain overrides.
- Make responsive behavior explicit.

## Accessibility and usability

- Visual ambition must not reduce readability, contrast, keyboard usability, or motion accessibility.
- Loading, empty, error, and disabled states should still feel designed.

## Clarify before committing

- If the redesign level is unclear, ask whether the user wants:
  - a conservative polish
  - a moderate redesign
  - a bold reimagining
