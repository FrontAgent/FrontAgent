---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with a clear visual direction while respecting project design specification constraints, existing design systems, and minimal-diff engineering boundaries. Use when building or restyling pages, landing screens, dashboards, marketing surfaces, or other frontend UI where visual quality materially affects the result.
license: See LICENSE.txt
triggers:
  keywords:
    - "landing page"
    - "hero section"
    - "dashboard"
    - "marketing site"
    - "polish ui"
    - "restyle"
    - "beautify"
    - "redesign"
    - "美化"
    - "重设计"
    - "视觉升级"
    - "设计感"
  negative:
    - "code review"
    - "quality audit"
    - "bugfix"
    - "debug"
---

# Frontend Design

Use this skill to produce frontend work that feels intentionally designed rather than generic. The goal is not maximalism by default. The goal is a clear visual point of view that matches the product context and still ships as maintainable code.

## Trigger

- New frontend surfaces where look and feel matter:
  - landing pages
  - dashboards
  - product pages
  - hero sections
  - marketing sites
  - polished application views
- Requests to beautify, restyle, refine, or modernize an existing UI
- Cases where the code must be working and production-usable, not just a mockup

## Do Not Use

- Pure bug fixes, refactors, or backend tasks
- Review or audit requests
- Small code changes where the user did not ask for visual improvement
- Existing design-system work where the user only wants strict conformance and no meaningful visual interpretation

## Workflow

1. If the request is visually underspecified, ask only the next 1-3 questions needed to clarify audience, tone, and acceptance criteria. Use `requirement-interviewer` when the ambiguity is material.
2. Read `references/design-direction.md` to choose one clear visual direction before coding.
3. Read `references/aesthetics-guidelines.md` for typography, color, motion, composition, and background treatment.
4. Read `references/integration-guardrails.md` before modifying an existing codebase, design system, or shared component surface.
5. For a new page or major redesign, use `assets/templates/visual-brief.md` to form a short visual brief before implementation.
6. Implement working code that matches the chosen direction and stays within project constraints.
7. Read `references/delivery-checks.md` before handing off.

## Output Contract

- State the chosen visual direction in one short sentence when it meaningfully affects implementation.
- Produce working frontend code, not mood-board prose.
- Keep the implementation cohesive:
  - typography should support the direction
  - color should feel intentional
  - motion should be meaningful, not noisy
  - layout should feel composed rather than assembled from defaults
- When editing an existing product, preserve the established system unless the user explicitly wants a stronger redesign.

## Guardrails

- Project design specification constraints, protected files, project stack rules, and user requirements remain hard boundaries.
- Respect the existing design system first. Only deviate when the request explicitly calls for redesign or the current surface clearly lacks a defined visual direction.
- Prefer minimal diffs for scoped tasks. Do not turn a local UI tweak into a whole-app restyle.
- Do not add new dependencies, font loaders, or animation libraries unless the task clearly justifies them.
- Avoid generic AI aesthetics:
  - default-looking font stacks for new standalone surfaces
  - timid palettes
  - predictable card grids with no visual idea
  - purple-gradient-on-white defaults
- Do not optimize for ornament over clarity. If visual flair hurts usability, accessibility, or maintainability, scale it back.
