# Aesthetics Guidelines

Apply these guidelines to make the UI feel intentionally designed without becoming fragile or gimmicky.

## Typography

- Treat typography as a primary design tool, not a default setting.
- For new standalone surfaces, prefer characterful font choices over generic default stacks.
- Pair display and body type intentionally when the surface needs more personality.
- If the project already standardizes fonts, respect that standard unless the user asked for a redesign.
- Let spacing, weight, and rhythm do real work before adding more decoration.

## Color and Theme

- Commit to a palette with a clear hierarchy:
  - dominant tones
  - supporting neutrals
  - sharp accents
- Use CSS variables or project tokens so the palette stays coherent.
- Strong palettes usually beat evenly distributed, low-contrast color use.
- Avoid falling back to generic "AI-looking" schemes, especially purple-forward gradients on plain white layouts, unless the product genuinely calls for them.

## Motion

- Use motion to reinforce hierarchy, state change, or delight.
- Prefer a few high-impact moments over many small unrelated animations.
- Keep motion accessible:
  - honor reduced-motion preferences
  - avoid distracting loops
  - keep interaction feedback fast and legible
- In React or richer app contexts, only add a motion dependency when it is already present or clearly justified.

## Composition

- Avoid default block stacking when the task benefits from a stronger point of view.
- Use asymmetry, overlap, framing, density, or negative space intentionally.
- Let sections have different pacing so the page does not feel mechanically uniform.
- Break the grid only when the resulting composition still feels controlled.

## Background and Surface Detail

- Give the interface atmosphere when appropriate:
  - layered gradients
  - subtle texture
  - pattern
  - transparency
  - shadow systems
  - borders and dividers
- Background treatment should support the direction, not compete with the content.
- If the task is product UI rather than marketing UI, be more restrained.

## Avoid Repetition

- Do not converge on the same font, palette, spacing system, and layout recipe across unrelated tasks.
- The design should respond to the product context, not to a reusable AI default.
