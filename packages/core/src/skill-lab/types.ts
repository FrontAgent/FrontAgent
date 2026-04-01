import type { LLMConfig, SkillContentConfig } from '../types.js';
import type { SkillSource } from '../skill-content/types.js';

export interface SkillLabConfig {
  projectRoot: string;
  llm?: LLMConfig;
  skillContent?: SkillContentConfig;
  outputRoot?: string;
  debug?: boolean;
}

export interface SkillLabSkillSummary {
  name: string;
  description: string;
  source: SkillSource;
  rootDir: string;
  skillFilePath: string;
}

export type SkillTriggerExpectation = 'trigger' | 'no_trigger';

export interface SkillTriggerEvalCase {
  id: string;
  prompt: string;
  expected: SkillTriggerExpectation;
  note?: string;
}

export interface SkillTriggerEvalSuite {
  version: 1;
  skillName: string;
  generatedAt: string;
  generatedBy: 'frontagent-skill-lab';
  description: string;
  cases: SkillTriggerEvalCase[];
}

export type SkillBehaviorExpectation = 'trigger' | 'no_trigger' | 'either';

export interface SkillBehaviorEvalCheck {
  id: string;
  question: string;
  passCriteria: string;
  failCriteria: string;
  weight?: number;
}

export interface SkillBehaviorEvalCase {
  id: string;
  prompt: string;
  expectation?: SkillBehaviorExpectation;
  checks: SkillBehaviorEvalCheck[];
  note?: string;
}

export interface SkillBehaviorEvalSuite {
  version: 1;
  skillName: string;
  generatedAt: string;
  generatedBy: 'frontagent-skill-lab';
  description: string;
  cases: SkillBehaviorEvalCase[];
}

export interface SkillTriggerEvalCaseResult {
  id: string;
  prompt: string;
  expected: SkillTriggerExpectation;
  triggered: boolean;
  pass: boolean;
  matchedSkillNames: string[];
  matchedTerms: string[];
  matchTypes: Array<'explicit' | 'keyword'>;
  note?: string;
}

export interface SkillTriggerBenchmarkSummary {
  totalCases: number;
  passCount: number;
  failCount: number;
  passRate: number;
  falsePositives: number;
  falseNegatives: number;
  expectedTriggerCount: number;
  expectedNoTriggerCount: number;
  explicitMatches: number;
  keywordMatches: number;
  noMatches: number;
}

export interface SkillTriggerBenchmark {
  version: 1;
  skillName: string;
  evaluatedAt: string;
  evalSuitePath: string;
  resolverProjectRoot: string;
  summary: SkillTriggerBenchmarkSummary;
  results: SkillTriggerEvalCaseResult[];
}

export interface SkillBehaviorCheckResult {
  id: string;
  question: string;
  pass: boolean;
  rationale: string;
  weight: number;
}

export interface SkillBehaviorEvalCaseResult {
  id: string;
  prompt: string;
  expectation: SkillBehaviorExpectation;
  triggered: boolean;
  triggerPass: boolean;
  pass: boolean;
  score: number;
  maxScore: number;
  passRate: number;
  matchedSkillNames: string[];
  matchedTerms: string[];
  matchTypes: Array<'explicit' | 'keyword'>;
  output: string;
  checks: SkillBehaviorCheckResult[];
  note?: string;
}

export interface SkillBehaviorBenchmarkSummary {
  totalCases: number;
  passCount: number;
  failCount: number;
  passRate: number;
  totalChecks: number;
  passedChecks: number;
  checkPassRate: number;
  totalScore: number;
  maxScore: number;
  scoreRate: number;
  triggerExpectationFailures: number;
}

export interface SkillBehaviorBenchmark {
  version: 1;
  skillName: string;
  evaluatedAt: string;
  evalSuitePath: string;
  resolverProjectRoot: string;
  summary: SkillBehaviorBenchmarkSummary;
  results: SkillBehaviorEvalCaseResult[];
}

export interface SkillBehaviorComparison {
  improved: boolean;
  baselineScoreRate: number;
  candidateScoreRate: number;
  baselineCheckPassRate: number;
  candidateCheckPassRate: number;
  baselineTriggerExpectationFailures: number;
  candidateTriggerExpectationFailures: number;
  reasons: string[];
}

export interface SkillBenchmarkComparison {
  improved: boolean;
  baselinePassRate: number;
  candidatePassRate: number;
  reasons: string[];
  behavior?: SkillBehaviorComparison;
}

export interface SkillLabInitResult {
  evalSuitePath: string;
  suite: SkillTriggerEvalSuite;
}

export interface SkillLabBehaviorInitResult {
  evalSuitePath: string;
  suite: SkillBehaviorEvalSuite;
}

export interface SkillLabScaffoldResult {
  skillDir: string;
  skillFilePath: string;
  agentConfigPath: string;
}

export interface SkillLabBenchmarkResult {
  benchmark: SkillTriggerBenchmark;
  outputPath: string;
  summaryPath: string;
  behaviorBenchmark?: SkillBehaviorBenchmark;
  behaviorOutputPath?: string;
}

export interface SkillLabImproveOptions {
  evalSuitePath?: string;
  behaviorEvalSuitePath?: string;
  includeBehaviorEval?: boolean;
  applyIfBetter?: boolean;
  force?: boolean;
}

export interface SkillLabImproveResult {
  candidateId: string;
  candidateRoot: string;
  candidateSkillDir: string;
  baseline: SkillTriggerBenchmark;
  candidate: SkillTriggerBenchmark;
  baselineBehavior?: SkillBehaviorBenchmark;
  candidateBehavior?: SkillBehaviorBenchmark;
  comparison: SkillBenchmarkComparison;
  benchmarkPath: string;
  summaryPath: string;
  analysisSummary: string;
  changes: string[];
  applied: boolean;
  backupPath?: string;
}

export interface SkillLabPromotionResult {
  candidateId: string;
  targetPath: string;
  backupPath: string;
}
