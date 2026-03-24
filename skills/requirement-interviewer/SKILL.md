---
name: requirement-interviewer
description: Gather missing product, UX, technical, and delivery constraints before planning or coding. Use when a request is underspecified, when several implementations are plausible, when frontend work needs explicit acceptance criteria, or when the agent must ask structured questions before acting.
---

# Requirement Interviewer

Collect missing constraints through phased questioning. Refuse to plan, code, or propose irreversible implementation details until the required answers are complete.

## Workflow

1. Read `references/question-flow.md`.
2. Ask only the next unanswered question cluster, not the whole interview at once.
3. Read `references/answer-completeness.md` to decide whether the reply is sufficient or needs follow-up.
4. Read `references/gating-rules.md` before moving from clarification into planning.
5. After each phase, summarize confirmed facts, explicit assumptions, and open questions.
6. Only when all mandatory gates pass, hand off a concise, execution-ready brief or plan.

## Interview Contract

- Ask 1-3 short questions at a time.
- Prefer constrained choices when possible.
- Keep questions ordered: objective first, implementation later.
- If the user says "you decide", record the default explicitly as an assumption.
- Separate confirmed requirements from inferred assumptions.

## Guardrails

- Do not generate code, file edits, or architecture proposals before gates pass.
- Do not ask duplicate questions.
- Do not jump into low-level implementation details before product intent is clear.
- Do not silently fill critical gaps with guesses.
- Stop and ask for explicit approval when the decision changes scope, cost, or stack direction.
