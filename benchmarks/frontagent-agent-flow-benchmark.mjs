#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { runFrontAgentTask } from '../packages/runtime-node/dist/run.js';

const ROOT = process.env.FRONTAGENT_BENCH_ROOT ?? '/tmp/frontagent-agent-flow-bench-workspace';
const RUNS = Number(process.env.RUNS ?? 3);
const MODE = process.env.BENCH_MODE ?? 'smoke';
const LLM_MODE = process.env.BENCH_LLM ?? 'stub';
const CLEAR_FRONTAGENT_CACHE = process.env.BENCH_CLEAR_CACHE !== '0';
const WRITE_JSON = process.env.BENCH_JSON;
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const STAGE_BY_STATUS_LABEL = new Map([
  ['初始化任务', 'initialize_task'],
  ['加载跨会话记忆', 'memory_preload'],
  ['扫描项目结构', 'project_prescan'],
  ['检测开发服务器端口', 'dev_server_detect'],
  ['检索知识库', 'rag_retrieve'],
  ['生成执行计划', 'planner'],
  ['补充规划上下文', 'gather_context'],
  ['重新生成执行计划', 'planner_retry'],
  ['执行计划已生成', 'planner_finalize'],
  ['执行工具步骤', 'executor'],
  ['生成最终回答', 'final_output'],
  ['汇总执行结果', 'final_output'],
  ['任务执行完成', 'task_complete'],
  ['持久化运行记忆', 'memory_persist'],
  ['清理运行上下文', 'context_cleanup'],
  ['关闭浏览器资源', 'browser_cleanup'],
  ['收尾完成', 'runtime_cleanup'],
]);

const scenarioNamesByMode = {
  smoke: new Set(['query-identity', 'query-structure']),
  query: new Set(['query-structure']),
  create: new Set(['create-component']),
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
  await fs.writeFile(path.join(ROOT, 'package.json'), JSON.stringify({
    scripts: { dev: 'vite --host 0.0.0.0 --port 5173', test: 'vitest' },
    dependencies: { '@vitejs/plugin-react': '^latest', vite: '^latest', react: '^18.0.0', 'react-dom': '^18.0.0' },
    devDependencies: { typescript: '^latest' },
  }, null, 2));
  await fs.writeFile(path.join(ROOT, 'README.md'), '# Fixture\n\nSmall benchmark app.\n');
  await fs.writeFile(path.join(ROOT, 'vite.config.ts'), "import { defineConfig } from 'vite';\nexport default defineConfig({ server: { port: 5173 } });\n");
  await fs.writeFile(path.join(ROOT, 'tsconfig.json'), JSON.stringify({ compilerOptions: { jsx: 'react-jsx', strict: true } }, null, 2));
  await fs.writeFile(path.join(ROOT, 'src/main.tsx'), "import React from 'react';\nimport { Button } from './components/Button';\nexport const main = <Button />;\n");
  await fs.writeFile(path.join(ROOT, 'src/components/Button.tsx'), "export const Button = () => <button>OK</button>;\n");
  await fs.writeFile(path.join(ROOT, 'src/hooks/useFoo.ts'), 'export const useFoo = () => 1;\n');
  await fs.writeFile(path.join(ROOT, 'src/services/foo.ts'), 'export const foo = () => 1;\n');
}

function stats(values) {
  const safeValues = values.filter((value) => Number.isFinite(value));
  if (!safeValues.length) return { avg: 0, min: 0, median: 0, max: 0 };
  const sorted = [...safeValues].sort((a, b) => a - b);
  const avg = safeValues.reduce((a, b) => a + b, 0) / safeValues.length;
  return { avg, min: sorted[0], median: sorted[Math.floor(sorted.length / 2)], max: sorted.at(-1) };
}

async function timed(fn) {
  const start = performance.now();
  const result = await fn();
  return { elapsedMs: performance.now() - start, result };
}

function createLlmBackend() {
  if (LLM_MODE === 'real') return undefined;

  return {
    name: 'frontagent-agent-flow-benchmark-stub',
    async generateText({ messages }) {
      const lastMessage = messages?.at(-1)?.content ?? '';
      return `基于当前执行证据的基准测试回答。问题摘要：${String(lastMessage).slice(0, 120)}`;
    },
    async generateObject() {
      return {
        summary: 'Stub benchmark plan',
        steps: [
          {
            description: '按需导航项目结构',
            action: 'filesense_navigate',
            tool: 'filesense_navigate',
            params: { path: '.', paths: ['.'], depth: 2, maxEntries: 40, maxBytes: 20000, output: 'summary', writeMode: 'cache' },
            dependencies: [],
            validation: [],
            phase: '探索',
          },
          {
            description: '读取 README',
            action: 'read_file',
            tool: 'read_file',
            params: { path: 'README.md' },
            dependencies: [],
            validation: [],
            phase: '探索',
          },
        ],
        phases: [{ name: '探索', description: '读取项目上下文', stepIndices: [0, 1] }],
        rollbackStrategy: { enabled: true, snapshotBeforeExecution: true, rollbackOnFailure: true, maxRollbackSteps: 3 },
      };
    },
  };
}

function createRunTrace() {
  const trace = {
    timeline: [],
    stages: {},
    tools: [],
    rag: null,
    plan: null,
    result: null,
  };
  let activeStage;

  function finishActive(now) {
    if (!activeStage) return;
    const durationMs = now - activeStage.startedAt;
    const existing = trace.stages[activeStage.name] ??= { count: 0, totalMs: 0, durations: [], labels: [] };
    existing.count += 1;
    existing.totalMs += durationMs;
    existing.durations.push(durationMs);
    existing.labels.push(activeStage.label);
    activeStage = undefined;
  }

  return {
    trace,
    onEvent(event) {
      const now = performance.now();
      trace.timeline.push({ atMs: now, type: event.type, label: event.label, operation: event.operation });

      if (event.type === 'status_update') {
        const stageName = STAGE_BY_STATUS_LABEL.get(event.label);
        if (stageName) {
          finishActive(now);
          activeStage = { name: stageName, label: event.label, startedAt: now };
        }
      }

      if (event.type === 'planning_started') {
        finishActive(now);
        activeStage = { name: 'planner', label: 'planning_started', startedAt: now };
      }

      if (event.type === 'planning_completed') {
        finishActive(now);
        trace.plan = {
          stepCount: event.plan.steps.length,
          phases: event.plan.phases?.map((phase) => phase.name) ?? [],
          actions: event.plan.steps.map((step) => step.action),
        };
      }

      if (event.type === 'rag_retrieved') {
        trace.rag = {
          matchCount: event.matches.length,
          searchMode: event.searchMode ?? null,
          reranked: event.reranked ?? false,
          warningCount: event.warnings?.length ?? 0,
        };
      }

      if (event.type === 'step_started') {
        trace.tools.push({ stepId: event.step.stepId, action: event.step.action, tool: event.step.tool, startedAt: now });
      }

      if (event.type === 'step_completed' || event.type === 'step_failed') {
        const step = event.step;
        const item = [...trace.tools].reverse().find((candidate) => candidate.stepId === step.stepId && candidate.finishedAt === undefined);
        if (item) {
          item.finishedAt = now;
          item.elapsedMs = now - item.startedAt;
          item.success = event.type === 'step_completed';
          item.error = event.type === 'step_failed' ? event.error : undefined;
          item.resultDurationMs = event.type === 'step_completed' ? event.result?.duration : undefined;
        }
      }

      if (event.type === 'task_completed') {
        finishActive(now);
        trace.result = { success: event.result.success, duration: event.result.duration, stepCount: event.result.executedSteps.length, error: event.result.error };
      }

      if (event.type === 'task_failed') {
        finishActive(now);
        trace.result = { success: false, error: event.error };
      }
    },
    finish() {
      finishActive(performance.now());
    },
  };
}

function summarizeTools(tools) {
  const byTool = {};
  for (const tool of tools) {
    const key = tool.tool ?? tool.action;
    const bucket = byTool[key] ??= { count: 0, elapsedMs: [] };
    bucket.count += 1;
    if (Number.isFinite(tool.elapsedMs)) bucket.elapsedMs.push(tool.elapsedMs);
  }
  return Object.fromEntries(Object.entries(byTool).map(([tool, value]) => [tool, { count: value.count, elapsedMs: stats(value.elapsedMs) }]));
}

async function runScenario(scenario) {
  await createFixture();
  const cacheClearTiming = await timed(() => clearFrontagentCache());
  const { trace, onEvent, finish } = createRunTrace();
  const llmBackend = createLlmBackend();

  const runTiming = await timed(() => runFrontAgentTask({
    projectRoot: ROOT,
    task: scenario.task,
    type: scenario.type,
    files: scenario.files,
    provider: process.env.PROVIDER,
    model: process.env.MODEL,
    baseUrl: process.env.BASE_URL,
    apiKey: process.env.API_KEY,
    maxTokens: process.env.MAX_TOKENS ?? (LLM_MODE === 'real' ? 1800 : 1024),
    disableRag: process.env.BENCH_DISABLE_RAG === '1' ? true : false,
    disableRagSemantic: process.env.BENCH_DISABLE_RAG_SEMANTIC !== '0',
    disableRagReranker: process.env.BENCH_DISABLE_RAG_RERANKER !== '0',
    ragSyncOnQuery: process.env.BENCH_RAG_SYNC_ON_QUERY === '1',
    ragMaxResults: process.env.BENCH_RAG_MAX_RESULTS ?? 5,
    ragKeywordCandidates: process.env.BENCH_RAG_KEYWORD_CANDIDATES ?? 20,
    disableRagQueryRewrite: process.env.BENCH_DISABLE_RAG_QUERY_REWRITE === '1',
    securityMode: 'developer',
    runLog: false,
    filterConsole: true,
    debug: false,
    codeQualityIsolationMode: 'in_memory',
    streamShellOutput: false,
    llmBackend,
    onEvent,
  }));
  finish();

  return {
    cacheClearMs: cacheClearTiming.elapsedMs,
    agentExecuteMs: runTiming.elapsedMs,
    totalMs: cacheClearTiming.elapsedMs + runTiming.elapsedMs,
    success: runTiming.result.success,
    error: runTiming.result.error,
    outputChars: runTiming.result.output?.length ?? 0,
    executedStepCount: runTiming.result.executedSteps.length,
    agentReportedDurationMs: runTiming.result.duration,
    stages: trace.stages,
    rag: trace.rag,
    plan: trace.plan,
    toolSummary: summarizeTools(trace.tools),
    tools: trace.tools.map((tool) => ({
      action: tool.action,
      tool: tool.tool,
      elapsedMs: tool.elapsedMs,
      resultDurationMs: tool.resultDurationMs,
      success: tool.success,
      error: tool.error,
    })),
  };
}

const allScenarios = [
  { name: 'query-identity', type: 'query', task: '你是谁？请基于 FrontAgent 内置身份回答。' },
  { name: 'query-structure', type: 'query', task: '梳理这个项目的目录结构和入口。' },
  { name: 'create-component', type: 'create', task: '新增一个 Card 组件到 src/components，保持实现简单。' },
];

async function main() {
  const filter = scenarioNamesByMode[MODE] ?? null;
  const scenarios = allScenarios.filter((scenario) => !filter || filter.has(scenario.name));
  const output = {
    benchmark: 'frontagent-agent-execute-flow',
    repoRoot: REPO_ROOT,
    projectRoot: ROOT,
    runs: RUNS,
    mode: MODE,
    llmMode: LLM_MODE,
    clearFrontagentCache: CLEAR_FRONTAGENT_CACHE,
    cacheClearingIncludedInTotal: true,
    rag: {
      enabled: process.env.BENCH_DISABLE_RAG !== '1',
      semanticEnabled: process.env.BENCH_DISABLE_RAG_SEMANTIC === '0',
      rerankerEnabled: process.env.BENCH_DISABLE_RAG_RERANKER === '0',
      syncOnQuery: process.env.BENCH_RAG_SYNC_ON_QUERY === '1',
      queryRewriteEnabled: process.env.BENCH_DISABLE_RAG_QUERY_REWRITE !== '1',
    },
    scenarios: {},
  };

  for (const scenario of scenarios) {
    const runs = [];
    for (let i = 0; i < RUNS; i += 1) {
      runs.push(await runScenario(scenario));
    }
    output.scenarios[scenario.name] = {
      task: scenario.task,
      type: scenario.type,
      runs,
      summary: {
        cacheClearMs: stats(runs.map((run) => run.cacheClearMs)),
        agentExecuteMs: stats(runs.map((run) => run.agentExecuteMs)),
        totalMs: stats(runs.map((run) => run.totalMs)),
        successRate: runs.filter((run) => run.success).length / runs.length,
        executedStepCount: stats(runs.map((run) => run.executedStepCount)),
        stages: {},
      },
    };

    const stageNames = [...new Set(runs.flatMap((run) => Object.keys(run.stages)))];
    output.scenarios[scenario.name].summary.stages = Object.fromEntries(stageNames.map((stageName) => [
      stageName,
      stats(runs.map((run) => run.stages[stageName]?.totalMs ?? 0)),
    ]));
    const toolNames = [...new Set(runs.flatMap((run) => Object.keys(run.toolSummary)))];
    output.scenarios[scenario.name].summary.tools = Object.fromEntries(toolNames.map((toolName) => [
      toolName,
      {
        count: stats(runs.map((run) => run.toolSummary[toolName]?.count ?? 0)),
        elapsedMs: stats(runs.flatMap((run) => run.toolSummary[toolName]?.elapsedMs?.avg ?? [])),
      },
    ]));
    output.scenarios[scenario.name].summary.rag = {
      matchCount: stats(runs.map((run) => run.rag?.matchCount ?? 0)),
      rerankedRate: runs.filter((run) => run.rag?.reranked).length / runs.length,
      warningCount: stats(runs.map((run) => run.rag?.warningCount ?? 0)),
    };
  }

  const json = JSON.stringify(output, null, 2);
  if (WRITE_JSON) await fs.writeFile(WRITE_JSON, json);
  console.log(json);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
