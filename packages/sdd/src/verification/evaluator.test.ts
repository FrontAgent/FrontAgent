import { describe, expect, it } from 'vitest';
import { createVerificationEvaluator } from './evaluator.js';
import type { VerificationEvidence } from './types.js';

function makeEvidence(overrides: Partial<VerificationEvidence> = {}): VerificationEvidence {
  return {
    type: 'test_pass',
    source: 'vitest',
    timestamp: new Date().toISOString(),
    fresh: true,
    details: 'All tests passed',
    relatedRequirements: [],
    ...overrides,
  };
}

describe('VerificationEvaluator', () => {
  describe('evaluate', () => {
    it('returns verified when no requirements and evidence exists', () => {
      const evaluator = createVerificationEvaluator();
      const result = evaluator.evaluate([makeEvidence()], []);
      expect(result.complete).toBe(true);
      expect(result.verdict).toBe('verified');
      expect(result.coverageRatio).toBe(1);
    });

    it('returns unverified when no requirements and no evidence', () => {
      const evaluator = createVerificationEvaluator();
      const result = evaluator.evaluate([], []);
      expect(result.complete).toBe(false);
      expect(result.verdict).toBe('unverified');
      expect(result.coverageRatio).toBe(0);
    });

    it('returns verified when all requirements are covered', () => {
      const evaluator = createVerificationEvaluator({ minCoverageRatio: 0.8 });
      const evidence = [
        makeEvidence({ relatedRequirements: ['req-1', 'req-2'] }),
        makeEvidence({ relatedRequirements: ['req-3'] }),
      ];
      const result = evaluator.evaluate(evidence, ['req-1', 'req-2', 'req-3']);
      expect(result.verdict).toBe('verified');
      expect(result.coverageRatio).toBe(1);
      expect(result.coveredRequirements).toEqual(['req-1', 'req-2', 'req-3']);
      expect(result.uncoveredRequirements).toEqual([]);
    });

    it('returns partial when some requirements are covered', () => {
      const evaluator = createVerificationEvaluator({ minCoverageRatio: 0.8 });
      const evidence = [makeEvidence({ relatedRequirements: ['req-1'] })];
      const result = evaluator.evaluate(evidence, ['req-1', 'req-2', 'req-3']);
      expect(result.verdict).toBe('partial');
      expect(result.coverageRatio).toBeCloseTo(1 / 3);
      expect(result.uncoveredRequirements).toEqual(['req-2', 'req-3']);
    });

    it('returns unverified when no evidence covers requirements', () => {
      const evaluator = createVerificationEvaluator();
      const evidence = [makeEvidence({ type: 'manual_confirm', relatedRequirements: [] })];
      const result = evaluator.evaluate(evidence, ['req-1', 'req-2']);
      expect(result.verdict).toBe('unverified');
      expect(result.coverageRatio).toBe(0);
    });

    it('filters stale evidence when requireFreshEvidence is true', () => {
      const evaluator = createVerificationEvaluator({ requireFreshEvidence: true });
      const evidence = [makeEvidence({ fresh: false, relatedRequirements: ['req-1'] })];
      const result = evaluator.evaluate(evidence, ['req-1']);
      expect(result.coveredRequirements).toEqual([]);
      expect(result.verdict).not.toBe('verified');
    });

    it('includes stale evidence when requireFreshEvidence is false', () => {
      const evaluator = createVerificationEvaluator({ requireFreshEvidence: false });
      const evidence = [makeEvidence({ fresh: false, relatedRequirements: ['req-1'] })];
      const result = evaluator.evaluate(evidence, ['req-1']);
      expect(result.coveredRequirements).toEqual(['req-1']);
    });

    it('gives partial credit for strong evidence without explicit requirement links', () => {
      const evaluator = createVerificationEvaluator({
        strongEvidenceTypes: ['test_pass', 'build_success'],
      });
      const evidence = [makeEvidence({ type: 'test_pass', relatedRequirements: [] })];
      const result = evaluator.evaluate(evidence, ['req-1']);
      expect(result.verdict).toBe('partial');
      expect(result.coverageRatio).toBeGreaterThan(0);
    });

    it('gives no credit for weak evidence without requirement links', () => {
      const evaluator = createVerificationEvaluator({
        strongEvidenceTypes: ['test_pass'],
      });
      const evidence = [makeEvidence({ type: 'manual_confirm', relatedRequirements: [] })];
      const result = evaluator.evaluate(evidence, ['req-1']);
      expect(result.verdict).toBe('unverified');
      expect(result.coverageRatio).toBe(0);
    });
  });

  describe('policy management', () => {
    it('returns default policy', () => {
      const evaluator = createVerificationEvaluator();
      const policy = evaluator.getPolicy();
      expect(policy.requireFreshEvidence).toBe(true);
      expect(policy.minCoverageRatio).toBe(0.8);
    });

    it('updates policy', () => {
      const evaluator = createVerificationEvaluator();
      evaluator.updatePolicy({ minCoverageRatio: 0.5 });
      expect(evaluator.getPolicy().minCoverageRatio).toBe(0.5);
    });
  });
});
