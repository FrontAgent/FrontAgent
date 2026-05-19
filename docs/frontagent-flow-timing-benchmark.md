# FrontAgent 整体流程耗时定量测试

## 目的

在 `filesense_navigate` 优化之后，对 FrontAgent 的整体执行链路做一次端到端微基准，记录各个主要环节耗时，便于后续继续优化时有基线可对比。

本测试关注 FrontAgent 内部流程开销：

```text
任务输入 → Planner 生成计划 → 阶段注入 → Executor 执行步骤 → MCP Tool 调用
```

为避免外部 LLM、真实浏览器、真实 shell、网络抖动影响，本次测试使用规则 planner（`useLLM=false`）和本地 stub MCP client；它适合衡量 FrontAgent 编排层、planner 注入层、executor 调度层、Filesense 导航层的基础成本，不代表真实模型生成耗时。

## 测试环境与方法

- 仓库：`FrontAgent-app`
- 提交基础：
  - `da79289 优化 filesense 按需导航能力`
  - `0318adb 记录 filesense 导航优化基准数据`
- Fixture：临时前端项目 `/tmp/frontagent-flow-bench-workspace`
  - `package.json`
  - `README.md`
  - `src/main.tsx`
  - `src/components/Button.tsx`
  - `src/hooks/useFoo.ts`
  - `src/services/foo.ts`
- 每个场景重复运行：10 次
- 统计项：平均值、最小值、中位数、最大值
- 计时口径：
  - `planMs`：`Planner.plan(...)` 总耗时，包含 rule-based planning 与 phase injection。
  - `executeMs`：`Executor.executeSteps(...)` 总耗时。
  - `totalMs`：`planMs + executeMs`。
  - `sampleToolTimings`：最后一次运行中各 MCP tool stub 的耗时。

## 场景结果总览

| 场景 | 步骤数 | plan 平均 | execute 平均 | total 平均 | 主要步骤 |
| --- | ---: | ---: | ---: | ---: | --- |
| query-explicit-file | 1 | 0.06 ms | 0.17 ms | 0.23 ms | `read_file` |
| query-structure | 2 | 0.02 ms | 1.22 ms | 1.24 ms | `filesense_navigate` + `search_code` |
| create-component | 3 | 0.38 ms | 261.41 ms | 261.78 ms | `filesense_navigate` + `read_file` + `create_file` |
| debug-structure | 2 | 0.17 ms | 3.35 ms | 3.52 ms | `filesense_navigate` + `search_code` |
| refactor-multi-file | 5 | 0.07 ms | 0.74 ms | 0.81 ms | `filesense_navigate` + `get_ast/read_file/apply_patch` x2 |

> `create-component` 的 execute 平均明显更高，主要不是 Filesense，而是当前规则计划中的 `create_file` 步骤触发了额外的执行器处理/校验/写入流程；这在后续可以继续拆分 profiling。

## 各场景环节明细

### 1. 明确文件查询：`query-explicit-file`

任务：读取 `README.md` 并总结。

| 指标 | 平均 | 最小 | 中位数 | 最大 |
| --- | ---: | ---: | ---: | ---: |
| planMs | 0.06 | 0.01 | 0.02 | 0.28 |
| executeMs | 0.17 | 0.07 | 0.11 | 0.54 |
| totalMs | 0.23 | 0.09 | 0.16 | 0.82 |

步骤：

```text
read_file
```

结论：明确单文件 query 没有注入 `filesense_navigate`，符合轻量策略。

### 2. 结构查询：`query-structure`

任务：梳理项目目录结构和入口。

| 指标 | 平均 | 最小 | 中位数 | 最大 |
| --- | ---: | ---: | ---: | ---: |
| planMs | 0.02 | 0.01 | 0.01 | 0.05 |
| executeMs | 1.22 | 0.53 | 0.62 | 6.66 |
| totalMs | 1.24 | 0.54 | 0.63 | 6.71 |

步骤：

```text
filesense_navigate(intent=understand_structure, paths=['.'], depth=2, maxEntries=250)
search_code
```

最后一次运行 tool 耗时：

| tool | 耗时 |
| --- | ---: |
| filesense_navigate | 0.58 ms |
| search_code | 0.0001 ms |

结论：结构类 query 会主动注入 Filesense，但耗时仍在毫秒级。

### 3. 新建组件：`create-component`

任务：新增一个 Card 组件到 `src/components`。

| 指标 | 平均 | 最小 | 中位数 | 最大 |
| --- | ---: | ---: | ---: | ---: |
| planMs | 0.38 | 0.16 | 0.26 | 1.28 |
| executeMs | 261.41 | 183.99 | 203.59 | 703.43 |
| totalMs | 261.78 | 184.31 | 203.80 | 703.60 |

步骤：

```text
filesense_navigate(intent=prepare_create, paths=['src'], depth=1, maxEntries=180)
read_file
create_file
```

最后一次运行 tool 耗时：

| tool | 耗时 |
| --- | ---: |
| filesense_navigate | 1.35 ms |

结论：Filesense 导航只占极小比例；该场景主要耗时来自 `create_file` 执行链路。后续若要优化 create 类任务，应继续拆分 `create_file` 前置校验、动态内容生成和写入路径。

### 4. Debug 结构理解：`debug-structure`

任务：排查页面白屏问题，需要理解相关模块。

| 指标 | 平均 | 最小 | 中位数 | 最大 |
| --- | ---: | ---: | ---: | ---: |
| planMs | 0.17 | 0.05 | 0.12 | 0.62 |
| executeMs | 3.35 | 1.31 | 2.44 | 7.96 |
| totalMs | 3.52 | 1.36 | 2.57 | 8.58 |

步骤：

```text
filesense_navigate(intent=understand_structure, paths=['.'], depth=2, maxEntries=300)
search_code
```

最后一次运行 tool 耗时：

| tool | 耗时 |
| --- | ---: |
| filesense_navigate | 1.27 ms |
| search_code | 0.0005 ms |

结论：debug 类任务的 Filesense 导航成本可控，主要开销仍是 executor 调度与安全检查固定成本。

### 5. 多文件重构：`refactor-multi-file`

任务：重构 hooks 和 service 调用。

| 指标 | 平均 | 最小 | 中位数 | 最大 |
| --- | ---: | ---: | ---: | ---: |
| planMs | 0.07 | 0.03 | 0.05 | 0.22 |
| executeMs | 0.74 | 0.49 | 0.63 | 1.83 |
| totalMs | 0.81 | 0.52 | 0.68 | 2.05 |

步骤：

```text
filesense_navigate(intent=prepare_refactor, paths=['src/hooks', 'src/services'], depth=2, maxEntries=500)
get_ast(src/hooks/useFoo.ts)
apply_patch(src/hooks/useFoo.ts)
get_ast(src/services/foo.ts)
apply_patch(src/services/foo.ts)
```

最后一次运行 tool 耗时：

| tool | 耗时 |
| --- | ---: |
| filesense_navigate | 0.25 ms |
| get_ast #1 | 0.0003 ms |
| read_file #1（apply_patch 内部前置读取） | 0.096 ms |
| apply_patch #1 | 0.0002 ms |
| get_ast #2 | 0.0003 ms |
| read_file #2（apply_patch 内部前置读取） | 0.095 ms |
| apply_patch #2 | 0.0002 ms |

结论：局部路径导航非常轻；多文件任务中 `filesense_navigate` 成本低于普通文件读取。

## 流程观察

1. **Planner 本身很轻**
   - 规则 planner + phase injection 通常低于 0.5 ms。
   - 当前场景里 plan 平均最大为 `create-component` 的 0.38 ms。

2. **Filesense 导航处于毫秒级或亚毫秒级**
   - 根目录结构导航：约 0.58–1.27 ms（最后一次样本）。
   - 局部路径导航：约 0.25 ms。
   - 相比此前单独 Filesense 基准中的旧 `sync + summarize` 平均 101.09 ms，整体流程里使用 `navigate` 后，Filesense 不再是主要瓶颈。

3. **Executor 调度/安全检查是基础固定成本**
   - 即使工具是 stub，Executor 仍会执行参数校验、安全评估、action skill 处理、前后置验证。
   - read/query/refactor 场景总成本通常在 0.2–4 ms 级别。

4. **create 类任务需要后续专项 profiling**
   - `create-component` 的 execute 平均 261 ms，远高于其他场景。
   - 样本中 Filesense 仅 1.35 ms，说明瓶颈不在 Filesense。
   - 建议下一步拆分 `create_file` 的动态代码生成、校验、写入、验证耗时。

## 真实模型细粒度补测（2026-05-19）

在新增 executor trace、`toolDurationMs` 和 `prepareToolParams` 子阶段计时后，使用真实模型链路补跑一次端到端观测，用于定位真实任务下的主要耗时来源。

### 测试环境与口径

- 运行命令：`BENCH_MODE=full RUNS=1 BENCH_LLM=real node benchmarks/frontagent-agent-flow-benchmark.mjs`
- Provider：`anthropic`
- Model：`gpt-5.5`
- Base URL：内部 Anthropic 兼容网关
- Fixture：`/tmp/frontagent-agent-flow-bench-workspace`
- 重复次数：1 次
- 说明：本次是真实模型链路的单次观测，主要用于细粒度定位；真实 LLM、RAG 检索和最终回答生成波动较大，不作为稳定性能阈值。

### 全链路阶段耗时

| 场景 | 成功 | 步骤数 | total | rag_retrieve | planner | executor | final_output |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| query-identity | 是 | 1 | 128806 ms | 125512 ms | 0.4 ms | 7.3 ms | 3262 ms |
| query-structure | 是 | 2 | 56191 ms | 30929 ms | 0.2 ms | 6.3 ms | 25241 ms |
| create-component | 否 | 16 | 319456 ms | 27089 ms | 43124 ms | 249224 ms | 0 ms |
| create-file-no-codegen | 否 | 8 | 136303 ms | 22267 ms | 22113 ms | 91903 ms | 0 ms |
| create-file-with-codegen | 否 | 16 | 302014 ms | 22839 ms | 48741 ms | 230416 ms | 0 ms |

结论：

1. query 场景的 executor 仍只有毫秒级，主要耗时在 `rag_retrieve` 和 `final_output`。
2. create 场景的主要耗时在 `planner` 与 `executor`，其中 executor 内部又集中在代码生成型 `prepareToolParams`。
3. create 场景本次失败，说明真实模型链路仍会触发多轮恢复/修补；这些失败样本对定位耗时瓶颈仍有价值，但不代表成功路径耗时。

### Executor 工具级耗时拆分

#### query-identity

| tool | totalMs | toolDurationMs | 主要阶段 |
| --- | ---: | ---: | --- |
| search_code | 6.5 ms | 6.2 ms | `call_tool` 6.2 ms |

#### query-structure

| tool | totalMs | toolDurationMs | 主要阶段 |
| --- | ---: | ---: | --- |
| search_code | 4.0 ms | 3.9 ms | `call_tool` 3.9 ms |
| filesense_navigate | 2.2 ms | 2.1 ms | `call_tool` 2.1 ms |

#### create-component

| tool | totalMs | toolDurationMs | prepare_tool_params | call_tool | 子阶段主要耗时 |
| --- | ---: | ---: | ---: | ---: | --- |
| read_file | 0.7 ms | 0.5 ms | 0.0 ms | 0.5 ms | - |
| run_command | 0.3 ms | 0.0 ms | 0.0 ms | 0.2 ms | - |
| list_directory | 0.8 ms | 1.1 ms | 0.0 ms | 1.3 ms | - |
| create_file | 3150.8 ms | 2.0 ms | 6294.6 ms | 2.9 ms | `llm_code_generation` 6293.6 ms |
| apply_patch | 5094.3 ms | 1.8 ms | 5728.9 ms | 2.1 ms | `llm_code_generation` 5728.6 ms |
| browser_navigate | 61.1 ms | 0.0 ms | 0.0 ms | 61.0 ms | - |
| browser_screenshot | 1.5 ms | 0.0 ms | 0.0 ms | 1.4 ms | - |
| filesense_navigate | 3.6 ms | 3.4 ms | 0.0 ms | 3.5 ms | - |

#### create-file-no-codegen

| tool | totalMs | toolDurationMs | prepare_tool_params | call_tool | 子阶段主要耗时 |
| --- | ---: | ---: | ---: | ---: | --- |
| run_command | 0.1 ms | 0.0 ms | 0.0 ms | 0.1 ms | - |
| list_directory | 0.4 ms | 0.4 ms | 0.0 ms | 0.4 ms | - |
| read_file | 1.0 ms | 1.0 ms | 0.0 ms | 1.0 ms | - |
| create_file | 581.3 ms | 2.6 ms | 1158.9 ms | 3.0 ms | `llm_code_generation` 1158.8 ms |
| apply_patch | 1516.5 ms | 1.7 ms | 1514.6 ms | 1.8 ms | `llm_code_generation` 1514.5 ms |

> 虽然场景名是 `create-file-no-codegen`，真实模型规划仍生成了需要代码生成/修补的步骤，因此仍出现 `llm_code_generation`。这说明“无 codegen”需要在更底层的 executor benchmark 中构造确定性步骤，而不是依赖真实 planner 自然生成。

#### create-file-with-codegen

| tool | totalMs | toolDurationMs | prepare_tool_params | call_tool | 子阶段主要耗时 |
| --- | ---: | ---: | ---: | ---: | --- |
| read_file | 1.0 ms | 0.7 ms | 0.0 ms | 0.7 ms | - |
| run_command | 0.2 ms | 0.0 ms | 0.0 ms | 0.1 ms | - |
| list_directory | 0.2 ms | 0.2 ms | 0.0 ms | 0.2 ms | - |
| create_file | 3943.5 ms | 3.5 ms | 7880.6 ms | 3.7 ms | `llm_code_generation` 7880.3 ms |
| apply_patch | 5694.4 ms | 3.0 ms | 5691.0 ms | 3.1 ms | `llm_code_generation` 5690.9 ms |
| browser_navigate | 6.9 ms | 0.0 ms | 0.0 ms | 6.9 ms | - |
| browser_screenshot | 7.0 ms | 0.0 ms | 0.0 ms | 7.0 ms | - |
| filesense_navigate | 8.5 ms | 8.2 ms | 0.0 ms | 8.4 ms | - |

### 关键发现

1. **Filesense 仍不是瓶颈**
   - query 场景中 `filesense_navigate` 约 2.2 ms。
   - create 场景中 `filesense_navigate` 约 3.6–8.5 ms。
   - 相比数十秒到数分钟级的真实任务耗时，Filesense 可忽略。

2. **MCP 工具本体很快，慢在 executor 的代码生成准备阶段**
   - `create_file` 的 `toolDurationMs` 只有约 2–3.5 ms。
   - `apply_patch` 的 `toolDurationMs` 只有约 1.7–3.0 ms。
   - 真正耗时的是 `prepare_tool_params`，并且子阶段几乎全部落在 `llm_code_generation`。

3. **上下文构造与记忆召回不是主要开销**
   - `build_context` 通常约 0.0–0.1 ms。
   - `memory_recall` 通常约 0.0–0.2 ms。
   - `resolve_modules` 通常约 0.0–0.2 ms。
   - 因此不应优先优化这些本地逻辑。

4. **真实 create 任务会放大 planner 和 recovery 成本**
   - `create-component` planner 约 43.1 s，executor 约 249.2 s。
   - `create-file-with-codegen` planner 约 48.7 s，executor 约 230.4 s。
   - 多次 `apply_patch` 说明真实路径存在反复修补/恢复，后续应单独统计 recovery attempt 数和每次 recovery 的 LLM 耗时。

5. **当前 trace 聚合对多次同 tool 有解释偏差**
   - 表中 `totalMs` 是同 tool 多次调用的平均值。
   - `prepare_tool_params` 子阶段主要来自需要 codegen 的调用；同一 tool 内同时存在 codegen 和非 codegen 调用时，平均值会出现不直观的差异。
   - 后续 benchmark 应按 `action + tool + needsCodeGeneration` 或按 step 明细输出，避免 codegen/non-codegen 混合聚合。

### 下一步优化方向

1. **优先优化代码生成 LLM 调用**
   - `create_file` / `apply_patch` 的主要耗时是 `llm_code_generation`。
   - 可评估缩短 prompt、减少上下文、复用 plan 阶段结构化结果、或对确定性小文件使用模板/规则生成。

2. **拆分 recovery 计时**
   - 真实 create 场景耗时主要来自多轮修补。
   - 建议新增 recovery trace：`recovery_analyze_errors`、`recovery_generate_steps`、`recovery_execute_steps`、`recovery_validate`。

3. **修正 benchmark 聚合维度**
   - 当前按 tool 聚合不够精确。
   - 建议输出 step 级明细，并额外按 `tool + action + needsCodeGeneration` 分组。

4. **RAG/query 链路单独优化**
   - query 场景主要慢在 `rag_retrieve` 和 `final_output`。
   - 需要进一步拆分 RAG query rewrite、检索、排序、格式化和最终回答生成。

## 后续建议

- 给 Executor 增加可选 trace hook，记录：
  - `validateBeforeExecution`
  - `prepareToolParams`
  - `callTool`
  - `validateAfterExecution`
  - `recovery/rollback`
- 给 MCP 调用结果统一记录 `toolDurationMs`，避免只能通过外部 stub 估算。
- 对 create/modify/refactor 单独做真实任务基准，区分：
  - 无 LLM stub 模式
  - 真实 LLM 模式
  - 真实文件 MCP 模式
- 在 CI 中保留一个轻量 benchmark smoke，防止后续 Filesense 或 planner 注入再次退化为全仓重扫。

