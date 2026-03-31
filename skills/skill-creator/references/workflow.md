# Skill Lab Workflow

Use the smallest loop that answers the user's request.

## 1. New Skill

- Scaffold the skill package:
  - `frontagent skill scaffold <skill-name>`
- Then add or refine:
  - `SKILL.md`
  - `agents/openai.yaml`
  - any needed `references/` or `assets/`
- Run `frontagent skill init-evals <skill-name>`
- Edit the generated evals so they reflect real prompts
- Run `frontagent skill benchmark <skill-name>`

## 2. Improve Existing Skill

- Benchmark first:
  - `frontagent skill benchmark <skill-name>`
- Improve with candidate generation:
  - `frontagent skill improve <skill-name>`
- Review:
  - candidate output path
  - summary markdown
  - baseline vs candidate pass rate

## 3. Promote Candidate

- If the candidate is clearly better and the user wants the change applied:
  - `frontagent skill promote <skill-name> <candidate-id>`
- Or use:
  - `frontagent skill improve <skill-name> --apply-if-better`

## 4. Safety

- Use manual promotion when the skill is high-impact or the eval suite is still weak.
- Treat benchmark results as only as good as the eval suite behind them.
