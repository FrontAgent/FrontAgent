import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { z } from 'zod';
import { LLMService } from '../llm.js';
import { SkillContentLoader } from '../skill-content/loader.js';
import { SkillContentResolver } from '../skill-content/resolver.js';
import type { SkillManifest } from '../skill-content/types.js';
import type { SkillLabConfig } from './types.js';
import type {
  SkillBehaviorBenchmark,
  SkillBehaviorBenchmarkSummary,
  SkillBehaviorCheckResult,
  SkillBehaviorComparison,
  SkillBehaviorEvalCase,
  SkillBehaviorEvalCaseResult,
  SkillBehaviorEvalSuite,
  SkillBenchmarkComparison,
  SkillLabBenchmarkResult,
  SkillLabBehaviorInitResult,
  SkillLabImproveOptions,
  SkillLabImproveResult,
  SkillLabInitResult,
  SkillLabPromotionResult,
  SkillLabScaffoldResult,
  SkillLabSkillSummary,
  SkillTriggerBenchmark,
  SkillTriggerBenchmarkSummary,
  SkillTriggerEvalCase,
  SkillTriggerEvalCaseResult,
  SkillTriggerEvalSuite,
} from './types.js';

const TriggerEvalSuiteSchema = z.object({
  version: z.literal(1),
  skillName: z.string().min(1),
  generatedAt: z.string().min(1),
  generatedBy: z.literal('frontagent-skill-lab'),
  description: z.string().min(1),
  cases: z.array(z.object({
    id: z.string().min(1),
    prompt: z.string().min(1),
    expected: z.enum(['trigger', 'no_trigger']),
    note: z.string().optional(),
  })).min(1),
});

const BehaviorEvalSuiteSchema = z.object({
  version: z.literal(1),
  skillName: z.string().min(1),
  generatedAt: z.string().min(1),
  generatedBy: z.literal('frontagent-skill-lab'),
  description: z.string().min(1),
  cases: z.array(z.object({
    id: z.string().min(1),
    prompt: z.string().min(1),
    expectation: z.enum(['trigger', 'no_trigger', 'either']).optional(),
    checks: z.array(z.object({
      id: z.string().min(1),
      question: z.string().min(1),
      passCriteria: z.string().min(1),
      failCriteria: z.string().min(1),
      weight: z.number().positive().optional(),
    })).min(1),
    note: z.string().optional(),
  })).min(1),
});

const SkillImprovementSchema = z.object({
  analysisSummary: z.string().min(1),
  changes: z.array(z.string()).min(1),
  revisedSkillMarkdown: z.string().min(1),
  revisedOpenAIYaml: z.string().optional(),
});

const BehaviorCaseGradeSchema = z.object({
  summary: z.string().min(1),
  checks: z.array(z.object({
    id: z.string().min(1),
    pass: z.boolean(),
    rationale: z.string().min(1),
  })).min(1),
});

function normalizeText(input: string): string {
  return input.toLowerCase().replace(/\s+/g, ' ').trim();
}

function sanitizeToken(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function timestampId(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function writeJsonFile(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

function stripCodeFences(input: string): string {
  const trimmed = input.trim();
  const fenced = trimmed.match(/^```(?:[a-zA-Z0-9_-]+)?\s*\n([\s\S]*?)\n```$/);
  return fenced ? fenced[1].trim() : trimmed;
}

function extractReferencedFilesFromMarkdown(markdown: string): string[] {
  const matches = markdown.matchAll(/`((?:references|assets)\/[^`]+)`/g);
  const paths = new Set<string>();
  for (const match of matches) {
    if (match[1]) {
      paths.add(match[1]);
    }
  }
  return Array.from(paths);
}

function readOptionalFile(path: string): string | undefined {
  if (!existsSync(path)) {
    return undefined;
  }
  return readFileSync(path, 'utf-8');
}

function truncateText(input: string, maxLength: number): string {
  if (input.length <= maxLength) {
    return input;
  }
  return `${input.slice(0, maxLength)}\n...`;
}

function summarizeResults(results: SkillTriggerEvalCaseResult[]): SkillTriggerBenchmarkSummary {
  let passCount = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let expectedTriggerCount = 0;
  let expectedNoTriggerCount = 0;
  let explicitMatches = 0;
  let keywordMatches = 0;
  let noMatches = 0;

  for (const result of results) {
    if (result.pass) {
      passCount += 1;
    }

    if (result.expected === 'trigger') {
      expectedTriggerCount += 1;
      if (!result.triggered) {
        falseNegatives += 1;
      }
    } else {
      expectedNoTriggerCount += 1;
      if (result.triggered) {
        falsePositives += 1;
      }
    }

    if (result.matchTypes.length === 0) {
      noMatches += 1;
    } else {
      explicitMatches += result.matchTypes.filter((type) => type === 'explicit').length;
      keywordMatches += result.matchTypes.filter((type) => type === 'keyword').length;
    }
  }

  const totalCases = results.length;
  const failCount = totalCases - passCount;

  return {
    totalCases,
    passCount,
    failCount,
    passRate: totalCases === 0 ? 0 : Number((passCount / totalCases).toFixed(4)),
    falsePositives,
    falseNegatives,
    expectedTriggerCount,
    expectedNoTriggerCount,
    explicitMatches,
    keywordMatches,
    noMatches,
  };
}

function summarizeBehaviorResults(results: SkillBehaviorEvalCaseResult[]): SkillBehaviorBenchmarkSummary {
  let passCount = 0;
  let totalChecks = 0;
  let passedChecks = 0;
  let totalScore = 0;
  let maxScore = 0;
  let triggerExpectationFailures = 0;

  for (const result of results) {
    if (result.pass) {
      passCount += 1;
    }
    totalChecks += result.checks.length;
    passedChecks += result.checks.filter((check) => check.pass).length;
    totalScore += result.score;
    maxScore += result.maxScore;
    if (!result.triggerPass) {
      triggerExpectationFailures += 1;
    }
  }

  const totalCases = results.length;
  const failCount = totalCases - passCount;

  return {
    totalCases,
    passCount,
    failCount,
    passRate: totalCases === 0 ? 0 : Number((passCount / totalCases).toFixed(4)),
    totalChecks,
    passedChecks,
    checkPassRate: totalChecks === 0 ? 0 : Number((passedChecks / totalChecks).toFixed(4)),
    totalScore,
    maxScore,
    scoreRate: maxScore === 0 ? 0 : Number((totalScore / maxScore).toFixed(4)),
    triggerExpectationFailures,
  };
}

function compareBehaviorBenchmarks(
  baseline: SkillBehaviorBenchmark,
  candidate: SkillBehaviorBenchmark,
): SkillBehaviorComparison {
  const reasons: string[] = [];
  const baselineSummary = baseline.summary;
  const candidateSummary = candidate.summary;

  const scoreDelta = candidateSummary.scoreRate - baselineSummary.scoreRate;
  const checkDelta = candidateSummary.checkPassRate - baselineSummary.checkPassRate;
  const triggerFailDelta = candidateSummary.triggerExpectationFailures - baselineSummary.triggerExpectationFailures;

  if (scoreDelta > 0) {
    reasons.push(
      `Behavior score rate improved from ${(baselineSummary.scoreRate * 100).toFixed(1)}% to ${(candidateSummary.scoreRate * 100).toFixed(1)}%.`,
    );
  } else if (scoreDelta < 0) {
    reasons.push(
      `Behavior score rate dropped from ${(baselineSummary.scoreRate * 100).toFixed(1)}% to ${(candidateSummary.scoreRate * 100).toFixed(1)}%.`,
    );
  }

  if (checkDelta > 0) {
    reasons.push(
      `Behavior check pass rate improved from ${(baselineSummary.checkPassRate * 100).toFixed(1)}% to ${(candidateSummary.checkPassRate * 100).toFixed(1)}%.`,
    );
  } else if (checkDelta < 0) {
    reasons.push(
      `Behavior check pass rate dropped from ${(baselineSummary.checkPassRate * 100).toFixed(1)}% to ${(candidateSummary.checkPassRate * 100).toFixed(1)}%.`,
    );
  }

  if (triggerFailDelta < 0) {
    reasons.push(
      `Behavior trigger expectation failures decreased from ${baselineSummary.triggerExpectationFailures} to ${candidateSummary.triggerExpectationFailures}.`,
    );
  } else if (triggerFailDelta > 0) {
    reasons.push(
      `Behavior trigger expectation failures increased from ${baselineSummary.triggerExpectationFailures} to ${candidateSummary.triggerExpectationFailures}.`,
    );
  }

  if (reasons.length === 0) {
    reasons.push('Behavior benchmark was identical to baseline on the provided eval suite.');
  }

  const nonRegression =
    candidateSummary.scoreRate >= baselineSummary.scoreRate &&
    candidateSummary.checkPassRate >= baselineSummary.checkPassRate &&
    candidateSummary.triggerExpectationFailures <= baselineSummary.triggerExpectationFailures;
  const improved =
    nonRegression &&
    (
      candidateSummary.scoreRate > baselineSummary.scoreRate ||
      candidateSummary.checkPassRate > baselineSummary.checkPassRate ||
      candidateSummary.triggerExpectationFailures < baselineSummary.triggerExpectationFailures
    );

  return {
    improved,
    baselineScoreRate: baselineSummary.scoreRate,
    candidateScoreRate: candidateSummary.scoreRate,
    baselineCheckPassRate: baselineSummary.checkPassRate,
    candidateCheckPassRate: candidateSummary.checkPassRate,
    baselineTriggerExpectationFailures: baselineSummary.triggerExpectationFailures,
    candidateTriggerExpectationFailures: candidateSummary.triggerExpectationFailures,
    reasons,
  };
}

function compareBenchmarks(
  baseline: SkillTriggerBenchmark,
  candidate: SkillTriggerBenchmark,
  baselineBehavior?: SkillBehaviorBenchmark,
  candidateBehavior?: SkillBehaviorBenchmark,
): SkillBenchmarkComparison {
  const reasons: string[] = [];
  const baselineErrors = baseline.summary.falsePositives + baseline.summary.falseNegatives;
  const candidateErrors = candidate.summary.falsePositives + candidate.summary.falseNegatives;
  const triggerNonRegression =
    candidate.summary.passRate >= baseline.summary.passRate &&
    candidateErrors <= baselineErrors;
  const triggerImprovement =
    candidate.summary.passRate > baseline.summary.passRate ||
    candidateErrors < baselineErrors;
  let improved = triggerNonRegression && triggerImprovement;

  if (candidate.summary.passRate > baseline.summary.passRate) {
    reasons.push(
      `Pass rate improved from ${(baseline.summary.passRate * 100).toFixed(1)}% to ${(candidate.summary.passRate * 100).toFixed(1)}%.`,
    );
  } else if (candidate.summary.passRate < baseline.summary.passRate) {
    reasons.push(
      `Pass rate dropped from ${(baseline.summary.passRate * 100).toFixed(1)}% to ${(candidate.summary.passRate * 100).toFixed(1)}%.`,
    );
  }

  if (candidateErrors < baselineErrors) {
    reasons.push(`Classification errors decreased from ${baselineErrors} to ${candidateErrors}.`);
  } else if (candidateErrors > baselineErrors) {
    reasons.push(`Classification errors increased from ${baselineErrors} to ${candidateErrors}.`);
  }

  let behaviorComparison: SkillBehaviorComparison | undefined;
  if (baselineBehavior && candidateBehavior) {
    behaviorComparison = compareBehaviorBenchmarks(baselineBehavior, candidateBehavior);
    reasons.push(...behaviorComparison.reasons);
    improved = triggerNonRegression && behaviorComparison.improved && (triggerImprovement || behaviorComparison.improved);
  }

  if (reasons.length === 0) {
    reasons.push('Candidate benchmark was identical to baseline on the provided eval suite.');
  }

  return {
    improved,
    baselinePassRate: baseline.summary.passRate,
    candidatePassRate: candidate.summary.passRate,
    reasons,
    behavior: behaviorComparison,
  };
}

export class SkillLab {
  private readonly config: Required<Pick<SkillLabConfig, 'projectRoot' | 'outputRoot' | 'debug'>> & Omit<SkillLabConfig, 'projectRoot' | 'outputRoot' | 'debug'>;
  private readonly llmService?: LLMService;

  constructor(config: SkillLabConfig) {
    this.config = {
      ...config,
      projectRoot: resolve(config.projectRoot),
      outputRoot: resolve(config.outputRoot ?? join(config.projectRoot, '.frontagent', 'skill-lab')),
      debug: config.debug ?? false,
    };

    if (config.llm) {
      this.llmService = new LLMService(config.llm);
    }
  }

  listSkills(): SkillLabSkillSummary[] {
    const loader = this.createLoader(this.config.projectRoot, this.config.skillContent?.userSkillRoots);
    return loader.listSkills().map((skill) => ({
      name: skill.name,
      description: skill.description,
      source: skill.source,
      rootDir: skill.rootDir,
      skillFilePath: skill.skillFilePath,
    }));
  }

  scaffoldSkill(skillName: string, description?: string, force = false): SkillLabScaffoldResult {
    const normalizedName = sanitizeToken(skillName);
    if (!normalizedName) {
      throw new Error(`Invalid skill name: ${skillName}`);
    }

    const skillDir = join(this.config.projectRoot, 'skills', normalizedName);
    if (existsSync(skillDir) && !force) {
      throw new Error(`Skill directory already exists: ${skillDir}`);
    }

    mkdirSync(join(skillDir, 'agents'), { recursive: true });
    mkdirSync(join(skillDir, 'references'), { recursive: true });

    const skillFilePath = join(skillDir, 'SKILL.md');
    const agentConfigPath = join(skillDir, 'agents', 'openai.yaml');
    const resolvedDescription = description?.trim() || `Describe what ${normalizedName} does and when it should be used.`;

    writeFileSync(skillFilePath, `---
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
`, 'utf-8');

    writeFileSync(agentConfigPath, `interface:
  display_name: "${normalizedName}"
  short_description: "${resolvedDescription}"
  default_prompt: "Use $${normalizedName} for tasks that match this skill."
`, 'utf-8');

    return {
      skillDir,
      skillFilePath,
      agentConfigPath,
    };
  }

  initTriggerEvals(skillName: string, outputPath?: string, force = false): SkillLabInitResult {
    const manifest = this.resolveSkillManifest(skillName);
    const suite = this.createStarterSuite(manifest);
    const targetPath = resolve(
      outputPath ?? join(this.getSkillLabDir(skillName), 'trigger-evals.json'),
    );

    if (existsSync(targetPath) && !force) {
      throw new Error(`Trigger eval suite already exists: ${targetPath}`);
    }

    writeJsonFile(targetPath, suite);
    return { evalSuitePath: targetPath, suite };
  }

  initBehaviorEvals(skillName: string, outputPath?: string, force = false): SkillLabBehaviorInitResult {
    const manifest = this.resolveSkillManifest(skillName);
    const suite = this.createStarterBehaviorSuite(manifest);
    const targetPath = resolve(
      outputPath ?? join(this.getSkillLabDir(skillName), 'behavior-evals.json'),
    );

    if (existsSync(targetPath) && !force) {
      throw new Error(`Behavior eval suite already exists: ${targetPath}`);
    }

    writeJsonFile(targetPath, suite);
    return { evalSuitePath: targetPath, suite };
  }

  async benchmarkSkill(
    skillName: string,
    evalSuitePathOrOptions?: string | { evalSuitePath?: string; behaviorEvalSuitePath?: string; includeBehaviorEval?: boolean },
  ): Promise<SkillLabBenchmarkResult> {
    const benchmarkOptions = typeof evalSuitePathOrOptions === 'string'
      ? { evalSuitePath: evalSuitePathOrOptions, includeBehaviorEval: false, behaviorEvalSuitePath: undefined }
      : {
          evalSuitePath: evalSuitePathOrOptions?.evalSuitePath,
          includeBehaviorEval: Boolean(evalSuitePathOrOptions?.includeBehaviorEval || evalSuitePathOrOptions?.behaviorEvalSuitePath),
          behaviorEvalSuitePath: evalSuitePathOrOptions?.behaviorEvalSuitePath,
        };
    const suitePath = this.resolveEvalSuitePath(skillName, benchmarkOptions.evalSuitePath);
    const suite = this.readEvalSuite(suitePath);
    const benchmark = this.runBenchmark(
      skillName,
      suite,
      suitePath,
      this.config.projectRoot,
      this.config.skillContent?.userSkillRoots,
    );
    const runId = timestampId();
    const runDir = join(this.getSkillLabDir(skillName), 'runs');
    const outputPath = join(runDir, `${runId}-baseline.json`);
    const summaryPath = join(runDir, `${runId}-baseline.md`);
    writeJsonFile(outputPath, benchmark);
    let behaviorBenchmark: SkillBehaviorBenchmark | undefined;
    let behaviorOutputPath: string | undefined;

    if (benchmarkOptions.includeBehaviorEval) {
      if (!this.llmService) {
        throw new Error('Behavior benchmark requires LLM configuration.');
      }
      const behaviorSuitePath = this.resolveBehaviorEvalSuitePath(skillName, benchmarkOptions.behaviorEvalSuitePath);
      const behaviorSuite = this.readBehaviorEvalSuite(behaviorSuitePath);
      behaviorBenchmark = await this.runBehaviorBenchmark(
        skillName,
        behaviorSuite,
        behaviorSuitePath,
        this.config.projectRoot,
        this.config.skillContent?.userSkillRoots,
      );
      behaviorOutputPath = join(runDir, `${runId}-baseline-behavior.json`);
      writeJsonFile(behaviorOutputPath, behaviorBenchmark);
    }

    this.writeBenchmarkSummary(summaryPath, benchmark, undefined, undefined, {
      behaviorBenchmark,
    });
    return { benchmark, outputPath, summaryPath, behaviorBenchmark, behaviorOutputPath };
  }

  async improveSkill(skillName: string, options: SkillLabImproveOptions = {}): Promise<SkillLabImproveResult> {
    if (!this.llmService) {
      throw new Error('Skill improvement requires LLM configuration.');
    }

    const manifest = this.resolveSkillManifest(skillName);
    const includeBehaviorEval = Boolean(options.includeBehaviorEval || options.behaviorEvalSuitePath);
    const suitePath = this.resolveEvalSuitePath(skillName, options.evalSuitePath);
    const suite = this.readEvalSuite(suitePath);
    const baseline = this.runBenchmark(
      skillName,
      suite,
      suitePath,
      this.config.projectRoot,
      this.config.skillContent?.userSkillRoots,
    );
    let behaviorSuitePath: string | undefined;
    let behaviorSuite: SkillBehaviorEvalSuite | undefined;
    let baselineBehavior: SkillBehaviorBenchmark | undefined;
    let behaviorAnalysis: string[] | undefined;

    if (includeBehaviorEval) {
      behaviorSuitePath = this.resolveBehaviorEvalSuitePath(skillName, options.behaviorEvalSuitePath);
      behaviorSuite = this.readBehaviorEvalSuite(behaviorSuitePath);
      baselineBehavior = await this.runBehaviorBenchmark(
        skillName,
        behaviorSuite,
        behaviorSuitePath,
        this.config.projectRoot,
        this.config.skillContent?.userSkillRoots,
      );
      behaviorAnalysis = this.analyzeBehaviorFailures(baselineBehavior);
    }

    const hasTriggerFailures = baseline.summary.failCount > 0;
    const hasBehaviorFailures = baselineBehavior
      ? baselineBehavior.summary.failCount > 0 || baselineBehavior.summary.checkPassRate < 1
      : false;

    if (!hasTriggerFailures && !hasBehaviorFailures && !options.force) {
      throw new Error(
        `Baseline already passes all available evals. Rerun with force=true if you still want to draft a candidate.`,
      );
    }

    const candidateId = timestampId();
    const candidateProjectRoot = join(this.getSkillLabDir(skillName), 'candidates', candidateId);
    const candidateSkillDir = join(candidateProjectRoot, 'skills', skillName);

    const currentSkillMarkdown = readFileSync(manifest.skillFilePath, 'utf-8');
    const currentOpenAIYamlPath = join(manifest.rootDir, 'agents', 'openai.yaml');
    const currentOpenAIYaml = readOptionalFile(currentOpenAIYamlPath);

    const improvement = await this.generateImprovedSkill({
      skillName,
      skillDescription: manifest.description,
      currentSkillMarkdown,
      currentOpenAIYaml,
      benchmark: baseline,
      behaviorBenchmark: baselineBehavior,
      behaviorAnalysis,
    });

    mkdirSync(dirname(candidateSkillDir), { recursive: true });
    cpSync(manifest.rootDir, candidateSkillDir, { recursive: true });
    writeFileSync(
      join(candidateSkillDir, 'SKILL.md'),
      `${stripCodeFences(improvement.revisedSkillMarkdown).trim()}\n`,
      'utf-8',
    );

    if (improvement.revisedOpenAIYaml && improvement.revisedOpenAIYaml.trim()) {
      const targetYamlPath = join(candidateSkillDir, 'agents', 'openai.yaml');
      mkdirSync(dirname(targetYamlPath), { recursive: true });
      writeFileSync(targetYamlPath, `${stripCodeFences(improvement.revisedOpenAIYaml).trim()}\n`, 'utf-8');
    }

    const candidateMarkdown = readFileSync(join(candidateSkillDir, 'SKILL.md'), 'utf-8');
    const missingReferencedFiles = extractReferencedFilesFromMarkdown(candidateMarkdown)
      .map((relativePath) => resolve(candidateSkillDir, relativePath))
      .filter((absolutePath) => !existsSync(absolutePath));

    const candidateManifest = this.resolveSkillManifestForRoot(
      skillName,
      candidateProjectRoot,
      [join(this.config.projectRoot, 'skills'), ...(this.config.skillContent?.userSkillRoots ?? [])],
    );
    if (resolve(candidateManifest.rootDir) !== resolve(candidateSkillDir)) {
      throw new Error(
        `Candidate skill validation failed: expected resolver to load ${candidateSkillDir}, but loaded ${candidateManifest.rootDir} instead.`,
      );
    }

    const candidate = this.runBenchmark(
      skillName,
      suite,
      suitePath,
      candidateProjectRoot,
      [join(this.config.projectRoot, 'skills'), ...(this.config.skillContent?.userSkillRoots ?? [])],
    );
    let candidateBehavior: SkillBehaviorBenchmark | undefined;
    if (behaviorSuite && behaviorSuitePath) {
      candidateBehavior = await this.runBehaviorBenchmark(
        skillName,
        behaviorSuite,
        behaviorSuitePath,
        candidateProjectRoot,
        [join(this.config.projectRoot, 'skills'), ...(this.config.skillContent?.userSkillRoots ?? [])],
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
      behaviorAnalysis,
      missingReferencedFiles,
    });
    this.writeBenchmarkSummary(summaryPath, candidate, baseline, comparison, {
      analysisSummary: improvement.analysisSummary,
      changes: improvement.changes,
      missingReferencedFiles,
      behaviorBenchmark: candidateBehavior,
      baselineBehaviorBenchmark: baselineBehavior,
      behaviorAnalysis,
    });

    let applied = false;
    let backupPath: string | undefined;
    if (options.applyIfBetter && comparison.improved) {
      const promotion = this.promoteCandidate(skillName, candidateId);
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

  promoteCandidate(skillName: string, candidateId: string): SkillLabPromotionResult {
    const targetManifest = this.resolveSkillManifest(skillName);
    if (targetManifest.source === 'builtin') {
      throw new Error('Promoting into built-in skills is disabled. Copy the candidate manually into a project skill root.');
    }

    const candidateSkillDir = join(this.getSkillLabDir(skillName), 'candidates', candidateId, 'skills', skillName);
    if (!existsSync(candidateSkillDir)) {
      throw new Error(`Candidate skill not found: ${candidateSkillDir}`);
    }

    const backupPath = join(this.getSkillLabDir(skillName), 'snapshots', `${candidateId}-before-apply`, skillName);
    mkdirSync(dirname(backupPath), { recursive: true });
    cpSync(targetManifest.rootDir, backupPath, { recursive: true });

    rmSync(targetManifest.rootDir, { recursive: true, force: true });
    mkdirSync(dirname(targetManifest.rootDir), { recursive: true });
    cpSync(candidateSkillDir, targetManifest.rootDir, { recursive: true });

    return {
      candidateId,
      targetPath: targetManifest.rootDir,
      backupPath,
    };
  }

  private resolveSkillManifest(skillName: string): SkillManifest {
    return this.resolveSkillManifestForRoot(
      skillName,
      this.config.projectRoot,
      this.config.skillContent?.userSkillRoots,
    );
  }

  private resolveSkillManifestForRoot(
    skillName: string,
    projectRoot: string,
    userSkillRoots?: string[],
  ): SkillManifest {
    const normalizedTarget = normalizeText(skillName);
    const loader = this.createLoader(projectRoot, userSkillRoots);
    const manifests = loader.listSkills();
    const manifest = manifests.find((entry) => normalizeText(entry.name) === normalizedTarget);

    if (!manifest) {
      const available = manifests.map((entry) => entry.name).sort().join(', ');
      throw new Error(`Skill not found: ${skillName}. Available skills: ${available || '(none)'}`);
    }

    return manifest;
  }

  private createLoader(projectRoot: string, userSkillRoots?: string[]): SkillContentLoader {
    return new SkillContentLoader({
      projectRoot,
      userSkillRoots,
      builtInSkillRoots: this.config.skillContent?.builtInSkillRoots,
    });
  }

  private createResolver(projectRoot: string, userSkillRoots?: string[]): SkillContentResolver {
    const loader = this.createLoader(projectRoot, userSkillRoots);
    return new SkillContentResolver(loader, {
      maxImplicitMatches: this.config.skillContent?.maxImplicitMatches,
      maxExplicitMatches: this.config.skillContent?.maxExplicitMatches,
      maxReferenceFiles: this.config.skillContent?.maxReferenceFiles,
      maxCharsPerFile: this.config.skillContent?.maxCharsPerFile,
    });
  }

  private getSkillLabDir(skillName: string): string {
    return join(this.config.outputRoot, sanitizeToken(skillName));
  }

  private resolveEvalSuitePath(skillName: string, evalSuitePath?: string): string {
    const path = resolve(evalSuitePath ?? join(this.getSkillLabDir(skillName), 'trigger-evals.json'));
    if (!existsSync(path)) {
      throw new Error(`Trigger eval suite not found: ${path}. Run initTriggerEvals first or pass --eval.`);
    }
    return path;
  }

  private resolveBehaviorEvalSuitePath(skillName: string, evalSuitePath?: string): string {
    const path = resolve(evalSuitePath ?? join(this.getSkillLabDir(skillName), 'behavior-evals.json'));
    if (!existsSync(path)) {
      throw new Error(`Behavior eval suite not found: ${path}. Run initBehaviorEvals first or pass --behavior-eval.`);
    }
    return path;
  }

  private readEvalSuite(path: string): SkillTriggerEvalSuite {
    const raw = JSON.parse(readFileSync(path, 'utf-8'));
    return TriggerEvalSuiteSchema.parse(raw);
  }

  private readBehaviorEvalSuite(path: string): SkillBehaviorEvalSuite {
    const raw = JSON.parse(readFileSync(path, 'utf-8'));
    return BehaviorEvalSuiteSchema.parse(raw);
  }

  private requireLlmService(): LLMService {
    if (!this.llmService) {
      throw new Error('This operation requires LLM configuration.');
    }
    return this.llmService;
  }

  private runBenchmark(
    skillName: string,
    suite: SkillTriggerEvalSuite,
    evalSuitePath: string,
    resolverProjectRoot: string,
    userSkillRoots?: string[],
  ): SkillTriggerBenchmark {
    const resolver = this.createResolver(resolverProjectRoot, userSkillRoots);
    const results: SkillTriggerEvalCaseResult[] = suite.cases.map((testCase) => {
      const resolution = resolver.resolveForTask(testCase.prompt);
      const matchedEntries = resolution.matchedSkills.filter((match) => normalizeText(match.name) === normalizeText(skillName));
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

  private async runBehaviorBenchmark(
    skillName: string,
    suite: SkillBehaviorEvalSuite,
    evalSuitePath: string,
    resolverProjectRoot: string,
    userSkillRoots?: string[],
  ): Promise<SkillBehaviorBenchmark> {
    const resolver = this.createResolver(resolverProjectRoot, userSkillRoots);
    const results: SkillBehaviorEvalCaseResult[] = [];

    for (const testCase of suite.cases) {
      results.push(await this.runBehaviorCase({
        skillName,
        testCase,
        resolver,
      }));
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

  private async runBehaviorCase(input: {
    skillName: string;
    testCase: SkillBehaviorEvalCase;
    resolver: SkillContentResolver;
  }): Promise<SkillBehaviorEvalCaseResult> {
    const { skillName, testCase, resolver } = input;
    const resolution = resolver.resolveForTask(testCase.prompt);
    const matchedEntries = resolution.matchedSkills.filter((match) => normalizeText(match.name) === normalizeText(skillName));
    const triggered = matchedEntries.length > 0;
    const expectation = testCase.expectation ?? 'trigger';
    const triggerPass = expectation === 'either'
      ? true
      : expectation === 'trigger'
        ? triggered
        : !triggered;
    const sanitizedPrompt = resolution.sanitizedTaskDescription?.trim() || testCase.prompt;
    const skillContext = resolution.promptContext?.trim();

    const output = await this.requireLlmService().generateText({
      system: [
        'You are FrontAgent running a behavior eval sandbox.',
        'Answer the user task directly and practically.',
        'Follow activated skill instructions when provided.',
        'Do not mention hidden reasoning or evaluation setup.',
        skillContext ? '' : 'No content skill was activated.',
        skillContext ?? '',
      ].join('\n').trim(),
      messages: [
        {
          role: 'user',
          content: sanitizedPrompt,
        },
      ],
      temperature: 0.2,
      maxTokens: 1800,
    });

    const checks = await this.gradeBehaviorCase({
      testCase,
      prompt: sanitizedPrompt,
      output,
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

  private async gradeBehaviorCase(input: {
    testCase: SkillBehaviorEvalCase;
    prompt: string;
    output: string;
  }): Promise<SkillBehaviorCheckResult[]> {
    const grade: z.infer<typeof BehaviorCaseGradeSchema> = await this.requireLlmService().generateObject({
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

  private analyzeBehaviorFailures(benchmark: SkillBehaviorBenchmark): string[] {
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

    return [
      `Failing cases: ${failingCases.length}/${benchmark.summary.totalCases}.`,
      ...topChecks,
    ];
  }

  private createStarterSuite(manifest: SkillManifest): SkillTriggerEvalSuite {
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
        prompt: this.buildPositivePrompt(keyword),
        expected: 'trigger',
        note: `Starter positive case derived from keyword "${keyword}". Replace with a more realistic task if needed.`,
      });
    }

    for (const negative of manifest.triggers.negative.slice(0, 4)) {
      addCase({
        id: `negative-${sanitizeToken(negative) || 'avoid'}`,
        prompt: this.buildNegativePrompt(negative),
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

  private createStarterBehaviorSuite(manifest: SkillManifest): SkillBehaviorEvalSuite {
    const cases: SkillBehaviorEvalCase[] = [];
    const addCase = (testCase: SkillBehaviorEvalCase) => {
      if (cases.some((entry) => entry.id === testCase.id || entry.prompt === testCase.prompt)) {
        return;
      }
      cases.push(testCase);
    };

    const seedKeywords = manifest.triggers.keywords.length > 0
      ? manifest.triggers.keywords.slice(0, 3)
      : [manifest.name];

    for (const keyword of seedKeywords) {
      const keywordToken = sanitizeToken(keyword) || 'behavior';
      addCase({
        id: `behavior-${keywordToken}`,
        prompt: this.buildBehaviorPrompt(keyword),
        expectation: 'trigger',
        checks: this.createStarterBehaviorChecks(keyword),
        note: `Starter behavior case from keyword "${keyword}". Replace with real production prompts for reliable evaluation.`,
      });
    }

    addCase({
      id: 'behavior-explicit',
      prompt: `Please use $${manifest.name} and deliver an implementation-ready answer for this frontend request.`,
      expectation: 'trigger',
      checks: this.createStarterBehaviorChecks(manifest.name),
      note: 'Explicit invocation sanity check for behavior quality.',
    });

    addCase({
      id: 'behavior-no-trigger',
      prompt: 'Explain JavaScript closures with a short practical example.',
      expectation: normalizeText(manifest.name) === 'frontend-reviewer' ? 'trigger' : 'no_trigger',
      checks: this.createNoTriggerBehaviorChecks(),
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

  private createStarterBehaviorChecks(keyword: string): SkillBehaviorEvalCase['checks'] {
    return [
      {
        id: 'actionable-output',
        question: 'Does the answer provide concrete implementation guidance instead of vague high-level advice?',
        passCriteria: 'Contains specific steps, code-level instructions, or implementation details tied to the request.',
        failCriteria: 'Only gives generic principles with no actionable implementation details.',
        weight: 1,
      },
      {
        id: 'scope-discipline',
        question: 'Does the answer stay focused on the task scope implied by the prompt and keyword?',
        passCriteria: `Focuses on "${keyword}" and related request scope without drifting into unrelated domains.`,
        failCriteria: 'Derails into unrelated topics or broad advice that does not help complete the requested task.',
        weight: 1,
      },
      {
        id: 'clarity-structure',
        question: 'Is the answer well-structured and easy to execute?',
        passCriteria: 'Uses clear sections or steps, avoids contradictions, and remains concise enough to follow.',
        failCriteria: 'Hard to follow, contradictory, or excessively verbose for the requested task.',
        weight: 1,
      },
    ];
  }

  private createNoTriggerBehaviorChecks(): SkillBehaviorEvalCase['checks'] {
    return [
      {
        id: 'direct-answer',
        question: 'Does the answer still solve the user request directly even when the target skill should not trigger?',
        passCriteria: 'Provides a useful direct answer to the prompt.',
        failCriteria: 'Avoids answering or turns into meta discussion about skills/evaluation.',
        weight: 1,
      },
      {
        id: 'no-internal-leakage',
        question: 'Does the answer avoid exposing internal evaluation setup or hidden skill-context artifacts?',
        passCriteria: 'Contains no references to internal grading, benchmark, or activated-skill metadata.',
        failCriteria: 'Mentions internal benchmark/eval setup or leaked skill-context internals.',
        weight: 1,
      },
    ];
  }

  private buildBehaviorPrompt(keyword: string): string {
    const normalized = normalizeText(keyword);
    if (/review|audit|bug|issue/.test(normalized)) {
      return `Review this frontend change request around "${keyword}" and provide a concrete, prioritized action plan.`;
    }
    if (/landing|dashboard|hero|page|screen|ui|design|marketing/.test(normalized) || /[\u4e00-\u9fff]/.test(normalized)) {
      return `Implement a frontend task centered on "${keyword}" and explain the final deliverable clearly.`;
    }
    return `Handle this frontend task involving "${keyword}" with implementation-ready instructions.`;
  }

  private buildPositivePrompt(keyword: string): string {
    const normalized = normalizeText(keyword);
    if (/landing|dashboard|hero|page|screen|ui|design|marketing/.test(normalized) || /[\u4e00-\u9fff]/.test(normalized)) {
      return `Please help with a frontend task involving "${keyword}" and deliver a working implementation.`;
    }

    return `Use this skill for a frontend task that clearly matches "${keyword}".`;
  }

  private buildNegativePrompt(keyword: string): string {
    return `This request is about "${keyword}" and should not activate an unrelated content skill.`;
  }

  private async generateImprovedSkill(input: {
    skillName: string;
    skillDescription: string;
    currentSkillMarkdown: string;
    currentOpenAIYaml?: string;
    benchmark: SkillTriggerBenchmark;
    behaviorBenchmark?: SkillBehaviorBenchmark;
    behaviorAnalysis?: string[];
  }): Promise<z.infer<typeof SkillImprovementSchema>> {
    const failureResults = input.benchmark.results.filter((result) => !result.pass);
    const failureSummary = failureResults.length === 0
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
            failedChecks: result.checks.filter((check) => !check.pass).map((check) => ({
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
          typeof failureSummary === 'string' ? failureSummary : JSON.stringify(failureSummary, null, 2),
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

    return this.requireLlmService().generateObject({
      messages,
      system,
      schema: SkillImprovementSchema,
      temperature: 0.2,
      maxRetries: 1,
    });
  }

  private writeBenchmarkSummary(
    path: string,
    benchmark: SkillTriggerBenchmark,
    baseline?: SkillTriggerBenchmark,
    comparison?: SkillBenchmarkComparison,
    extras?: {
      analysisSummary?: string;
      changes?: string[];
      missingReferencedFiles?: string[];
      behaviorBenchmark?: SkillBehaviorBenchmark;
      baselineBehaviorBenchmark?: SkillBehaviorBenchmark;
      behaviorAnalysis?: string[];
    },
  ): void {
    const lines: string[] = [
      `# Skill Benchmark: ${benchmark.skillName}`,
      '',
      `- Evaluated at: ${benchmark.evaluatedAt}`,
      `- Resolver project root: ${benchmark.resolverProjectRoot}`,
      `- Pass rate: ${(benchmark.summary.passRate * 100).toFixed(1)}%`,
      `- Cases: ${benchmark.summary.totalCases}`,
      `- False positives: ${benchmark.summary.falsePositives}`,
      `- False negatives: ${benchmark.summary.falseNegatives}`,
      '',
    ];

    if (baseline && comparison) {
      lines.push('## Comparison');
      lines.push('');
      lines.push(`- Baseline pass rate: ${(baseline.summary.passRate * 100).toFixed(1)}%`);
      lines.push(`- Candidate pass rate: ${(benchmark.summary.passRate * 100).toFixed(1)}%`);
      lines.push(`- Improved: ${comparison.improved ? 'yes' : 'no'}`);
      for (const reason of comparison.reasons) {
        lines.push(`- ${reason}`);
      }
      lines.push('');
    }

    if (extras?.behaviorBenchmark) {
      const behavior = extras.behaviorBenchmark;
      lines.push('## Behavior Benchmark');
      lines.push('');
      lines.push(`- Behavior cases: ${behavior.summary.totalCases}`);
      lines.push(`- Behavior pass rate: ${(behavior.summary.passRate * 100).toFixed(1)}%`);
      lines.push(`- Behavior check pass rate: ${(behavior.summary.checkPassRate * 100).toFixed(1)}%`);
      lines.push(`- Behavior score rate: ${(behavior.summary.scoreRate * 100).toFixed(1)}%`);
      lines.push(`- Trigger expectation failures: ${behavior.summary.triggerExpectationFailures}`);
      if (extras.baselineBehaviorBenchmark && comparison?.behavior) {
        lines.push(`- Baseline behavior score rate: ${(extras.baselineBehaviorBenchmark.summary.scoreRate * 100).toFixed(1)}%`);
        lines.push(`- Candidate behavior score rate: ${(behavior.summary.scoreRate * 100).toFixed(1)}%`);
        lines.push(`- Behavior improved: ${comparison.behavior.improved ? 'yes' : 'no'}`);
      }
      lines.push('');
    }

    if (extras?.behaviorAnalysis && extras.behaviorAnalysis.length > 0) {
      lines.push('## Behavior Analysis');
      lines.push('');
      for (const item of extras.behaviorAnalysis) {
        lines.push(`- ${item}`);
      }
      lines.push('');
    }

    if (extras?.analysisSummary) {
      lines.push('## Analysis');
      lines.push('');
      lines.push(extras.analysisSummary);
      lines.push('');
    }

    if (extras?.changes && extras.changes.length > 0) {
      lines.push('## Changes');
      lines.push('');
      for (const change of extras.changes) {
        lines.push(`- ${change}`);
      }
      lines.push('');
    }

    if (extras?.missingReferencedFiles && extras.missingReferencedFiles.length > 0) {
      lines.push('## Warnings');
      lines.push('');
      lines.push(`- Missing referenced files: ${extras.missingReferencedFiles.join(', ')}`);
      lines.push('');
    }

    const failing = benchmark.results.filter((result) => !result.pass);
    if (failing.length > 0) {
      lines.push('## Failing Cases');
      lines.push('');
      for (const result of failing) {
        lines.push(`- ${result.id}: expected=${result.expected}, triggered=${result.triggered}, matched=${result.matchedSkillNames.join(', ') || '(none)'}`);
        lines.push(`  Prompt: ${result.prompt}`);
      }
      lines.push('');
    }

    if (extras?.behaviorBenchmark) {
      const behaviorFailing = extras.behaviorBenchmark.results.filter((result) => !result.pass);
      if (behaviorFailing.length > 0) {
        lines.push('## Behavior Failing Cases');
        lines.push('');
        for (const result of behaviorFailing) {
          const failedChecks = result.checks.filter((check) => !check.pass);
          lines.push(`- ${result.id}: expectation=${result.expectation}, triggered=${result.triggered}, score=${result.score}/${result.maxScore}`);
          lines.push(`  Prompt: ${result.prompt}`);
          lines.push(`  Failed checks: ${failedChecks.map((check) => check.id).join(', ') || '(none)'}`);
        }
        lines.push('');
      }
    }

    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${lines.join('\n')}\n`, 'utf-8');
  }
}
