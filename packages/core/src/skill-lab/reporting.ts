import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type {
  SkillBehaviorBenchmark,
  SkillBenchmarkComparison,
  SkillTriggerBenchmark,
} from './types.js';

export interface BenchmarkSummaryExtras {
  analysisSummary?: string;
  changes?: string[];
  missingReferencedFiles?: string[];
  behaviorBenchmark?: SkillBehaviorBenchmark;
  baselineBehaviorBenchmark?: SkillBehaviorBenchmark;
  behaviorAnalysis?: string[];
}

export function writeBenchmarkSummary(
  path: string,
  benchmark: SkillTriggerBenchmark,
  baseline?: SkillTriggerBenchmark,
  comparison?: SkillBenchmarkComparison,
  extras?: BenchmarkSummaryExtras,
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
      lines.push(
        `- Baseline behavior score rate: ${(extras.baselineBehaviorBenchmark.summary.scoreRate * 100).toFixed(1)}%`,
      );
      lines.push(
        `- Candidate behavior score rate: ${(behavior.summary.scoreRate * 100).toFixed(1)}%`,
      );
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
      lines.push(
        `- ${result.id}: expected=${result.expected}, triggered=${result.triggered}, matched=${result.matchedSkillNames.join(', ') || '(none)'}`,
      );
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
        lines.push(
          `- ${result.id}: expectation=${result.expectation}, triggered=${result.triggered}, score=${result.score}/${result.maxScore}`,
        );
        lines.push(`  Prompt: ${result.prompt}`);
        lines.push(
          `  Failed checks: ${failedChecks.map((check) => check.id).join(', ') || '(none)'}`,
        );
      }
      lines.push('');
    }
  }

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${lines.join('\n')}\n`, 'utf-8');
}
