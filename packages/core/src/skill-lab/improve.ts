import type { z } from 'zod';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { LLMService } from '../llm.js';
import type { SkillContentResolver } from '../skill-content/resolver.js';
import type { SkillManifest } from '../skill-content/types.js';
import { compareBenchmarks } from './benchmark.js';
import { analyzeBehaviorFailures, runBehaviorBenchmark } from './behavior-benchmark.js';
import { writeBenchmarkSummary } from './reporting.js';
import { SkillImprovementSchema } from './schemas.js';
import { runTriggerBenchmark } from './trigger-benchmark.js';
import type {
  SkillBehaviorBenchmark,
  SkillBehaviorEvalSuite,
  SkillLabImproveResult,
  SkillTriggerBenchmark,
  SkillTriggerEvalSuite,
} from './types.js';
import {
  extractReferencedFilesFromMarkdown,
  readOptionalFile,
  stripCodeFences,
  timestampId,
  writeJsonFile,
} from './utils.js';

export interface GenerateImprovedSkillInput {
  skillName: string;
  skillDescription: string;
  currentSkillMarkdown: string;
  currentOpenAIYaml?: string;
  benchmark: SkillTriggerBenchmark;
  behaviorBenchmark?: SkillBehaviorBenchmark;
  behaviorAnalysis?: string[];
}

export async function generateImprovedSkill(
  input: GenerateImprovedSkillInput,
  llmService: LLMService,
): Promise<z.infer<typeof SkillImprovementSchema>> {
  const failureResults = input.benchmark.results.filter((result) => !result.pass);
  const failureSummary =
    failureResults.length === 0
      ? 'No failing evals. Improve concision and trigger precision without broadening scope.'
      : failureResults.map((result) => ({
          id: result.id,
          prompt: result.prompt,
          expected: result.expected,
          triggered: result.triggered,
          matchedSkillNames: result.matchedSkillNames,
          matchedTerms: result.matchedTerms,
          matchTypes: result.matchTypes,
        }));
  const behaviorFailureSummary = input.behaviorBenchmark
    ? input.behaviorBenchmark.results
        .filter((result) => !result.pass)
        .map((result) => ({
          id: result.id,
          prompt: result.prompt,
          expectation: result.expectation,
          triggered: result.triggered,
          triggerPass: result.triggerPass,
          score: `${result.score}/${result.maxScore}`,
          failedChecks: result.checks
            .filter((check) => !check.pass)
            .map((check) => ({
              id: check.id,
              question: check.question,
              rationale: check.rationale,
            })),
        }))
    : undefined;

  const system = `You are FrontAgent's skill-creator. Improve one FrontAgent content skill so it is easier to trigger correctly and easier for the agent to follow.

Rules:
- Keep the skill concise and operational.
- Preserve the same skill name.
- Preserve or tighten the scope. Do not broaden it casually.
- Prefer improving frontmatter description and triggers before expanding body length.
- Keep references/assets progressive-disclosure friendly.
- Do not invent new reference or asset file paths.
- You may revise SKILL.md and agents/openai.yaml only.
- Return plain file contents, not markdown fences.

FrontAgent trigger model:
- explicit aliases are boundary-matched and win immediately
- keyword triggers use substring scoring
- negative keywords subtract score
- when no explicit matches exist, only the highest-scoring implicit matches survive

Your goal is to improve both:
1) trigger precision (false positives/false negatives)
2) behavior quality on the provided binary checks.

Behavior-quality guidance:
- Prefer tightening instructions over adding verbose prose.
- Improve operational output quality, not just trigger keyword stuffing.
- Keep the skill robust for real user tasks.`;

  const messages = [
    {
      role: 'user' as const,
      content: [
        `Skill name: ${input.skillName}`,
        `Skill description: ${input.skillDescription || '(none)'}`,
        '',
        'Current SKILL.md:',
        input.currentSkillMarkdown,
        '',
        'Current agents/openai.yaml:',
        input.currentOpenAIYaml?.trim() || '(none)',
        '',
        'Benchmark summary:',
        JSON.stringify(input.benchmark.summary, null, 2),
        '',
        'Failing cases:',
        typeof failureSummary === 'string'
          ? failureSummary
          : JSON.stringify(failureSummary, null, 2),
        '',
        'Behavior benchmark summary:',
        input.behaviorBenchmark
          ? JSON.stringify(input.behaviorBenchmark.summary, null, 2)
          : '(behavior eval not enabled)',
        '',
        'Behavior failure analysis:',
        input.behaviorAnalysis?.join('\n') || '(none)',
        '',
        'Behavior failing cases:',
        behaviorFailureSummary && behaviorFailureSummary.length > 0
          ? JSON.stringify(behaviorFailureSummary, null, 2)
          : '(none)',
        '',
        'Respond with a JSON object matching the schema.',
      ].join('\n'),
    },
  ];

  return llmService.generateObject({
    messages,
    system,
    schema: SkillImprovementSchema,
    temperature: 0.2,
    maxRetries: 1,
  });
}

export interface ExecuteImprovementInput {
  skillName: string;
  manifest: SkillManifest;
  suite: SkillTriggerEvalSuite;
  suitePath: string;
  behaviorSuite?: SkillBehaviorEvalSuite;
  behaviorSuitePath?: string;
  projectRoot: string;
  userSkillRoots?: string[];
  outputRoot: string;
  llmService: LLMService;
  force?: boolean;
  applyIfBetter?: boolean;
  createResolver: (projectRoot: string, userSkillRoots?: string[]) => SkillContentResolver;
  resolveSkillManifestForRoot: (
    skillName: string,
    projectRoot: string,
    userSkillRoots?: string[],
  ) => SkillManifest;
  promoteCandidate: (skillName: string, candidateId: string) => { backupPath: string };
}

export async function executeImprovement(
  input: ExecuteImprovementInput,
): Promise<SkillLabImproveResult> {
  const {
    skillName,
    manifest,
    suite,
    suitePath,
    behaviorSuite,
    behaviorSuitePath,
    projectRoot,
    userSkillRoots,
    outputRoot,
    llmService,
    force,
    applyIfBetter,
    createResolver,
    resolveSkillManifestForRoot,
    promoteCandidate,
  } = input;

  const resolver = createResolver(projectRoot, userSkillRoots);
  const baseline = runTriggerBenchmark(skillName, suite, suitePath, projectRoot, resolver);
  let baselineBehavior: SkillBehaviorBenchmark | undefined;
  let behaviorAnalysisResult: string[] | undefined;

  if (behaviorSuite && behaviorSuitePath) {
    const behaviorResolver = createResolver(projectRoot, userSkillRoots);
    baselineBehavior = await runBehaviorBenchmark(
      skillName,
      behaviorSuite,
      behaviorSuitePath,
      projectRoot,
      behaviorResolver,
      llmService,
    );
    behaviorAnalysisResult = analyzeBehaviorFailures(baselineBehavior);
  }

  const hasTriggerFailures = baseline.summary.failCount > 0;
  const hasBehaviorFailures = baselineBehavior
    ? baselineBehavior.summary.failCount > 0 || baselineBehavior.summary.checkPassRate < 1
    : false;

  if (!hasTriggerFailures && !hasBehaviorFailures && !force) {
    throw new Error(
      'Baseline already passes all available evals. Rerun with force=true if you still want to draft a candidate.',
    );
  }

  const candidateId = timestampId();
  const skillLabDir = outputRoot;
  const candidateProjectRoot = join(skillLabDir, 'candidates', candidateId);
  const candidateSkillDir = join(candidateProjectRoot, 'skills', skillName);

  const currentSkillMarkdown = readFileSync(manifest.skillFilePath, 'utf-8');
  const currentOpenAIYamlPath = join(manifest.rootDir, 'agents', 'openai.yaml');
  const currentOpenAIYaml = readOptionalFile(currentOpenAIYamlPath);

  const improvement = await generateImprovedSkill(
    {
      skillName,
      skillDescription: manifest.description,
      currentSkillMarkdown,
      currentOpenAIYaml,
      benchmark: baseline,
      behaviorBenchmark: baselineBehavior,
      behaviorAnalysis: behaviorAnalysisResult,
    },
    llmService,
  );

  mkdirSync(dirname(candidateSkillDir), { recursive: true });
  cpSync(manifest.rootDir, candidateSkillDir, { recursive: true });
  writeFileSync(
    join(candidateSkillDir, 'SKILL.md'),
    `${stripCodeFences(improvement.revisedSkillMarkdown).trim()}\n`,
    'utf-8',
  );

  if (improvement.revisedOpenAIYaml?.trim()) {
    const targetYamlPath = join(candidateSkillDir, 'agents', 'openai.yaml');
    mkdirSync(dirname(targetYamlPath), { recursive: true });
    writeFileSync(
      targetYamlPath,
      `${stripCodeFences(improvement.revisedOpenAIYaml).trim()}\n`,
      'utf-8',
    );
  }

  const candidateMarkdown = readFileSync(join(candidateSkillDir, 'SKILL.md'), 'utf-8');
  const missingReferencedFiles = extractReferencedFilesFromMarkdown(candidateMarkdown)
    .map((relativePath) => resolve(candidateSkillDir, relativePath))
    .filter((absolutePath) => !existsSync(absolutePath));

  const fallbackRoots = [
    join(projectRoot, 'skills'),
    ...(userSkillRoots ?? []),
  ];
  const candidateManifest = resolveSkillManifestForRoot(
    skillName,
    candidateProjectRoot,
    fallbackRoots,
  );
  if (resolve(candidateManifest.rootDir) !== resolve(candidateSkillDir)) {
    throw new Error(
      `Candidate skill validation failed: expected resolver to load ${candidateSkillDir}, but loaded ${candidateManifest.rootDir} instead.`,
    );
  }

  const candidateResolver = createResolver(candidateProjectRoot, fallbackRoots);
  const candidate = runTriggerBenchmark(
    skillName,
    suite,
    suitePath,
    candidateProjectRoot,
    candidateResolver,
  );
  let candidateBehavior: SkillBehaviorBenchmark | undefined;
  if (behaviorSuite && behaviorSuitePath) {
    const candidateBehaviorResolver = createResolver(candidateProjectRoot, fallbackRoots);
    candidateBehavior = await runBehaviorBenchmark(
      skillName,
      behaviorSuite,
      behaviorSuitePath,
      candidateProjectRoot,
      candidateBehaviorResolver,
      llmService,
    );
  }

  const comparison = compareBenchmarks(baseline, candidate, baselineBehavior, candidateBehavior);
  if (missingReferencedFiles.length > 0) {
    comparison.reasons.push(
      `Candidate references missing files: ${missingReferencedFiles.map((path) => path.replace(`${candidateSkillDir}/`, '')).join(', ')}`,
    );
    comparison.improved = false;
  }

  const benchmarkPath = join(candidateProjectRoot, 'benchmark.json');
  const summaryPath = join(candidateProjectRoot, 'summary.md');
  writeJsonFile(benchmarkPath, {
    version: 1,
    skillName,
    candidateId,
    createdAt: new Date().toISOString(),
    analysisSummary: improvement.analysisSummary,
    changes: improvement.changes,
    comparison,
    baseline,
    candidate,
    baselineBehavior,
    candidateBehavior,
    behaviorAnalysis: behaviorAnalysisResult,
    missingReferencedFiles,
  });
  writeBenchmarkSummary(summaryPath, candidate, baseline, comparison, {
    analysisSummary: improvement.analysisSummary,
    changes: improvement.changes,
    missingReferencedFiles,
    behaviorBenchmark: candidateBehavior,
    baselineBehaviorBenchmark: baselineBehavior,
    behaviorAnalysis: behaviorAnalysisResult,
  });

  let applied = false;
  let backupPath: string | undefined;
  if (applyIfBetter && comparison.improved) {
    const promotion = promoteCandidate(skillName, candidateId);
    applied = true;
    backupPath = promotion.backupPath;
  }

  return {
    candidateId,
    candidateRoot: candidateProjectRoot,
    candidateSkillDir,
    baseline,
    candidate,
    baselineBehavior,
    candidateBehavior,
    comparison,
    benchmarkPath,
    summaryPath,
    analysisSummary: improvement.analysisSummary,
    changes: improvement.changes,
    applied,
    backupPath,
  };
}

