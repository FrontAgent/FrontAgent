import type {
  SkillBehaviorBenchmark,
  SkillBehaviorBenchmarkSummary,
  SkillBehaviorComparison,
  SkillBehaviorEvalCaseResult,
  SkillBenchmarkComparison,
  SkillTriggerBenchmarkSummary,
  SkillTriggerEvalCaseResult,
} from './types.js';

export function summarizeResults(
  results: SkillTriggerEvalCaseResult[],
): SkillTriggerBenchmarkSummary {
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

export function summarizeBehaviorResults(
  results: SkillBehaviorEvalCaseResult[],
): SkillBehaviorBenchmarkSummary {
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

export function compareBehaviorBenchmarks(
  baseline: SkillBehaviorBenchmark,
  candidate: SkillBehaviorBenchmark,
): SkillBehaviorComparison {
  const reasons: string[] = [];
  const baselineSummary = baseline.summary;
  const candidateSummary = candidate.summary;

  const scoreDelta = candidateSummary.scoreRate - baselineSummary.scoreRate;
  const checkDelta = candidateSummary.checkPassRate - baselineSummary.checkPassRate;
  const triggerFailDelta =
    candidateSummary.triggerExpectationFailures - baselineSummary.triggerExpectationFailures;

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
    (candidateSummary.scoreRate > baselineSummary.scoreRate ||
      candidateSummary.checkPassRate > baselineSummary.checkPassRate ||
      candidateSummary.triggerExpectationFailures < baselineSummary.triggerExpectationFailures);

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

export function compareBenchmarks(
  baseline: { summary: SkillTriggerBenchmarkSummary },
  candidate: { summary: SkillTriggerBenchmarkSummary },
  baselineBehavior?: SkillBehaviorBenchmark,
  candidateBehavior?: SkillBehaviorBenchmark,
): SkillBenchmarkComparison {
  const reasons: string[] = [];
  const baselineErrors = baseline.summary.falsePositives + baseline.summary.falseNegatives;
  const candidateErrors = candidate.summary.falsePositives + candidate.summary.falseNegatives;
  const triggerNonRegression =
    candidate.summary.passRate >= baseline.summary.passRate && candidateErrors <= baselineErrors;
  const triggerImprovement =
    candidate.summary.passRate > baseline.summary.passRate || candidateErrors < baselineErrors;
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
    improved =
      triggerNonRegression &&
      behaviorComparison.improved &&
      (triggerImprovement || behaviorComparison.improved);
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
