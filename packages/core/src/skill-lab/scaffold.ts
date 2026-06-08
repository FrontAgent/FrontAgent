import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SkillLabScaffoldResult } from './types.js';
import { sanitizeToken } from './utils.js';

export function scaffoldSkill(
  projectRoot: string,
  skillName: string,
  description?: string,
  force = false,
): SkillLabScaffoldResult {
  const normalizedName = sanitizeToken(skillName);
  if (!normalizedName) {
    throw new Error(`Invalid skill name: ${skillName}`);
  }

  const skillDir = join(projectRoot, 'skills', normalizedName);
  if (existsSync(skillDir) && !force) {
    throw new Error(`Skill directory already exists: ${skillDir}`);
  }

  mkdirSync(join(skillDir, 'agents'), { recursive: true });
  mkdirSync(join(skillDir, 'references'), { recursive: true });

  const skillFilePath = join(skillDir, 'SKILL.md');
  const agentConfigPath = join(skillDir, 'agents', 'openai.yaml');
  const resolvedDescription =
    description?.trim() || `Describe what ${normalizedName} does and when it should be used.`;

  writeFileSync(
    skillFilePath,
    `---
name: ${normalizedName}
description: ${resolvedDescription}
---

# ${normalizedName}

Use this skill when the request clearly matches its domain.

## Trigger

- Replace these bullets with concrete trigger conditions

## Workflow

1. Replace this with the minimal working sequence
2. Move detailed guidance into \`references/\` files as needed

## Guardrails

- Keep the scope narrow and explicit
- Avoid duplicating information that should live in references
`,
    'utf-8',
  );

  writeFileSync(
    agentConfigPath,
    `interface:
  display_name: "${normalizedName}"
  short_description: "${resolvedDescription}"
  default_prompt: "Use $${normalizedName} for tasks that match this skill."
`,
    'utf-8',
  );

  return {
    skillDir,
    skillFilePath,
    agentConfigPath,
  };
}
