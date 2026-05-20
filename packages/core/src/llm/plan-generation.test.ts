import { describe, expect, it } from 'vitest';
import type { PlanGenerationDeps } from './plan-generation.js';
import { normalizePlan } from './plan-generation.js';

const noopDeps: PlanGenerationDeps = {
  debugLog: () => {},
  debugWarn: () => {},
  debugError: () => {},
  generateObject: async () => ({}) as never,
};

describe('normalizePlan', () => {
  it('passes through well-formed plan', () => {
    const raw = {
      summary: 'Test plan',
      steps: [
        {
          description: 'step 1',
          action: 'create_file',
          tool: 'write_file',
          phase: 'phase-1',
          params: { path: 'src/app.ts' },
          reasoning: 'needed',
          needsCodeGeneration: true,
        },
      ],
      risks: ['risk 1'],
      alternatives: ['alt 1'],
    };
    const result = normalizePlan(raw, noopDeps);
    expect(result.summary).toBe('Test plan');
    expect(result.steps).toHaveLength(1);
    expect(result.risks).toEqual(['risk 1']);
    expect(result.alternatives).toEqual(['alt 1']);
  });

  it('defaults summary when missing', () => {
    const result = normalizePlan({ steps: [], risks: [], alternatives: [] }, noopDeps);
    expect(result.summary).toBe('Generated Plan');
  });

  it('handles steps as string (malformed LLM output)', () => {
    const result = normalizePlan(
      { summary: 'plan', steps: 'not an array', risks: [], alternatives: [] },
      noopDeps,
    );
    expect(result.steps).toEqual([]);
  });

  it('parses stringified params in steps', () => {
    const raw = {
      summary: 'plan',
      steps: [
        {
          description: 'write',
          action: 'create_file',
          tool: 'write_file',
          phase: 'p1',
          params: '{"path":"src/x.ts"}',
          reasoning: 'r',
          needsCodeGeneration: false,
        },
      ],
      risks: [],
      alternatives: [],
    };
    const result = normalizePlan(raw, noopDeps);
    expect(result.steps[0].params).toEqual({ path: 'src/x.ts' });
  });

  it('wraps unparseable string params in value key', () => {
    const raw = {
      summary: 'plan',
      steps: [
        {
          description: 'write',
          action: 'create_file',
          tool: 'write_file',
          phase: 'p1',
          params: 'not json',
          reasoning: 'r',
          needsCodeGeneration: false,
        },
      ],
      risks: [],
      alternatives: [],
    };
    const result = normalizePlan(raw, noopDeps);
    expect(result.steps[0].params).toEqual({ value: 'not json' });
  });

  it('defaults null/undefined params to empty object', () => {
    const raw = {
      summary: 'plan',
      steps: [
        {
          description: 'write',
          action: 'create_file',
          tool: 'write_file',
          phase: 'p1',
          params: null,
          reasoning: 'r',
          needsCodeGeneration: false,
        },
      ],
      risks: [],
      alternatives: [],
    };
    const result = normalizePlan(raw, noopDeps);
    expect(result.steps[0].params).toEqual({});
  });

  it('coerces string needsCodeGeneration to boolean', () => {
    const raw = {
      summary: 'plan',
      steps: [
        {
          description: 'write',
          action: 'create_file',
          tool: 'write_file',
          phase: 'p1',
          params: {},
          reasoning: 'r',
          needsCodeGeneration: 'true',
        },
      ],
      risks: [],
      alternatives: [],
    };
    const result = normalizePlan(raw, noopDeps);
    expect(result.steps[0].needsCodeGeneration).toBe(true);
  });

  it('converts string risks to array', () => {
    const result = normalizePlan(
      { summary: 'plan', steps: [], risks: 'single risk', alternatives: [] },
      noopDeps,
    );
    expect(result.risks).toEqual(['single risk']);
  });

  it('converts string alternatives to array', () => {
    const result = normalizePlan(
      { summary: 'plan', steps: [], risks: [], alternatives: 'single alt' },
      noopDeps,
    );
    expect(result.alternatives).toEqual(['single alt']);
  });

  it('defaults non-array risks to empty array', () => {
    const result = normalizePlan(
      { summary: 'plan', steps: [], risks: 123, alternatives: [] },
      noopDeps,
    );
    expect(result.risks).toEqual([]);
  });

  it('defaults non-array alternatives to empty array', () => {
    const result = normalizePlan(
      { summary: 'plan', steps: [], risks: [], alternatives: null },
      noopDeps,
    );
    expect(result.alternatives).toEqual([]);
  });
});
