import type { LLMService } from '../llm.js';
import type { SkillContentResolver } from '../skill-content/resolver.js';
import type { SkillManifest } from '../skill-content/types.js';
import { BehaviorCaseGradeSchema } from './schemas.js';
import { summarizeBehaviorResults } from './benchmark.js';
import type {
  SkillBehaviorBenchmark,
  SkillBehaviorCheckResult,
  SkillBehaviorEvalCase,
  SkillBehaviorEvalCaseResult,
  SkillBehaviorEvalSuite,
} from './types.js';
import { normalizeText, sanitizeToken, truncateText } from './utils.js';

export async function runBehaviorBenchmark(
  skillName: string,
  suite: SkillBehaviorEvalSuite,
  evalSuitePath: string,
  resolverProjectRoot: string,
  resolver: SkillContentResolver,
  llmService: LLMService,
): Promise<SkillBehaviorBenchmark> {
  const results: SkillBehaviorEvalCaseResult[] = [];

  for (const testCase of suite.cases) {
    results.push(
      await runBehaviorCase({
        skillName,
        testCase,
        resolver,
        llmService,
      }),
    );
  }

  return {
    version: 1,
    skillName,
    evaluatedAt: new Date().toISOString(),
    evalSuitePath,
    resolverProjectRoot,
    summary: summarizeBehaviorResults(results),
    results,
  };
}

async function runBehaviorCase(input: {
  skillName: string;
  testCase: SkillBehaviorEvalCase;
  resolver: SkillContentResolver;
  llmService: LLMService;
}): Promise<SkillBehaviorEvalCaseResult> {
  const { skillName, testCase, resolver, llmService } = input;
  const resolution = resolver.resolveForTask(testCase.prompt);
  const matchedEntries = resolution.matchedSkills.filter(
    (match) => normalizeText(match.name) === normalizeText(skillName),
  );
  const triggered = matchedEntries.length > 0;
  const expectation = testCase.expectation ?? 'trigger';
  const triggerPass =
    expectation === 'either' ? true : expectation === 'trigger' ? triggered : !triggered;
  const sanitizedPrompt = resolution.sanitizedTaskDescription?.trim() || testCase.prompt;
  const skillContext = resolution.promptContext?.trim();

  const output = await llmService.generateText({
    system: [
      'You are FrontAgent running a behavior eval sandbox.',
      'Answer the user task directly and practically.',
      'Follow activated skill instructions when provided.',
      'Do not mention hidden reasoning or evaluation setup.',
      skillContext ? '' : 'No content skill was activated.',
      skillContext ?? '',
    ]
      .join('\n')
      .trim(),
    messages: [
      {
        role: 'user',
        content: sanitizedPrompt,
      },
    ],
    temperature: 0.2,
    maxTokens: 1800,
  });

  const checks = await gradeBehaviorCase({
    testCase,
    prompt: sanitizedPrompt,
    output,
    llmService,
  });

  const maxScore = checks.reduce((sum, check) => sum + check.weight, 0);
  const score = checks.reduce((sum, check) => sum + (check.pass ? check.weight : 0), 0);
  const passCount = checks.filter((check) => check.pass).length;
  const passRate = checks.length === 0 ? 0 : Number((passCount / checks.length).toFixed(4));
  const pass = triggerPass && score >= maxScore;

  return {
    id: testCase.id,
    prompt: testCase.prompt,
    expectation,
    triggered,
    triggerPass,
    pass,
    score,
    maxScore,
    passRate,
    matchedSkillNames: resolution.matchedSkills.map((match) => match.name),
    matchedTerms: [...new Set(matchedEntries.flatMap((match) => match.matchedTerms))],
    matchTypes: [...new Set(matchedEntries.map((match) => match.matchType))],
    output: truncateText(output, 8000),
    checks,
    note: testCase.note,
  };
}

async function gradeBehaviorCase(input: {
  testCase: SkillBehaviorEvalCase;
  prompt: string;
  output: string;
  llmService: LLMService;
}): Promise<SkillBehaviorCheckResult[]> {
  const grade = await input.llmService.generateObject({
    system: `You are a strict binary grader for FrontAgent skill behavior evals.

Rules:
- Evaluate each check independently.
- Pass only when the output clearly satisfies the pass criteria.
- If evidence is missing or ambiguous, fail the check.
- Keep rationale short and concrete.
- Return JSON only.`,
    messages: [
      {
        role: 'user',
        content: [
          `Eval case: ${input.testCase.id}`,
          '',
          'Prompt:',
          input.prompt,
          '',
          'Model output:',
          input.output,
          '',
          'Checks:',
          JSON.stringify(input.testCase.checks, null, 2),
        ].join('\n'),
      },
    ],
    schema: BehaviorCaseGradeSchema,
    temperature: 0,
    maxTokens: 1800,
    maxRetries: 1,
  });

  const byId = new Map<string, { pass: boolean; rationale: string }>();
  for (const check of grade.checks) {
    byId.set(normalizeText(check.id), {
      pass: check.pass,
      rationale: check.rationale,
    });
  }

  return input.testCase.checks.map((check) => {
    const verdict = byId.get(normalizeText(check.id));
    return {
      id: check.id,
      question: check.question,
      pass: verdict?.pass ?? false,
      rationale: verdict?.rationale ?? 'Grader did not return a verdict for this check.',
      weight: check.weight ?? 1,
    };
  });
}

export function analyzeBehaviorFailures(benchmark: SkillBehaviorBenchmark): string[] {
  const failingCases = benchmark.results.filter((result) => !result.pass);
  if (failingCases.length === 0) {
    return ['No behavior failures were observed in the baseline suite.'];
  }

  const failureByCheck = new Map<string, { question: string; count: number }>();
  for (const result of failingCases) {
    for (const check of result.checks) {
      if (check.pass) {
        continue;
      }
      const existing = failureByCheck.get(check.id);
      if (existing) {
        existing.count += 1;
      } else {
        failureByCheck.set(check.id, {
          question: check.question,
          count: 1,
        });
      }
    }
  }

  const topChecks = Array.from(failureByCheck.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6)
    .map(([id, data]) => `${id}: failed in ${data.count} case(s) - ${data.question}`);

  return [`Failing cases: ${failingCases.length}/${benchmark.summary.totalCases}.`, ...topChecks];
}

export function createStarterBehaviorSuite(manifest: SkillManifest): SkillBehaviorEvalSuite {
  const cases: SkillBehaviorEvalCase[] = [];
  const addCase = (testCase: SkillBehaviorEvalCase) => {
    if (cases.some((entry) => entry.id === testCase.id || entry.prompt === testCase.prompt)) {
      return;
    }
    cases.push(testCase);
  };

  const seedKeywords =
    manifest.triggers.keywords.length > 0
      ? manifest.triggers.keywords.slice(0, 3)
      : [manifest.name];

  for (const keyword of seedKeywords) {
    const keywordToken = sanitizeToken(keyword) || 'behavior';
    addCase({
      id: `behavior-${keywordToken}`,
      prompt: buildBehaviorPrompt(keyword),
      expectation: 'trigger',
      checks: createStarterBehaviorChecks(keyword),
      note: `Starter behavior case from keyword "${keyword}". Replace with real production prompts for reliable evaluation.`,
    });
  }

  addCase({
    id: 'behavior-explicit',
    prompt: `Please use $${manifest.name} and deliver an implementation-ready answer for this frontend request.`,
    expectation: 'trigger',
    checks: createStarterBehaviorChecks(manifest.name),
    note: 'Explicit invocation sanity check for behavior quality.',
  });

  addCase({
    id: 'behavior-no-trigger',
    prompt: 'Explain JavaScript closures with a short practical example.',
    expectation: normalizeText(manifest.name) === 'frontend-reviewer' ? 'trigger' : 'no_trigger',
    checks: createNoTriggerBehaviorChecks(),
    note: 'Boundary case to catch prompt-context leakage when the skill should stay inactive.',
  });

  return {
    version: 1,
    skillName: manifest.name,
    generatedAt: new Date().toISOString(),
    generatedBy: 'frontagent-skill-lab',
    description: `Starter behavior eval suite for ${manifest.name}. Edit prompts/checks to match real user outcomes before relying on benchmark decisions.`,
    cases,
  };
}

export function buildBehaviorPrompt(keyword: string): string {
  const normalized = normalizeText(keyword);
  if (/review|audit|bug|issue/.test(normalized)) {
    return `Review this frontend change request around "${keyword}" and provide a concrete, prioritized action plan.`;
  }
  if (
    /landing|dashboard|hero|page|screen|ui|design|marketing/.test(normalized) ||
    /[一-鿿]/.test(normalized)
  ) {
    return `Implement a frontend task centered on "${keyword}" and explain the final deliverable clearly.`;
  }
  return `Handle this frontend task involving "${keyword}" with implementation-ready instructions.`;
}

export function createStarterBehaviorChecks(keyword: string): SkillBehaviorEvalCase['checks'] {
  return [
    {
      id: 'actionable-output',
      question:
        'Does the answer provide concrete implementation guidance instead of vague high-level advice?',
      passCriteria:
        'Contains specific steps, code-level instructions, or implementation details tied to the request.',
      failCriteria: 'Only gives generic principles with no actionable implementation details.',
      weight: 1,
    },
    {
      id: 'scope-discipline',
      question:
        'Does the answer stay focused on the task scope implied by the prompt and keyword?',
      passCriteria: `Focuses on "${keyword}" and related request scope without drifting into unrelated domains.`,
      failCriteria:
        'Derails into unrelated topics or broad advice that does not help complete the requested task.',
      weight: 1,
    },
    {
      id: 'clarity-structure',
      question: 'Is the answer well-structured and easy to execute?',
      passCriteria:
        'Uses clear sections or steps, avoids contradictions, and remains concise enough to follow.',
      failCriteria:
        'Hard to follow, contradictory, or excessively verbose for the requested task.',
      weight: 1,
    },
  ];
}

export function createNoTriggerBehaviorChecks(): SkillBehaviorEvalCase['checks'] {
  return [
    {
      id: 'direct-answer',
      question:
        'Does the answer still solve the user request directly even when the target skill should not trigger?',
      passCriteria: 'Provides a useful direct answer to the prompt.',
      failCriteria: 'Avoids answering or turns into meta discussion about skills/evaluation.',
      weight: 1,
    },
    {
      id: 'no-internal-leakage',
      question:
        'Does the answer avoid exposing internal evaluation setup or hidden skill-context artifacts?',
      passCriteria:
        'Contains no references to internal grading, benchmark, or activated-skill metadata.',
      failCriteria: 'Mentions internal benchmark/eval setup or leaked skill-context internals.',
      weight: 1,
    },
  ];
}



