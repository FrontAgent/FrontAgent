import { describe, expect, it } from 'vitest';
import type { ExecutionStepResult } from './collector.js';
import { VerificationCollector } from './collector.js';

function makeStep(overrides: Partial<ExecutionStepResult> = {}): ExecutionStepResult {
  return {
    stepId: 'step-1',
    action: 'run_command',
    tool: 'run_command',
    success: true,
    output: { command: 'vitest run', output: 'Tests passed' },
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('VerificationCollector', () => {
  describe('classifyStep', () => {
    it('classifies test commands as test_pass', () => {
      const collector = new VerificationCollector();
      const evidence = collector.collectFromStep(makeStep({ output: { command: 'vitest run' } }));
      expect(evidence?.type).toBe('test_pass');
    });

    it('classifies jest commands as test_pass', () => {
      const collector = new VerificationCollector();
      const evidence = collector.collectFromStep(
        makeStep({ output: { command: 'npx jest --coverage' } }),
      );
      expect(evidence?.type).toBe('test_pass');
    });

    it('classifies tsc commands as type_check', () => {
      const collector = new VerificationCollector();
      const evidence = collector.collectFromStep(makeStep({ output: { command: 'tsc --noEmit' } }));
      expect(evidence?.type).toBe('type_check');
    });

    it('classifies eslint commands as lint_pass', () => {
      const collector = new VerificationCollector();
      const evidence = collector.collectFromStep(makeStep({ output: { command: 'eslint src/' } }));
      expect(evidence?.type).toBe('lint_pass');
    });

    it('classifies biome commands as lint_pass', () => {
      const collector = new VerificationCollector();
      const evidence = collector.collectFromStep(
        makeStep({ output: { command: 'biome check .' } }),
      );
      expect(evidence?.type).toBe('lint_pass');
    });

    it('classifies build commands as build_success', () => {
      const collector = new VerificationCollector();
      const evidence = collector.collectFromStep(makeStep({ output: { command: 'vite build' } }));
      expect(evidence?.type).toBe('build_success');
    });

    it('classifies browser_screenshot as runtime_check', () => {
      const collector = new VerificationCollector();
      const evidence = collector.collectFromStep(
        makeStep({ action: 'browser_screenshot', tool: 'browser' }),
      );
      expect(evidence?.type).toBe('runtime_check');
    });

    it('classifies browser_navigate as runtime_check', () => {
      const collector = new VerificationCollector();
      const evidence = collector.collectFromStep(
        makeStep({ action: 'browser_navigate', tool: 'browser' }),
      );
      expect(evidence?.type).toBe('runtime_check');
    });

    it('returns null for unrecognized commands', () => {
      const collector = new VerificationCollector();
      const evidence = collector.collectFromStep(makeStep({ output: { command: 'echo hello' } }));
      expect(evidence).toBeNull();
    });
  });

  describe('failed steps', () => {
    it('returns null for failed steps', () => {
      const collector = new VerificationCollector();
      const evidence = collector.collectFromStep(
        makeStep({ success: false, output: { command: 'vitest run' } }),
      );
      expect(evidence).toBeNull();
    });
  });

  describe('freshness', () => {
    it('marks evidence as fresh when after last code change', () => {
      const collector = new VerificationCollector();
      const future = new Date(Date.now() + 10000).toISOString();
      const evidence = collector.collectFromStep(
        makeStep({ timestamp: future, output: { command: 'vitest run' } }),
      );
      expect(evidence?.fresh).toBe(true);
    });

    it('marks evidence as stale when before last code change', () => {
      const collector = new VerificationCollector();
      const past = '2020-01-01T00:00:00.000Z';
      const evidence = collector.collectFromStep(
        makeStep({ timestamp: past, output: { command: 'vitest run' } }),
      );
      expect(evidence?.fresh).toBe(false);
    });

    it('resets freshness after markCodeChange', () => {
      const collector = new VerificationCollector();
      const past = new Date(Date.now() - 5000).toISOString();
      collector.markCodeChange();
      const evidence = collector.collectFromStep(
        makeStep({ timestamp: past, output: { command: 'vitest run' } }),
      );
      expect(evidence?.fresh).toBe(false);
    });
  });

  describe('detail extraction', () => {
    it('extracts string output directly', () => {
      const collector = new VerificationCollector();
      const evidence = collector.collectFromStep(
        makeStep({ action: 'browser_navigate', tool: 'browser', output: 'Page loaded' }),
      );
      expect(evidence?.details).toBe('Page loaded');
    });

    it('extracts output.output field', () => {
      const collector = new VerificationCollector();
      const evidence = collector.collectFromStep(
        makeStep({ output: { command: 'vitest run', output: 'All tests passed' } }),
      );
      expect(evidence?.details).toBe('All tests passed');
    });

    it('extracts output.stdout field', () => {
      const collector = new VerificationCollector();
      const evidence = collector.collectFromStep(
        makeStep({ output: { command: 'tsc --noEmit', stdout: 'No errors' } }),
      );
      expect(evidence?.details).toBe('No errors');
    });

    it('truncates long output to 500 chars', () => {
      const collector = new VerificationCollector();
      const longOutput = 'x'.repeat(1000);
      const evidence = collector.collectFromStep(
        makeStep({ action: 'browser_navigate', tool: 'browser', output: longOutput }),
      );
      expect(evidence?.details.length).toBe(500);
    });

    it('falls back to tool name message', () => {
      const collector = new VerificationCollector();
      const evidence = collector.collectFromStep(
        makeStep({ action: 'browser_navigate', tool: 'browser', output: undefined }),
      );
      expect(evidence?.details).toBe('browser completed successfully');
    });
  });

  describe('collectFromPhase', () => {
    it('collects evidence from multiple steps', () => {
      const collector = new VerificationCollector();
      const steps = [
        makeStep({ stepId: 's1', output: { command: 'vitest run' } }),
        makeStep({ stepId: 's2', output: { command: 'tsc --noEmit' } }),
        makeStep({ stepId: 's3', output: { command: 'echo done' } }),
      ];
      const results = collector.collectFromPhase(steps);
      expect(results).toHaveLength(2);
      expect(results[0].type).toBe('test_pass');
      expect(results[1].type).toBe('type_check');
    });

    it('returns empty array for no valid steps', () => {
      const collector = new VerificationCollector();
      const results = collector.collectFromPhase([makeStep({ success: false })]);
      expect(results).toEqual([]);
    });
  });

  describe('source field', () => {
    it('formats source as tool:stepId', () => {
      const collector = new VerificationCollector();
      const evidence = collector.collectFromStep(
        makeStep({ stepId: 'abc-123', tool: 'run_command', output: { command: 'jest' } }),
      );
      expect(evidence?.source).toBe('run_command:abc-123');
    });
  });
});
