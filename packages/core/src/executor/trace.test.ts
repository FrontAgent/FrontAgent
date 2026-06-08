import type { ExecutionStep } from '@frontagent/shared';
import { describe, expect, it } from 'vitest';
import type { ExecutorOutput } from '../types.js';
import { createStepTraceRecorder } from './step-trace-recorder.js';
import { createTraceCollector } from './trace.js';
import type { ExecutorStepTrace } from './types.js';

function makeTrace(overrides: Partial<ExecutorStepTrace> = {}): ExecutorStepTrace {
  return {
    stepId: 'step-1',
    action: 'write_file',
    tool: 'write_file',
    totalMs: 100,
    success: true,
    stages: [{ name: 'call_tool', durationMs: 80, success: true }],
    toolDurationMs: 80,
    ...overrides,
  };
}

function makeStep(overrides: Partial<ExecutionStep> = {}): ExecutionStep {
  return {
    stepId: 'step-1',
    description: 'Read a file',
    action: 'read_file',
    tool: 'read_file',
    params: { path: 'src/a.ts' },
    dependencies: [],
    validation: [],
    status: 'pending',
    phase: 'build',
    ...overrides,
  };
}

function makeOutput(overrides: Partial<ExecutorOutput> = {}): ExecutorOutput {
  return {
    stepResult: {
      success: true,
      output: { success: true },
      duration: 10,
    },
    validation: { pass: true, results: [] },
    needsRollback: false,
    ...overrides,
  };
}

describe('createTraceCollector', () => {
  it('creates a collector with enabled config', () => {
    const collector = createTraceCollector();
    expect(collector.config.enabled).toBe(true);
    expect(collector.traces).toEqual([]);
  });

  it('collects traces via onStepTrace callback', () => {
    const collector = createTraceCollector();
    const trace = makeTrace();
    collector.config.onStepTrace!(trace);
    expect(collector.traces).toHaveLength(1);
    expect(collector.traces[0]).toBe(trace);
  });

  it('returns empty summary for no traces', () => {
    const collector = createTraceCollector();
    expect(collector.summary()).toEqual({});
  });

  it('computes correct stats for single trace', () => {
    const collector = createTraceCollector();
    collector.config.onStepTrace!(makeTrace({ totalMs: 50, toolDurationMs: 30 }));
    const summary = collector.summary();
    expect(summary.write_file).toBeDefined();
    expect(summary.write_file.count).toBe(1);
    expect(summary.write_file.totalMs).toEqual({ avg: 50, min: 50, median: 50, max: 50 });
    expect(summary.write_file.toolDurationMs).toEqual({ avg: 30, min: 30, median: 30, max: 30 });
  });

  it('computes correct stats for multiple traces of same tool', () => {
    const collector = createTraceCollector();
    collector.config.onStepTrace!(makeTrace({ totalMs: 10, toolDurationMs: 5 }));
    collector.config.onStepTrace!(makeTrace({ totalMs: 20, toolDurationMs: 15 }));
    collector.config.onStepTrace!(makeTrace({ totalMs: 30, toolDurationMs: 25 }));

    const summary = collector.summary();
    expect(summary.write_file.count).toBe(3);
    expect(summary.write_file.totalMs.avg).toBe(20);
    expect(summary.write_file.totalMs.min).toBe(10);
    expect(summary.write_file.totalMs.median).toBe(20);
    expect(summary.write_file.totalMs.max).toBe(30);
  });

  it('groups traces by tool', () => {
    const collector = createTraceCollector();
    collector.config.onStepTrace!(makeTrace({ tool: 'read_file', totalMs: 10 }));
    collector.config.onStepTrace!(makeTrace({ tool: 'write_file', totalMs: 50 }));
    collector.config.onStepTrace!(makeTrace({ tool: 'read_file', totalMs: 20 }));

    const summary = collector.summary();
    expect(summary.read_file.count).toBe(2);
    expect(summary.write_file.count).toBe(1);
  });

  it('aggregates stage durations', () => {
    const collector = createTraceCollector();
    collector.config.onStepTrace!(
      makeTrace({
        stages: [
          { name: 'validate_params', durationMs: 5, success: true },
          { name: 'call_tool', durationMs: 80, success: true },
        ],
      }),
    );
    collector.config.onStepTrace!(
      makeTrace({
        stages: [
          { name: 'validate_params', durationMs: 15, success: true },
          { name: 'call_tool', durationMs: 120, success: true },
        ],
      }),
    );

    const summary = collector.summary();
    expect(summary.write_file.stages.validate_params.avg).toBe(10);
    expect(summary.write_file.stages.call_tool.avg).toBe(100);
  });

  it('aggregates subStage durations', () => {
    const collector = createTraceCollector();
    collector.config.onStepTrace!(
      makeTrace({
        subStages: [{ name: 'hallucination_check', durationMs: 12, success: true }],
      }),
    );
    collector.config.onStepTrace!(
      makeTrace({
        subStages: [{ name: 'hallucination_check', durationMs: 8, success: true }],
      }),
    );

    const summary = collector.summary();
    expect(summary.write_file.subStages.hallucination_check.avg).toBe(10);
    expect(summary.write_file.subStages.hallucination_check.min).toBe(8);
    expect(summary.write_file.subStages.hallucination_check.max).toBe(12);
  });

  it('handles traces without toolDurationMs', () => {
    const collector = createTraceCollector();
    collector.config.onStepTrace!(makeTrace({ toolDurationMs: undefined }));

    const summary = collector.summary();
    expect(summary.write_file.toolDurationMs).toEqual({ avg: 0, min: 0, median: 0, max: 0 });
  });
});

describe('createStepTraceRecorder', () => {
  it('emits the executeStep trace payload when finishing skipped output', () => {
    const traces: ExecutorStepTrace[] = [];
    let now = 100;
    const output = makeOutput({
      stepResult: {
        success: true,
        output: { skipped: true, reason: 'missing path', __toolDurationMs: 12 },
        duration: 20,
      },
    });
    const recorder = createStepTraceRecorder({
      trace: {
        enabled: true,
        onStepTrace: (trace) => traces.push(trace),
      },
      taskId: 'task-1',
      step: makeStep(),
      nowMs: () => now,
    });

    now = 117;
    recorder.addSubStage('hallucination_check', 7);
    now = 140;
    const returned = recorder.finish(output);

    expect(returned).toBe(output);
    expect(traces).toEqual([
      expect.objectContaining({
        taskId: 'task-1',
        stepId: 'step-1',
        action: 'read_file',
        tool: 'read_file',
        totalMs: 40,
        success: true,
        skipped: true,
        toolDurationMs: 12,
        stages: [],
        subStages: [{ name: 'hallucination_check', durationMs: 7, success: true }],
      }),
    ]);
  });

  it('records failed stage timing and error before finish emits the trace', async () => {
    const traces: ExecutorStepTrace[] = [];
    let now = 0;
    const recorder = createStepTraceRecorder({
      trace: {
        enabled: true,
        onStepTrace: (trace) => traces.push(trace),
      },
      taskId: 'task-1',
      step: makeStep(),
      nowMs: () => now,
    });

    await expect(
      recorder.withStage('call_tool', async () => {
        now = 5;
        throw new Error('tool exploded');
      }),
    ).rejects.toThrow('tool exploded');

    now = 9;
    recorder.finish(
      makeOutput({
        stepResult: {
          success: false,
          error: 'tool exploded',
          duration: 9,
        },
        validation: { pass: false, results: [], blockedBy: ['tool exploded'] },
        needsRollback: true,
      }),
    );

    expect(traces[0]).toEqual(
      expect.objectContaining({
        totalMs: 9,
        success: false,
        error: 'tool exploded',
        stages: [{ name: 'call_tool', durationMs: 5, success: false, error: 'tool exploded' }],
      }),
    );
  });
});
