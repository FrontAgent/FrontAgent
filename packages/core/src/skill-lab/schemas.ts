import { z } from 'zod';

export const TriggerEvalSuiteSchema = z.object({
  version: z.literal(1),
  skillName: z.string().min(1),
  generatedAt: z.string().min(1),
  generatedBy: z.literal('frontagent-skill-lab'),
  description: z.string().min(1),
  cases: z
    .array(
      z.object({
        id: z.string().min(1),
        prompt: z.string().min(1),
        expected: z.enum(['trigger', 'no_trigger']),
        note: z.string().optional(),
      }),
    )
    .min(1),
});

export const BehaviorEvalSuiteSchema = z.object({
  version: z.literal(1),
  skillName: z.string().min(1),
  generatedAt: z.string().min(1),
  generatedBy: z.literal('frontagent-skill-lab'),
  description: z.string().min(1),
  cases: z
    .array(
      z.object({
        id: z.string().min(1),
        prompt: z.string().min(1),
        expectation: z.enum(['trigger', 'no_trigger', 'either']).optional(),
        checks: z
          .array(
            z.object({
              id: z.string().min(1),
              question: z.string().min(1),
              passCriteria: z.string().min(1),
              failCriteria: z.string().min(1),
              weight: z.number().positive().optional(),
            }),
          )
          .min(1),
        note: z.string().optional(),
      }),
    )
    .min(1),
});

export const SkillImprovementSchema = z.object({
  analysisSummary: z.string().min(1),
  changes: z.array(z.string()).min(1),
  revisedSkillMarkdown: z.string().min(1),
  revisedOpenAIYaml: z.string().optional(),
});

export const BehaviorCaseGradeSchema = z.object({
  summary: z.string().min(1),
  checks: z
    .array(
      z.object({
        id: z.string().min(1),
        pass: z.boolean(),
        rationale: z.string().min(1),
      }),
    )
    .min(1),
});
