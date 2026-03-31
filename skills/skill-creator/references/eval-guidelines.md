# Eval Guidelines

Good skill iteration depends on good evals.

## Trigger Eval Principles

- Include both:
  - prompts that should trigger
  - prompts that should not trigger
- Prefer real user phrasing over abstract placeholders.
- Include near-miss prompts to catch false positives.
- Include cross-skill separation prompts so neighboring skills do not collide.

## What Starter Evals Are For

- Starter evals are a scaffold, not a final benchmark.
- They are useful to get the loop running quickly.
- They should be edited before promotion decisions are trusted.

## Benchmark Interpretation

- A higher pass rate is useful but not sufficient on its own.
- Watch false positives carefully:
  - a broader skill can look "better" while becoming noisier
- Watch false negatives carefully:
  - a skill that never triggers is effectively dead

## Recommended Iteration Pattern

1. Benchmark the current skill
2. Inspect failing prompts
3. Improve the skill
4. Re-run benchmark
5. Promote only if the new candidate is measurably better
