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

