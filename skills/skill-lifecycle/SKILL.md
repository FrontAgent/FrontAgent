---
name: skill-lifecycle
description: Create, evaluate, improve, and benchmark content skills using the local Skill Lab workflow. Use when adding a new skill, tuning an existing skill's trigger behavior, iterating on SKILL.md instructions, or deciding whether a candidate skill should replace the current version.
triggers:
  explicit:
    - "$skill-lifecycle"
    - "skill-lifecycle"
  keywords:
    - "create a skill"
    - "new skill"
    - "improve this skill"
    - "benchmark this skill"
    - "tune skill triggers"
    - "迭代技能"
    - "优化技能"
    - "评测技能"
    - "创建技能"
  negative:
    - "review code"
    - "bugfix"
    - "普通页面开发"
license: Inspired by Claude skill-creator concepts
---

# Skill Creator

Use this skill when the user wants to work on content skills themselves — creating, evaluating, improving, or benchmarking them.

## Trigger

- Requests to create a new content skill
- Requests to improve or benchmark an existing skill
- Requests to reduce false positives or false negatives in skill triggering
- Requests to compare the current skill against a revised candidate

## Workflow

1. Read `references/workflow.md` to choose the right Skill Lab sequence.
2. Read `references/eval-guidelines.md` before creating or editing trigger evals.
3. If the skill does not exist yet, scaffold a new skill package (e.g. `frontagent skill scaffold <skill-name>`).
4. If the skill does not yet have evals, initialize trigger evals (e.g. `frontagent skill init-evals <skill-name>`).
5. If behavior quality matters, initialize behavior evals (e.g. `frontagent skill init-behavior-evals <skill-name>`).
6. Run a benchmark before making changes (e.g. `frontagent skill benchmark <skill-name>`). Use `--behavior` when behavior evals are available.
7. When improvement is requested, generate a candidate and compare it with baseline (e.g. `frontagent skill improve <skill-name>`). Use `--behavior` to include behavior scoring.
8. Only apply a candidate when the benchmark clearly improves and the user wants promotion (e.g. `frontagent skill promote <skill-name> <candidate-id>` or `--apply-if-better`).

> Platform-specific commands listed above use the `frontagent skill` CLI. See `ADAPTATION.md` for how to map these steps to a different platform.

## Output Contract

- Keep the user informed of:
  - where eval files live
  - where candidate skills were written
  - whether benchmark scores improved
- Prefer benchmark-backed recommendations over intuition.
- Treat the skill package itself as the artifact under iteration:
  - `SKILL.md`
  - `agents/openai.yaml`
  - existing `references/` and `assets/`

## Guardrails

- Do not trust starter evals blindly. Encourage editing them toward real prompts before strong conclusions.
- Do not auto-apply candidates unless the user requested it or the command explicitly says to do so.
- Do not silently broaden a skill's scope just to improve trigger rate.
- Prefer preserving existing references/assets over inventing new file paths.
