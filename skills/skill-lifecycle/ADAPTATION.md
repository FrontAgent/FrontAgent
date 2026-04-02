# Adaptation Guide — skill-lifecycle

This skill is designed to be platform-portable. The core knowledge (eval principles, iteration patterns, benchmark interpretation) is universal. The only platform-specific content is the CLI command set used to operate the Skill Lab tooling.

## What to Replace When Porting

| Concept | FrontAgent (default) | Replace with |
|---------|----------------------|--------------|
| Scaffold a new skill | `frontagent skill scaffold <skill-name>` | Your platform's skill scaffolding command |
| Initialize trigger evals | `frontagent skill init-evals <skill-name>` | Your platform's eval initialization command |
| Initialize behavior evals | `frontagent skill init-behavior-evals <skill-name>` | Your platform's behavior eval command |
| Run a benchmark | `frontagent skill benchmark <skill-name>` | Your platform's benchmark runner |
| Generate an improved candidate | `frontagent skill improve <skill-name>` | Your platform's improve command |
| Promote a candidate | `frontagent skill promote <skill-name> <candidate-id>` | Your platform's promote command |
| Auto-promote if better | `--apply-if-better` flag | Equivalent flag or workflow step |

## Files That Reference Platform Commands

- `SKILL.md` — Workflow steps include command examples in parentheses
- `references/workflow.md` — Each step has a `> FrontAgent:` callout with the concrete command

Update the command text in both files, or leave them as documentation of the FrontAgent implementation and run the generic step descriptions as the authoritative instruction.

## front matter `platform` Field

`SKILL.md` declares the current platform in its front matter:

```yaml
platform:
  name: FrontAgent
  cli: frontagent skill
```

When porting to a new platform, update `name` and `cli` to reflect the target tooling. This field is informational — it does not drive runtime behavior.
