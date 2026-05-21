import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { LLMService } from '../llm.js';
import { SkillContentLoader } from '../skill-content/loader.js';
import { SkillContentResolver } from '../skill-content/resolver.js';
import type { SkillManifest } from '../skill-content/types.js';
import { createStarterBehaviorSuite, runBehaviorBenchmark } from './behavior-benchmark.js';
import { executeImprovement } from './improve.js';
import { writeBenchmarkSummary } from './reporting.js';
import { scaffoldSkill } from './scaffold.js';
import { BehaviorEvalSuiteSchema, TriggerEvalSuiteSchema } from './schemas.js';
import { createStarterTriggerSuite, runTriggerBenchmark } from './trigger-benchmark.js';
import type {
  SkillBehaviorBenchmark,
  SkillBehaviorEvalSuite,
  SkillLabBehaviorInitResult,
  SkillLabBenchmarkResult,
  SkillLabConfig,
  SkillLabImproveOptions,
  SkillLabImproveResult,
  SkillLabInitResult,
  SkillLabPromotionResult,
  SkillLabScaffoldResult,
  SkillLabSkillSummary,
  SkillTriggerEvalSuite,
} from './types.js';
import { normalizeText, sanitizeToken, timestampId, writeJsonFile } from './utils.js';

export class SkillLab {
  private readonly config: Required<Pick<SkillLabConfig, 'projectRoot' | 'outputRoot' | 'debug'>> &
    Omit<SkillLabConfig, 'projectRoot' | 'outputRoot' | 'debug'>;
  private readonly llmService?: LLMService;

  constructor(config: SkillLabConfig) {
    this.config = {
      ...config,
      projectRoot: resolve(config.projectRoot),
      outputRoot: resolve(
        config.outputRoot ?? join(config.projectRoot, '.frontagent', 'skill-lab'),
      ),
      debug: config.debug ?? false,
    };

    if (config.llm) {
      this.llmService = new LLMService(config.llm);
    }
  }

  listSkills(): SkillLabSkillSummary[] {
    const loader = this.createLoader(
      this.config.projectRoot,
      this.config.skillContent?.userSkillRoots,
    );
    return loader.listSkills().map((skill) => ({
      name: skill.name,
      description: skill.description,
      source: skill.source,
      rootDir: skill.rootDir,
      skillFilePath: skill.skillFilePath,
    }));
  }

  scaffoldSkill(skillName: string, description?: string, force = false): SkillLabScaffoldResult {
    return scaffoldSkill(this.config.projectRoot, skillName, description, force);
  }

  initTriggerEvals(skillName: string, outputPath?: string, force = false): SkillLabInitResult {
    const manifest = this.resolveSkillManifest(skillName);
    const suite = createStarterTriggerSuite(manifest);
    const targetPath = resolve(
      outputPath ?? join(this.getSkillLabDir(skillName), 'trigger-evals.json'),
    );

    if (existsSync(targetPath) && !force) {
      throw new Error(`Trigger eval suite already exists: ${targetPath}`);
    }

    writeJsonFile(targetPath, suite);
    return { evalSuitePath: targetPath, suite };
  }

  initBehaviorEvals(
    skillName: string,
    outputPath?: string,
    force = false,
  ): SkillLabBehaviorInitResult {
    const manifest = this.resolveSkillManifest(skillName);
    const suite = createStarterBehaviorSuite(manifest);
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
    evalSuitePathOrOptions?:
      | string
      | { evalSuitePath?: string; behaviorEvalSuitePath?: string; includeBehaviorEval?: boolean },
  ): Promise<SkillLabBenchmarkResult> {
    const benchmarkOptions =
      typeof evalSuitePathOrOptions === 'string'
        ? {
            evalSuitePath: evalSuitePathOrOptions,
            includeBehaviorEval: false,
            behaviorEvalSuitePath: undefined,
          }
        : {
            evalSuitePath: evalSuitePathOrOptions?.evalSuitePath,
            includeBehaviorEval: Boolean(
              evalSuitePathOrOptions?.includeBehaviorEval ||
                evalSuitePathOrOptions?.behaviorEvalSuitePath,
            ),
            behaviorEvalSuitePath: evalSuitePathOrOptions?.behaviorEvalSuitePath,
          };
    const suitePath = this.resolveEvalSuitePath(skillName, benchmarkOptions.evalSuitePath);
    const suite = this.readEvalSuite(suitePath);
    const resolver = this.createResolver(
      this.config.projectRoot,
      this.config.skillContent?.userSkillRoots,
    );
    const benchmark = runTriggerBenchmark(
      skillName,
      suite,
      suitePath,
      this.config.projectRoot,
      resolver,
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
      const behaviorSuitePath = this.resolveBehaviorEvalSuitePath(
        skillName,
        benchmarkOptions.behaviorEvalSuitePath,
      );
      const behaviorSuite = this.readBehaviorEvalSuite(behaviorSuitePath);
      const behaviorResolver = this.createResolver(
        this.config.projectRoot,
        this.config.skillContent?.userSkillRoots,
      );
      behaviorBenchmark = await runBehaviorBenchmark(
        skillName,
        behaviorSuite,
        behaviorSuitePath,
        this.config.projectRoot,
        behaviorResolver,
        this.llmService,
      );
      behaviorOutputPath = join(runDir, `${runId}-baseline-behavior.json`);
      writeJsonFile(behaviorOutputPath, behaviorBenchmark);
    }

    writeBenchmarkSummary(summaryPath, benchmark, undefined, undefined, {
      behaviorBenchmark,
    });
    return { benchmark, outputPath, summaryPath, behaviorBenchmark, behaviorOutputPath };
  }

  async improveSkill(
    skillName: string,
    options: SkillLabImproveOptions = {},
  ): Promise<SkillLabImproveResult> {
    if (!this.llmService) {
      throw new Error('Skill improvement requires LLM configuration.');
    }

    const manifest = this.resolveSkillManifest(skillName);
    const includeBehaviorEval = Boolean(
      options.includeBehaviorEval || options.behaviorEvalSuitePath,
    );
    const suitePath = this.resolveEvalSuitePath(skillName, options.evalSuitePath);
    const suite = this.readEvalSuite(suitePath);

    let behaviorSuitePath: string | undefined;
    let behaviorSuite: SkillBehaviorEvalSuite | undefined;
    if (includeBehaviorEval) {
      behaviorSuitePath = this.resolveBehaviorEvalSuitePath(
        skillName,
        options.behaviorEvalSuitePath,
      );
      behaviorSuite = this.readBehaviorEvalSuite(behaviorSuitePath);
    }

    return executeImprovement({
      skillName,
      manifest,
      suite,
      suitePath,
      behaviorSuite,
      behaviorSuitePath,
      projectRoot: this.config.projectRoot,
      userSkillRoots: this.config.skillContent?.userSkillRoots,
      outputRoot: this.getSkillLabDir(skillName),
      llmService: this.llmService,
      force: options.force,
      applyIfBetter: options.applyIfBetter,
      createResolver: (projectRoot, userSkillRoots) =>
        this.createResolver(projectRoot, userSkillRoots),
      resolveSkillManifestForRoot: (name, root, roots) =>
        this.resolveSkillManifestForRoot(name, root, roots),
      promoteCandidate: (name, id) => this.promoteCandidate(name, id),
    });
  }

  promoteCandidate(skillName: string, candidateId: string): SkillLabPromotionResult {
    const targetManifest = this.resolveSkillManifest(skillName);
    if (targetManifest.source === 'builtin') {
      throw new Error(
        'Promoting into built-in skills is disabled. Copy the candidate manually into a project skill root.',
      );
    }

    const candidateSkillDir = join(
      this.getSkillLabDir(skillName),
      'candidates',
      candidateId,
      'skills',
      skillName,
    );
    if (!existsSync(candidateSkillDir)) {
      throw new Error(`Candidate skill not found: ${candidateSkillDir}`);
    }

    const backupPath = join(
      this.getSkillLabDir(skillName),
      'snapshots',
      `${candidateId}-before-apply`,
      skillName,
    );
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
      const available = manifests
        .map((entry) => entry.name)
        .sort()
        .join(', ');
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
    const path = resolve(
      evalSuitePath ?? join(this.getSkillLabDir(skillName), 'trigger-evals.json'),
    );
    if (!existsSync(path)) {
      throw new Error(
        `Trigger eval suite not found: ${path}. Run initTriggerEvals first or pass --eval.`,
      );
    }
    return path;
  }

  private resolveBehaviorEvalSuitePath(skillName: string, evalSuitePath?: string): string {
    const path = resolve(
      evalSuitePath ?? join(this.getSkillLabDir(skillName), 'behavior-evals.json'),
    );
    if (!existsSync(path)) {
      throw new Error(
        `Behavior eval suite not found: ${path}. Run initBehaviorEvals first or pass --behavior-eval.`,
      );
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
}
