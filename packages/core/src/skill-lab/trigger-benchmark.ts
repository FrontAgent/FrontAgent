import type { SkillContentResolver } from '../skill-content/resolver.js';
import type { SkillManifest } from '../skill-content/types.js';
import { summarizeResults } from './benchmark.js';
import type {
  SkillTriggerBenchmark,
  SkillTriggerEvalCase,
  SkillTriggerEvalCaseResult,
  SkillTriggerEvalSuite,
} from './types.js';
import { normalizeText, sanitizeToken } from './utils.js';

export function createStarterTriggerSuite(manifest: SkillManifest): SkillTriggerEvalSuite {
  const cases: SkillTriggerEvalCase[] = [];
  const addCase = (testCase: SkillTriggerEvalCase) => {
    if (cases.some((entry) => entry.id === testCase.id || entry.prompt === testCase.prompt)) {
      return;
    }
    cases.push(testCase);
  };

  addCase({
    id: 'explicit-dollar',
    prompt: `Use $${manifest.name} for this task.`,
    expected: 'trigger',
    note: 'Sanity check for explicit $skill invocation.',
  });

  addCase({
    id: 'explicit-name',
    prompt: `Please use ${manifest.name} for this frontend task.`,
    expected: 'trigger',
    note: 'Sanity check for plain skill-name invocation.',
  });

  for (const keyword of manifest.triggers.keywords.slice(0, 4)) {
    addCase({
      id: `keyword-${sanitizeToken(keyword) || 'match'}`,
      prompt: buildPositivePrompt(keyword),
      expected: 'trigger',
      note: `Starter positive case derived from keyword "${keyword}". Replace with a more realistic task if needed.`,
    });
  }

  for (const negative of manifest.triggers.negative.slice(0, 4)) {
    addCase({
      id: `negative-${sanitizeToken(negative) || 'avoid'}`,
      prompt: buildNegativePrompt(negative),
      expected: 'no_trigger',
      note: `Starter negative case derived from negative keyword "${negative}". Replace with a more realistic task if needed.`,
    });
  }

  addCase({
    id: 'generic-unrelated',
    prompt: 'Explain what React useEffect does and when to avoid it.',
    expected: 'no_trigger',
    note: 'Generic unrelated request to catch false positives.',
  });

  addCase({
    id: 'generic-review',
    prompt: 'Review this React diff and report blocking bugs by severity.',
    expected: normalizeText(manifest.name) === 'frontend-reviewer' ? 'trigger' : 'no_trigger',
    note: 'Cross-skill separation check.',
  });

  return {
    version: 1,
    skillName: manifest.name,
    generatedAt: new Date().toISOString(),
    generatedBy: 'frontagent-skill-lab',
    description: `Starter trigger eval suite for ${manifest.name}. Edit these prompts to reflect real tasks before trusting benchmark results.`,
    cases,
  };
}

export function buildPositivePrompt(keyword: string): string {
  const normalized = normalizeText(keyword);
  if (
    /landing|dashboard|hero|page|screen|ui|design|marketing/.test(normalized) ||
    /[一-鿿]/.test(normalized)
  ) {
    return `Please help with a frontend task involving "${keyword}" and deliver a working implementation.`;
  }

  return `Use this skill for a frontend task that clearly matches "${keyword}".`;
}

export function buildNegativePrompt(keyword: string): string {
  return `This request is about "${keyword}" and should not activate an unrelated content skill.`;
}

export function runTriggerBenchmark(
  skillName: string,
  suite: SkillTriggerEvalSuite,
  evalSuitePath: string,
  resolverProjectRoot: string,
  resolver: SkillContentResolver,
): SkillTriggerBenchmark {
  const results: SkillTriggerEvalCaseResult[] = suite.cases.map((testCase) => {
    const resolution = resolver.resolveForTask(testCase.prompt);
    const matchedEntries = resolution.matchedSkills.filter(
      (match) => normalizeText(match.name) === normalizeText(skillName),
    );
    const triggered = matchedEntries.length > 0;

    return {
      id: testCase.id,
      prompt: testCase.prompt,
      expected: testCase.expected,
      triggered,
      pass: testCase.expected === (triggered ? 'trigger' : 'no_trigger'),
      matchedSkillNames: resolution.matchedSkills.map((match) => match.name),
      matchedTerms: [...new Set(matchedEntries.flatMap((match) => match.matchedTerms))],
      matchTypes: [...new Set(matchedEntries.map((match) => match.matchType))],
      note: testCase.note,
    };
  });

  return {
    version: 1,
    skillName,
    evaluatedAt: new Date().toISOString(),
    evalSuitePath,
    resolverProjectRoot,
    summary: summarizeResults(results),
    results,
  };
}
