# FrontAgent 全流程优化执行记录

## 本轮改动

基于 `docs/frontagent-flow-optimization-plan.md` 的方案，本轮先落地 P0/P1 中风险较低、收益明确的部分：

1. **Executor Trace Layer**：给 `Executor.executeStep` 增加可选阶段级 trace hook。
2. **Benchmark Layer**：把临时全流程 benchmark 脚本沉淀到仓库。
3. **Execution Layer**：收口 `create_file` 的参数策略，避免空 content 误触发不可观测的真实 LLM 生成。
4. **Security / Filesense**：将 `filesense_navigate` 与 `filesense_query` 分类为只读工具，避免非交互模式下被 unknown-tool approval 路径跳过。

## 关键实现

### Executor 阶段级 Trace

新增类型：

- `ExecutorTraceStage`
- `ExecutorStepTrace`
- `ExecutorTraceConfig`

新增配置：

```ts
trace?: {
  enabled?: boolean;
  onStepTrace?: (trace: ExecutorStepTrace) => void;
}
```

当前覆盖阶段：

| 阶段 | 含义 |
| --- | --- |
| `validate_params` | step 参数与 action skill 参数校验 |
| `validate_before` | 执行前文件/路径/上下文校验 |
| `prepare_tool_params` | action skill 参数准备，包含动态代码生成 |
| `call_tool` | MCP tool 调用与安全检查 |
| `validate_after` | 工具执行后语法/导入等校验 |
| `catch` | 异常兜底 |

Trace 默认关闭；不开启时不改变原有执行语义。

### Benchmark 入仓

新增脚本：

```text
benchmarks/frontagent-flow-benchmark.mjs
```

新增命令：

```bash
pnpm bench:flow
pnpm bench:flow:smoke
```

脚本支持：

- `BENCH_MODE=smoke|local|full`
- `RUNS=<number>`
- `BENCH_JSON=<path>` 输出 JSON

Benchmark 使用本地 fixture、`Planner({ useLLM: false })`、本地 stub MCP client，以及可控的 fast LLM stub，避免真实 LLM/网络噪声污染编排层数据。

### create_file 收口

原逻辑中，`create_file` 在 `content` 为空时会进入动态代码生成：

```ts
Boolean(stepAny.needsCodeGeneration || !params.content)
```

这会让规则 planner 产出的空 content 在 benchmark 与非真实生成场景中误入 LLM 链路，导致 `prepare_tool_params` 出现 200ms+ 的不可控耗时。

新逻辑改为：

- `content` 非空：直接写入。
- `codeDescription` 存在或 `needsCodeGeneration=true`：进入代码生成。
- 三者都不存在：参数校验跳过该 step，返回明确 reason。

同时，规则 planner 的 create step 改为传入：

```ts
params: { path: targetPath, codeDescription: task.description }
```

这样语义更明确：create 任务需要生成时由 `codeDescription` 驱动，而不是依赖空字符串触发隐式生成。

### Filesense 安全分类

`filesense_navigate` 和 `filesense_query` 已加入 `READ_TOOLS`。这解决了非交互执行时 Filesense 因 unknown tool 触发 approval、再被 executor 按非致命错误跳过的问题。

## 复测结果

使用命令：

```bash
RUNS=5 node benchmarks/frontagent-flow-benchmark.mjs
```

结果摘要：

| 场景 | total avg | total median | execute avg | execute median | 关键变化 |
| --- | ---: | ---: | ---: | ---: | --- |
| query-explicit-file | 0.33ms | 0.17ms | 0.24ms | 0.13ms | 单文件直达，无 Filesense |
| query-structure | 2.01ms | 0.93ms | 1.96ms | 0.90ms | Filesense 正常执行 |
| create-component | 0.70ms | 0.54ms | 0.60ms | 0.44ms | 从 261.78ms 降到亚毫秒级 |
| debug-structure | 0.62ms | 0.60ms | 0.59ms | 0.58ms | Filesense 导航保持轻量 |
| refactor-multi-file | 0.41ms | 0.40ms | 0.36ms | 0.33ms | 多文件读写保持轻量 |

create 场景优化前后对比：

| 指标 | 优化前 | 优化后 | 变化 |
| --- | ---: | ---: | ---: |
| total avg | 261.78ms | 0.70ms | 约 374x 更快 |
| execute avg | 261.41ms | 0.60ms | 约 436x 更快 |
| create_file `prepare_tool_params` | 约 264ms | 0.04ms | 误入真实生成链路的问题被收口 |

> 注：优化后 benchmark 使用 fast LLM stub，用于衡量 FrontAgent 编排链路，不代表真实 LLM 代码生成耗时。真实生成场景仍会在 `prepare_tool_params` 中体现 LLM 耗时，但现在 trace 可以明确区分“编排成本”和“生成成本”。

## 当前结论

本轮优化把此前 create 场景的异常耗时定位并收口：主要问题不是 Filesense，也不是 Planner，而是规则 create step 用空 content 隐式触发动态生成，导致 `prepare_tool_params` 被真实 LLM 路径污染。

落地后，FrontAgent 已具备后续持续优化所需的基础能力：

1. 可以通过 trace 解释每个 step 的阶段耗时。
2. 可以通过入仓 benchmark 复现全流程编排成本。
3. Filesense read-only 工具在非交互执行中不会再被误跳过。
4. create_file 参数语义更清晰，避免空 content 触发隐式生成。

## 真实 LLM 复测结果

### 测试条件

- Provider：`anthropic`
- Base URL：内部模型网关
- Model：`gpt-5.5`
- API Key：仅通过本地环境变量注入，未写入仓库或文档。
- Benchmark 根目录：`/tmp/frontagent-flow-bench-workspace`
- 每轮测试前：重新创建 fixture，并删除 `<bench-root>/.frontagent/`。
- 时间单位：ms，来自 Node `performance.now()`。

### Benchmark 模式补充

`benchmarks/frontagent-flow-benchmark.mjs` 现在额外支持：

- `BENCH_MODE=realCreate`：仅运行 create-component，适合真实模型小样本测试。
- `BENCH_LLM=real`：Planner 仍为规则模式，Executor 动态代码生成走真实 `LLMService`。
- `BENCH_LLM=real-full`：Planner 与 Executor 都走真实 `LLMService`。
- `BENCH_USE_LLM_PLANNER=1`：在任意模式下单独启用真实 LLM Planner。
- `BENCH_CLEAR_CACHE=0`：关闭每轮 `.frontagent/` 缓存清理；默认每轮清理。

### 规则 Planner + 真实 Executor LLM

命令形态：

```bash
BENCH_MODE=local BENCH_LLM=real RUNS=3 node benchmarks/frontagent-flow-benchmark.mjs
```

该模式用于隔离“FrontAgent 编排 + Executor 真实代码生成”的耗时，Planner 不调用模型。

| 场景 | cache clear avg | plan avg | execute avg | total avg | Filesense avg | create_file prepare avg | 结论 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| query-explicit-file | 0.03 | 0.15 | 0.30 | 0.48 | - | - | 单文件直读，端到端仍为亚毫秒级 |
| query-structure | 0.27 | 0.06 | 2.87 | 3.20 | 2.76 | - | 主要成本来自轻量 Filesense 导航 |
| create-component | 0.05 | 0.62 | 17423.36 | 17424.03 | 0.87 | 17417.43 | 真实代码生成占绝对主导 |
| debug-structure | 0.07 | 0.24 | 2.42 | 2.72 | 2.35 | - | Filesense 导航仍稳定在毫秒级 |
| refactor-multi-file | 0.10 | 0.12 | 0.86 | 1.08 | 0.34 | - | 当前规则 refactor 未触发真实 LLM 修改生成 |

关键观察：

- Filesense 优化仍有效：结构/调试场景中 `filesense_navigate` 平均约 `2.35~2.76ms`，create 场景约 `0.87ms`。
- `create-component` 的端到端 `17.4s` 基本全部落在 `create_file.prepare_tool_params`，即真实模型生成代码阶段。
- Planner 规则路径不是瓶颈：所有场景 `plan avg < 1ms`。

### 真实 Planner + 真实 Executor LLM

命令形态：

```bash
BENCH_MODE=realCreate BENCH_LLM=real-full RUNS=3 node benchmarks/frontagent-flow-benchmark.mjs
```

该模式用于验证“真实 Planner 生成计划”的端到端影响。

| 场景 | cache clear avg | plan avg | execute avg | total avg | step avg | 结论 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| create-component | 0.31 | 82109.17 | 15.76 | 82125.24 | 17.7 | 真实 Planner 一次结构化计划生成约 82s，远高于执行编排成本 |

本组样本中真实 Planner 生成了约 `17.7` 个 step，但多数工具未在本地 benchmark MCP stub 中注册或被安全策略跳过，因此该组主要用于衡量 Planner 模型调用与计划膨胀风险，不适合直接代表完整生产执行。

### 更新后的性能判断

1. **编排层已经不是主要瓶颈**：stub 模式下多数场景在毫秒内完成。
2. **真实 Executor 代码生成是 create 类任务主耗时**：`create_file.prepare_tool_params` 平均约 `17.4s`。
3. **真实 Planner 成本更高且可能产生过长计划**：`create-component` 真实规划平均约 `82.1s`，并生成约 `17.7` 个 step。
4. **Filesense 优化结论成立**：真实 LLM 测试中 Filesense 仍保持低毫秒级，不再是主瓶颈。

下一阶段优化应优先：

- 默认保持规则 Planner + 必要时局部 LLM，而不是全量 LLM Planner。
- 对 create/modify 的模型调用做 prompt 压缩、上下文裁剪和 streaming/timeout 观测。
- 为真实 Planner 增加 step 上限、工具白名单和计划瘦身策略。

## 真实 Agent.execute 全链路复测结果

### 为什么补测

前面的 `benchmarks/frontagent-flow-benchmark.mjs` 是 **Planner/Executor 层切片 benchmark**：它直接调用 `Planner.plan()` + `Executor.executeSteps()`，适合定位编排、Filesense 与 `create_file` 生成阶段，但不覆盖真实入口 `Agent.execute()` 的启动链路。

真实 `fa run` / runtime 调用会经过 `runFrontAgentTask(...) -> Agent.execute(...)`，规划前还包含：

1. 跨会话记忆初始化/预加载。
2. 项目递归预扫描。
3. 开发服务器端口检测。
4. RAG/知识库检索。
5. Planner。
6. Executor。
7. 最终回答/结果汇总。
8. 记忆持久化与运行上下文清理。

因此新增真实入口 benchmark：

```text
benchmarks/frontagent-agent-flow-benchmark.mjs
```

新增命令：

```bash
pnpm bench:agent-flow
pnpm bench:agent-flow:smoke
```

该脚本直接调用 `runFrontAgentTask(...)`，监听 `AgentEvent` / `status_update`，把真实运行阶段归档到：

| 阶段 | 来源 | 含义 |
| --- | --- | --- |
| `initialize_task` | `status_update: 初始化任务` | 创建 task 与运行上下文 |
| `memory_preload` | `status_update: 加载跨会话记忆` | `memoryStore.resetSession()` + `preloadMemory()` |
| `project_prescan` | `status_update: 扫描项目结构` | 递归 `list_directory` + 关键配置预读取 |
| `dev_server_detect` | `status_update: 检测开发服务器端口` | 从预读配置推断 dev server port |
| `rag_retrieve` | `status_update: 检索知识库` | `retrieveRagContext(...)` 知识库检索 |
| `planner` | `planning_started/planning_completed` + status | 生成执行计划 |
| `executor` | `status_update: 执行工具步骤` | 执行计划 steps、MCP tools、安全检查、幻觉防控 |
| `final_output` | `status_update: 生成最终回答/汇总执行结果` | query 回答合成或执行结果摘要 |
| `memory_persist` | `status_update: 持久化运行记忆` | 写入跨会话记忆 |
| `context_cleanup` | `status_update: 清理运行上下文` | 清理 task runtime context |
| `browser_cleanup` | runtime finally | 关闭浏览器资源 |
| `runtime_cleanup` | runtime finally | 运行收尾 |

### 真实入口 Query 场景：规则 Planner + 真实最终回答 LLM

命令形态：

```bash
BENCH_MODE=query RUNS=3 BENCH_LLM=real \
  BENCH_DISABLE_RAG_SEMANTIC=1 \
  BENCH_DISABLE_RAG_RERANKER=1 \
  BENCH_DISABLE_RAG_QUERY_REWRITE=1 \
  node benchmarks/frontagent-agent-flow-benchmark.mjs
```

> API Key 仍仅从本地环境变量读取；结果文件位于 `/tmp/frontagent-agent-flow-real-query-runs3.json`，未写入密钥。

场景：`query-structure`（“梳理这个项目的目录结构和入口。”）

| 阶段 | avg ms | 说明 |
| --- | ---: | --- |
| cache clear | 0.10 | 每轮删除 `<bench-root>/.frontagent/` |
| `memory_preload` | 0.08 | 当前 fixture 基本无可复用记忆，成本极低 |
| `project_prescan` | 1.29 | 递归扫描 fixture + 预读 `package.json` / `vite.config.ts` |
| `dev_server_detect` | 0.05 | 从预读配置识别端口 |
| `rag_retrieve` | 13848.93 | 知识库 keyword-only 检索，平均 5 条命中 |
| `planner` | 0.23 | 规则 Planner，未调用真实 Planner LLM |
| `executor` | 12.02 | 执行 `filesense_navigate` + `search_code` |
| `final_output` | 28260.22 | 真实 LLM 合成最终 query 回答 |
| `memory_persist` | 3.26 | 持久化运行记忆 |
| `context_cleanup` | 0.11 | 清理上下文 |
| total | 42144.71 | cache clear + `Agent.execute()` 全链路 |

工具级结果：

| 工具 | count avg | elapsed avg ms |
| --- | ---: | ---: |
| `filesense_navigate` | 1 | 3.16 |
| `search_code` | 1 | 8.62 |

结论：在真实入口 query 场景下，**最大成本不是 Filesense，也不是项目预扫描，而是 RAG/知识库检索与最终回答 LLM 合成**。其中知识库检索约 `13.85s`，最终回答合成约 `28.26s`。

### 真实入口 Create 场景：真实 Planner + 真实 Executor

命令形态：

```bash
BENCH_MODE=create RUNS=1 BENCH_LLM=real \
  BENCH_DISABLE_RAG_SEMANTIC=1 \
  BENCH_DISABLE_RAG_RERANKER=1 \
  BENCH_DISABLE_RAG_QUERY_REWRITE=1 \
  node benchmarks/frontagent-agent-flow-benchmark.mjs
```

> 结果文件：`/tmp/frontagent-agent-flow-real-create-run1.json`。该样本是真实入口压力样本，包含真实 Planner、真实代码生成/修改、approval 失败恢复与浏览器工具失败路径。

场景：`create-component`（“新增一个 Card 组件到 src/components，保持实现简单。”）

| 阶段 | ms | 说明 |
| --- | ---: | --- |
| cache clear | 约 0.07 | 每轮清理 `.frontagent/` |
| `memory_preload` | 0.05 | 记忆预加载 |
| `project_prescan` | 1.53 | 递归项目预扫描 |
| `dev_server_detect` | 0.09 | dev server 端口检测 |
| `rag_retrieve` | 12284.37 | 知识库检索 |
| `planner` | 51074.12 | 真实 Planner 生成 15 个 step |
| `executor` | 134997.82 | 执行、失败恢复、真实代码生成/修改、浏览器工具失败 |
| `final_output` | 0.16 | create 任务仅汇总，不走 query 回答合成 |
| `memory_persist` | 4.81 | 持久化运行记忆 |
| total | 198382.99 | 约 198.38s |

计划动作序列：

```text
filesense_navigate, read_file, read_file, run_command, create_file,
run_command, run_command, run_command, browser_navigate, browser_screenshot,
run_command, run_command, run_command, run_command, run_command
```

工具级观测：

| 工具 | count | avg ms | 说明 |
| --- | ---: | ---: | --- |
| `filesense_navigate` | 1 | 10.49 | 仍为低毫秒级 |
| `read_file` | 11 | 1.82 | 文件读取不是瓶颈 |
| `run_command` | 6 | 1.16 | 非交互 approval 要求导致快速失败 |
| `create_file` | 2 | 3627.53 | 首次真实生成约 7.25s，后续因文件已存在失败 |
| `apply_patch` | 4 | 7400.98 | 多次真实修改生成，最高约 11.95s |
| `browser_navigate` | 1 | 191.86 | Playwright 浏览器二进制缺失导致失败 |

本轮 create 样本最终失败原因：本机 Playwright Chromium headless shell 缺失，`browser_navigate` 无法启动浏览器。这是环境依赖问题，不影响前序阶段耗时判断，但说明真实 Planner 当前会把 create 任务扩展到浏览器验证链路，带来额外环境耦合。

### 新发现与修正

1. **之前“全流程”表述需要收口**：`frontagent-flow-benchmark.mjs` 是 Planner/Executor 切片，不是完整 `Agent.execute()`。现在文档中明确区分两类 benchmark。
2. **RAG/知识库检索必须作为一等阶段**：真实入口 query 场景中 `rag_retrieve` 平均约 `13.85s`，create 样本约 `12.28s`。这是用户指出的遗漏项，已补齐。
3. **最终回答合成是 query 任务主耗时**：query 场景 `final_output` 平均约 `28.26s`，超过 RAG 检索。
4. **真实 Planner 仍是 create 类任务高风险瓶颈**：create 样本 Planner 约 `51.07s`，且生成 15 个 step，包括浏览器验证和多个 shell 命令。
5. **Executor create/modify 的真实代码生成仍明显**：`create_file` / `apply_patch` 会触发真实 LLM 生成，单次约数秒到十几秒。
6. **Filesense 结论继续成立**：真实入口下 `filesense_navigate` 约 `3.16ms`（query）/ `10.49ms`（create），不是主瓶颈。
7. **运行时集成修复**：`runtime-node` 的 `FileMCPClient` 现在显式支持 Filesense tools，并且 `registerFileTools()` 注册 `filesense_navigate` 等工具。否则真实入口下 Planner 生成的 Filesense step 会因为没有 MCP client 映射而被跳过。

### 下一步优化优先级

基于真实入口数据，优化优先级应调整为：

1. **RAG 快路径**：缓存可用时避免每次 query 都做重检索；对 keyword-only、本地缓存、空命中/低相关性做早停。
2. **Query 最终回答压缩**：限制证据拼接长度，减少 `generateQueryAnswer()` prompt 与输出 token；必要时支持非 LLM 摘要 fallback。
3. **Planner 瘦身**：create 默认不启用浏览器验证/多轮 shell 验证，除非任务明确要求；限制 step 数与高风险工具。
4. **真实代码生成观测继续下钻**：把 `create_file.prepare_tool_params` 与 `apply_patch.prepare_tool_params` 的真实 LLM 输入 token、输出 token、首包耗时纳入 trace。
5. **环境依赖降级**：浏览器二进制缺失时，Planner/Executor 应降级为静态验证，而不是让 create 任务最终失败。
