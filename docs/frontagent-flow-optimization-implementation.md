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
