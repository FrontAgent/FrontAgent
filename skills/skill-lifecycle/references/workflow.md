# Skill Lab Workflow

Use the smallest loop that answers the user's request.

## 1. New Skill

- Scaffold the skill package directory with the required structure:
  - `SKILL.md`
  - `agents/openai.yaml`
  - any needed `references/` or `assets/`
  > FrontAgent: `frontagent skill scaffold <skill-name>`
- Edit `SKILL.md` and add or refine references until the skill reflects real usage.
- Initialize trigger evals so the skill can be benchmarked:
  > FrontAgent: `frontagent skill init-evals <skill-name>`
- Edit the generated evals so they reflect real prompts before relying on benchmark numbers.
- Run a baseline benchmark to capture the starting pass rate:
  > FrontAgent: `frontagent skill benchmark <skill-name>`

## 2. Improve Existing Skill

- Always benchmark before making changes so you have a baseline to compare against:
  > FrontAgent: `frontagent skill benchmark <skill-name>`
- Generate a candidate revision and compare it with the baseline:
  > FrontAgent: `frontagent skill improve <skill-name>`
- Review the output:
  - candidate output path
  - summary markdown
  - baseline vs candidate pass rate

## 3. Promote Candidate

- If the candidate is clearly better and the user wants the change applied, promote it:
  > FrontAgent: `frontagent skill promote <skill-name> <candidate-id>`
- Or promote automatically only when the candidate wins:
  > FrontAgent: `frontagent skill improve <skill-name> --apply-if-better`

## 4. Safety

- Use manual promotion when the skill is high-impact or the eval suite is still weak.
- Treat benchmark results as only as good as the eval suite behind them.

---

> The `> FrontAgent:` callouts above show the concrete CLI commands for the FrontAgent platform.
> To use this workflow on a different platform, replace those commands with the equivalents for your Skill Lab tooling.
> See `ADAPTATION.md` at the skill root for a full substitution guide.
