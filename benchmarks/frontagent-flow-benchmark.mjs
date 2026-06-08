#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { Planner } from '../packages/core/dist/planner.js';
import { Executor } from '../packages/core/dist/executor.js';
import { LLMService } from '../packages/core/dist/llm.js';
import { HallucinationGuard } from '../packages/hallucination-guard/dist/index.js';
import { navigate } from '../packages/mcp-filesense/dist/engine.js';

const ROOT = process.env.FRONTAGENT_BENCH_ROOT ?? '/tmp/frontagent-flow-bench-workspace';
const RUNS = Number(process.env.RUNS ?? 10);
const MODE = process.env.BENCH_MODE ?? 'local';
const LLM_MODE = process.env.BENCH_LLM ?? 'stub';
const USE_LLM_PLANNER = process.env.BENCH_USE_LLM_PLANNER === '1' || LLM_MODE === 'real-full';
const CLEAR_FRONTAGENT_CACHE = process.env.BENCH_CLEAR_CACHE !== '0';
const WRITE_JSON = process.env.BENCH_JSON;
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const scenarioNamesByMode = {
  smoke: new Set(['query-explicit-file', 'query-structure', 'refactor-multi-file']),
  realCreate: new Set(['create-component']),
  local: null,
  full: null,
};

async function rm(targetPath) {
  await fs.rm(targetPath, { recursive: true, force: true });
}

async function clearFrontagentCache() {
  if (CLEAR_FRONTAGENT_CACHE) {
    await rm(path.join(ROOT, '.frontagent'));
  }
}

async function createFixture() {
  await rm(ROOT);
  await fs.mkdir(path.join(ROOT, 'src/components'), { recursive: true });
  await fs.mkdir(path.join(ROOT, 'src/hooks'), { recursive: true });
  await fs.mkdir(path.join(ROOT, 'src/services'), { recursive: true });
  await fs.writeFile(path.join(ROOT, 'package.json'), JSON.stringify({ scripts: { test: 'vitest' }, dependencies: { react: '^18.0.0' } }, null, 2));
  await fs.writeFile(path.join(ROOT, 'README.md'), '# Fixture\n');
  await fs.writeFile(path.join(ROOT, 'src/main.tsx'), 'export const main = 1;\n');
  await fs.writeFile(path.join(ROOT, 'src/components/Button.tsx'), 'export const Button = () => null;\n');
  await fs.writeFile(path.join(ROOT, 'src/hooks/useFoo.ts'), 'export const useFoo = () => 1;\n');
  await fs.writeFile(path.join(ROOT, 'src/services/foo.ts'), 'export const foo = () => 1;\n');
}

function makeTask(type, description, context = {}) {
  return {
    id: `task-${type}-${Math.random().toString(16).slice(2)}`,
    type,
    description,
    context: { workingDirectory: ROOT, ...context },
  };
}

function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return { avg, min: sorted[0], median: sorted[Math.floor(sorted.length / 2)], max: sorted.at(-1) };
}

async function timed(fn) {
  const start = performance.now();
  const result = await fn();
  return { elapsedMs: performance.now() - start, result };
}

class LocalMcpClient {
  constructor(latencyMs = 0) {
    this.latencyMs = latencyMs;
    this.calls = [];
  }

  resetCalls() {
    this.calls = [];
  }

  async listTools() {
    return [];
  }

  async callTool(name, args) {
    const start = performance.now();
    if (this.latencyMs) await new Promise((resolve) => setTimeout(resolve, this.latencyMs));

    let result;
    if (name === 'read_file') {
      const content = await fs.readFile(path.join(ROOT, String(args.path)), 'utf8');
      result = { success: true, content };
    } else if (name === 'list_directory') {
      const entries = await fs.readdir(path.join(ROOT, String(args.path ?? '.')), { withFileTypes: true });
      result = { success: true, entries: entries.map((entry) => ({ name: entry.name, type: entry.isDirectory() ? 'directory' : 'file' })) };
    } else if (name === 'search_code') {
      result = { success: true, matches: [] };
    } else if (name === 'get_ast') {
      result = { success: true, ast: { type: 'Program', body: [] } };
    } else if (name === 'create_file') {
      const filePath = path.join(ROOT, String(args.path));
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, String(args.content ?? ''));
      result = { success: true, path: args.path, content: args.content };
    } else if (name === 'apply_patch') {
      result = { success: true, patched: true };
    } else if (name === 'filesense_navigate') {
      const target = Array.isArray(args.paths) && args.paths.length ? path.join(ROOT, String(args.paths[0])) : ROOT;
      result = { success: true, data: await navigate(target, args) };
    } else {
      result = { success: true, noop: true };
    }

    this.calls.push({ name, args, elapsedMs: performance.now() - start });
    return result;
  }
}

function createLlmConfig() {
  return {
    provider: process.env.PROVIDER ?? 'openai',
    model: process.env.MODEL ?? 'bench',
    apiKey: process.env.API_KEY ?? 'bench',
    baseURL: process.env.BASE_URL,
    maxTokens: Number(process.env.MAX_TOKENS ?? 2048),
  };
}

function createPlanner() {
  return new Planner({ llm: createLlmConfig(), useLLM: USE_LLM_PLANNER });
}

function createLlmService() {
  if (LLM_MODE === 'real' || LLM_MODE === 'real-full') {
    return new LLMService(createLlmConfig());
  }

  return {
    generateCodeForFile: async ({ filePath }) => {
      const exportName = path.basename(String(filePath)).replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_$]/g, '') || 'Generated';
      return `export const ${exportName} = () => null;\n`;
    },
    generateModifiedCode: async ({ originalCode }) => originalCode,
  };
}

function createExecutor(client, traces) {
  const llmService = createLlmService();

  const executor = new Executor({
    projectRoot: ROOT,
    hallucinationGuard: new HallucinationGuard({ projectRoot: ROOT }),
    llmService,
    security: { mode: 'developer', interactive: false },
    trace: {
      enabled: true,
      onStepTrace: (trace) => traces.push(trace),
    },
  });

  executor.registerMCPClient('bench', client);
  for (const tool of ['read_file', 'list_directory', 'search_code', 'get_ast', 'create_file', 'apply_patch', 'filesense_navigate']) {
    executor.registerToolMapping(tool, 'bench');
  }
  return executor;
}

function summarizeTraces(traces) {
  const byAction = {};
  for (const trace of traces) {
    const bucket = byAction[trace.action] ??= { count: 0, totalMs: [], stages: {} };
    bucket.count += 1;
    bucket.totalMs.push(trace.totalMs);
    for (const stage of trace.stages) {
      (bucket.stages[stage.name] ??= []).push(stage.durationMs);
    }
  }

  return Object.fromEntries(Object.entries(byAction).map(([action, value]) => [
    action,
    {
      count: value.count,
      totalMs: stats(value.totalMs),
      stages: Object.fromEntries(Object.entries(value.stages).map(([stageName, values]) => [stageName, stats(values)])),
    },
  ]));
}

async function runScenario(scenario) {
  await createFixture();
  await clearFrontagentCache();

  const planner = createPlanner();
  const client = new LocalMcpClient(0);
  const traces = [];
  const executor = createExecutor(client, traces);
  const task = scenario.task();

  const contextFiles = new Map((task.context?.relevantFiles ?? []).map((file) => [file, 'preloaded benchmark content']));
  const cacheClearTiming = await timed(() => clearFrontagentCache());
  const planTiming = await timed(() => planner.plan(task, { files: contextFiles }, []));
  if (!planTiming.result.plan) throw new Error(`No plan for ${scenario.name}`);

  client.resetCalls();
  const executionTiming = await timed(() => executor.executeSteps(planTiming.result.plan.steps, {
    task,
    collectedContext: { files: new Map() },
  }));

  return {
    cacheClearMs: cacheClearTiming.elapsedMs,
    planMs: planTiming.elapsedMs,
    executeMs: executionTiming.elapsedMs,
    totalMs: cacheClearTiming.elapsedMs + planTiming.elapsedMs + executionTiming.elapsedMs,
    planAndExecuteMs: planTiming.elapsedMs + executionTiming.elapsedMs,
    stepCount: planTiming.result.plan.steps.length,
    steps: planTiming.result.plan.steps.map((step) => ({ action: step.action, tool: step.tool, phase: step.phase, duration: step.result?.duration ?? null })),
    toolCalls: client.calls,
    traces,
  };
}

const allScenarios = [
  { name: 'query-explicit-file', task: () => makeTask('query', '读取 README.md 并总结', { relevantFiles: ['README.md'] }) },
  { name: 'query-structure', task: () => makeTask('query', '梳理这个项目的目录结构和入口') },
  { name: 'create-component', task: () => makeTask('create', '新增一个 Card 组件到 src/components') },
  { name: 'debug-structure', task: () => makeTask('debug', '排查页面白屏问题，需要理解相关模块') },
  { name: 'refactor-multi-file', task: () => makeTask('refactor', '重构 hooks 和 service 调用', { relevantFiles: ['src/hooks/useFoo.ts', 'src/services/foo.ts'] }) },
];

await createFixture();
const selectedNames = scenarioNamesByMode[MODE] ?? null;
const scenarios = selectedNames ? allScenarios.filter((scenario) => selectedNames.has(scenario.name)) : allScenarios;
const out = {
  repoRoot: REPO_ROOT,
  root: ROOT,
  mode: MODE,
  llmMode: LLM_MODE,
  useLlmPlanner: USE_LLM_PLANNER,
  clearFrontagentCache: CLEAR_FRONTAGENT_CACHE,
  runs: RUNS,
  scenarios: {},
};

for (const scenario of scenarios) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(await runScenario(scenario));
  const allToolCalls = runs.flatMap((run) => run.toolCalls.map((call) => call.name));
  out.scenarios[scenario.name] = {
    cacheClearMs: stats(runs.map((run) => run.cacheClearMs)),
    planMs: stats(runs.map((run) => run.planMs)),
    executeMs: stats(runs.map((run) => run.executeMs)),
    planAndExecuteMs: stats(runs.map((run) => run.planAndExecuteMs)),
    totalMs: stats(runs.map((run) => run.totalMs)),
    stepCount: stats(runs.map((run) => run.stepCount)),
    sampleSteps: runs.at(-1).steps,
    toolCallCounts: allToolCalls.reduce((acc, name) => (acc[name] = (acc[name] ?? 0) + 1, acc), {}),
    sampleToolTimings: runs.at(-1).toolCalls,
    traceSummary: summarizeTraces(runs.flatMap((run) => run.traces)),
    sampleTraces: runs.at(-1).traces,
  };
}

const json = JSON.stringify(out, null, 2);
if (WRITE_JSON) {
  await fs.mkdir(path.dirname(path.resolve(WRITE_JSON)), { recursive: true });
  await fs.writeFile(WRITE_JSON, `${json}\n`);
}
console.log(json);
