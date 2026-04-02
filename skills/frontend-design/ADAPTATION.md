# Adaptation Guide — frontend-design

This skill is designed to be platform-portable. The core design knowledge (aesthetics, direction, integration guardrails, delivery checks) is universal. The only platform-specific concept is the "project design specification" — a document or system that defines allowed technologies, module boundaries, and protected files for a given project.

## The "project design specification" Concept

Throughout this skill, the term **project design specification** refers to a formal or semi-formal constraints document that governs what the implementation is allowed to do.

| Platform | Equivalent concept |
|----------|--------------------|
| FrontAgent | SDD (Software Design Document) |
| General | PRD, Tech Spec, Architecture Decision Record |
| Design-centric | Design Token spec, Component Library guidelines |
| No formal doc | README constraints section, team conventions |

If your platform or project does not use any such document, treat "project design specification" as "the agreed constraints for this project" — even if they are informal.

## Files That Reference This Concept

| File | Occurrences |
|------|-------------|
| `SKILL.md` — `description` field | 1 |
| `SKILL.md` — Guardrails section | 1 |
| `references/integration-guardrails.md` — section title and body | 2 |
| `agents/openai.yaml` — `default_prompt` | 1 |

When porting this skill to a platform with a named constraints system (e.g. SDD, PRD), search for `project design specification` across the files above and replace with the platform-specific term for consistency with user expectations.

## FrontAgent-Specific History

This skill was originally written for FrontAgent and used "SDD constraints" to refer to FrontAgent's Software Design Document system. The term was generalized to "project design specification" during a portability refactor. If you are running this skill on FrontAgent, the behavior is unchanged — SDD is simply one implementation of a project design specification.
