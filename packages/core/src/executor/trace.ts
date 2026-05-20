import type {
  ExecutorStepTrace,
  ExecutorTraceCollector,
  ExecutorTraceConfig,
  ExecutorTraceSummary,
} from './types.js';

function calcStats(values: number[]): { avg: number; min: number; median: number; max: number } {
  if (values.length === 0) return { avg: 0, min: 0, median: 0, max: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return {
    avg,
    min: sorted[0],
    median: sorted[Math.floor(sorted.length / 2)],
    max: sorted[sorted.length - 1],
  };
}

function summarizeTraces(traces: ExecutorStepTrace[]): Record<string, ExecutorTraceSummary> {
  const byTool: Record<string, ExecutorStepTrace[]> = {};
  for (const t of traces) {
    (byTool[t.tool] ??= []).push(t);
  }

  const result: Record<string, ExecutorTraceSummary> = {};
  for (const [tool, group] of Object.entries(byTool)) {
    const stageMap: Record<string, number[]> = {};
    const subStageMap: Record<string, number[]> = {};
    const toolDurations: number[] = [];

    for (const t of group) {
      if (t.toolDurationMs != null) toolDurations.push(t.toolDurationMs);
      for (const s of t.stages) {
        (stageMap[s.name] ??= []).push(s.durationMs);
      }
      if (t.subStages) {
        for (const s of t.subStages) {
          (subStageMap[s.name] ??= []).push(s.durationMs);
        }
      }
    }

    const stages: Record<string, { avg: number; min: number; median: number; max: number }> = {};
    for (const [name, vals] of Object.entries(stageMap)) stages[name] = calcStats(vals);
    const subStages: Record<string, { avg: number; min: number; median: number; max: number }> = {};
    for (const [name, vals] of Object.entries(subStageMap)) subStages[name] = calcStats(vals);

    result[tool] = {
      count: group.length,
      totalMs: calcStats(group.map((t) => t.totalMs)),
      toolDurationMs: calcStats(toolDurations),
      stages,
      subStages,
    };
  }
  return result;
}

export function createTraceCollector(): ExecutorTraceCollector {
  const traces: ExecutorStepTrace[] = [];
  return {
    traces,
    config: {
      enabled: true,
      onStepTrace: (trace) => traces.push(trace),
    } satisfies ExecutorTraceConfig,
    summary() {
      return summarizeTraces(traces);
    },
  };
}
