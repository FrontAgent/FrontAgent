# FrontAgent 全流程性能优化技术方案

:::note{type=info}
**__Abstract__**
---
本文基于 FrontAgent 全流程定量测试结果，提出下一阶段性能优化方案。测试显示：Planner 与 Filesense 导航已不再是主要瓶颈，`create-component` 场景平均耗时达到 261.78ms，显著高于 query/refactor/debug 场景。方案将优化重点从“继续压缩 Filesense”转向“建立可观测 Trace、拆解 Executor 固定成本、收口 create_file 执行链路、沉淀轻量 benchmark 守护”，目标是在不牺牲安全与能力的前提下，把 create 类任务的编排开销降低到可解释、可回归、可持续优化的状态。
:::

## 1. 背景与问题定义

FrontAgent 已完成 Filesense 集成优化：旧的全仓 `filesense_sync_and_summarize('.')` 被替换为按需、预算化的 `filesense_navigate`。单独 Filesense 基准显示，根目录轻量导航平均耗时从旧方案的 `101.09ms` 降到 `5.08ms`，明确局部导航降到 `0.25ms`。

在此基础上，进一步做了 FrontAgent 全流程微基准。链路覆盖：

```text
任务输入 → Planner.plan → phase injection → Executor.executeSteps → MCP Tool 调用
```

测试刻意使用 `useLLM=false` 与本地 stub MCP client，目的是排除外部 LLM、网络、浏览器和真实 shell 的干扰，先看 FrontAgent 编排层自身的基础成本。结论比较明确：__**当前主要瓶颈已经从 Filesense 转移到 Executor 内部执行链路，尤其是 create 类任务。**__

## 2. 定量测试结论

### 2.1 场景耗时总览

| 场景 | 步骤数 | plan 平均 | execute 平均 | total 平均 | 主要步骤 |
| --- | ---: | ---: | ---: | ---: | --- |
| query-explicit-file | 1 | 0.06ms | 0.17ms | 0.23ms | `read_file` |
| query-structure | 2 | 0.02ms | 1.22ms | 1.24ms | `filesense_navigate` + `search_code` |
| create-component | 3 | 0.38ms | 261.41ms | 261.78ms | `filesense_navigate` + `read_file` + `create_file` |
| debug-structure | 2 | 0.17ms | 3.35ms | 3.52ms | `filesense_navigate` + `search_code` |
| refactor-multi-file | 5 | 0.07ms | 0.74ms | 0.81ms | `filesense_navigate` + `get_ast/read_file/apply_patch` x2 |

从数据看，Planner 平均耗时均低于 `0.5ms`，没有优化优先级。Filesense 在全流程中的样本耗时约 `0.25ms~1.35ms`，也不是主要矛盾。`create-component` 的 `261.78ms` 与其他场景拉开两个数量级，需要专项拆解。

### 2.2 Filesense 优化后的相对位置

| 项目 | 平均耗时 | 相对旧 Filesense 方案 | 说明 |
| --- | ---: | ---: | --- |
| 旧 `sync + summarize` | 101.09ms | 100% | 全仓扫描并写索引 |
| `navigate root depth=2` | 5.08ms | 5.02% | 根目录轻量导航 |
| `navigate focused depth=1` | 0.25ms | 0.25% | 局部路径导航 |
| 全流程 query-structure | 1.24ms | - | 含 planner/executor/tool stub |
| 全流程 debug-structure | 3.52ms | - | 含 planner/executor/tool stub |

Filesense 当前已经具备两个收益：

1. **默认更轻**：明确单文件 query 不再注入 Filesense。
2. **需要时可控**：结构、debug、refactor 类任务会注入导航，但预算受 `depth / maxEntries / maxBytes / timeoutMs` 限制。

因此下一阶段不建议继续优先改 Filesense 主路径，而应先补齐全流程 profiling 能力。

## 3. 根因假设与待验证点

当前数据能确认“慢在哪里”，但还不能完全确认“为什么慢”。尤其是 `create-component`：

```text
filesense_navigate(intent=prepare_create, paths=['src'], depth=1, maxEntries=180)
read_file
create_file
```

最后一次样本中，`filesense_navigate` 仅约 `1.35ms`，但 execute 平均达到 `261.41ms`。这说明瓶颈大概率出现在 `create_file` 执行链路周边，包括但不限于：

| 假设 | 可能来源 | 验证方式 | 优先级 |
| --- | --- | --- | --- |
| 动态代码生成被错误触发 | `prepareToolParams` / action skill | 给 action skill 打 trace | P0 |
| `create_file` 前后置校验过重 | `validateBeforeExecution` / `validateAfterExecution` | 拆分 executor 阶段耗时 | P0 |
| 安全评估或 approval 流程有固定等待 | `enforceSecurity` / approval handler | 记录安全决策耗时 | P1 |
| 文件写入后触发额外读取/快照 | MCP file / guard / rollback | 记录 tool 内部耗时 | P1 |
| benchmark stub 与真实工具映射不一致 | 测试方式 | 增加真实 MCP file 模式 | P1 |

这里要避免直接拍脑袋优化。__**第一阶段目标不是立刻改快 create_file，而是把 create_file 的 261ms 拆成可归因的分段耗时。**__

## 4. 优化目标

### 4.1 短期目标

| 目标 | 当前值 | 目标值 | 说明 |
| --- | ---: | ---: | --- |
| create-component total 平均耗时 | 261.78ms | 可解释拆分到 5 个阶段 | 先解决不可观测问题 |
| Executor 阶段耗时可观测性 | 无统一 trace | 100% step 覆盖 | 每个 step 输出阶段耗时 |
| Filesense 导航退化检测 | 手工 benchmark | CI smoke 覆盖 | 防止回退到全仓扫描 |
| benchmark 可复现性 | `/tmp` 临时脚本 | repo 内脚本化 | 支持本地/CI 复跑 |

### 4.2 中期目标

| 目标 | 建议目标值 | 说明 |
| --- | ---: | --- |
| create-component total 平均耗时 | < 50ms（不含真实 LLM） | 基于本地 stub MCP 模式 |
| query/refactor/debug 编排开销 | 稳定 < 5ms | 不引入额外全局扫描 |
| Filesense navigate 根目录导航 | 稳定 < 10ms | 中小型项目预算扫描 |
| 单文件 query Filesense 注入率 | 0% | 保持明确路径直达 |

## 5. 技术方案

### 5.1 方案总览

优化分四层推进：

```text
┌────────────────────────────────────────────┐
│ Benchmark Layer：可复现全流程基准           │
├────────────────────────────────────────────┤
│ Trace Layer：Executor 阶段级耗时埋点         │
├────────────────────────────────────────────┤
│ Execution Layer：create_file 链路收口        │
├────────────────────────────────────────────┤
│ Guardrail Layer：CI 性能守护与退化阈值        │
└────────────────────────────────────────────┘
```

推荐按顺序落地。原因是当前 create 场景缺少分段数据，直接改执行逻辑容易把问题藏起来，也可能破坏安全与校验链路。

### 5.2 Benchmark Layer：沉淀可复现基准

将本次 `/tmp/frontagent-flow-benchmark.mjs` 临时脚本沉淀到仓库，例如：

```text
benchmarks/frontagent-flow-benchmark.mjs
benchmarks/fixtures/frontagent-flow-fixture.ts
benchmarks/README.md
```

基准分三档：

| 档位 | 目的 | 是否进 CI | 说明 |
| --- | --- | --- | --- |
| smoke | 防退化 | 是 | 3 个场景，每个 3 次 |
| local | 本地分析 | 否 | 5~8 个场景，每个 10 次 |
| full | 发布前评估 | 可选 | 真实 MCP + 可选真实 LLM |

输出统一 JSON：

```json
{
  "scenario": "create-component",
  "runs": 10,
  "planMs": { "avg": 0.38, "median": 0.26 },
  "executeMs": { "avg": 261.41, "median": 203.59 },
  "steps": [
    {
      "action": "create_file",
      "durationMs": 202,
      "trace": {
        "validateBeforeMs": 0.3,
        "prepareToolParamsMs": 180.0,
        "callToolMs": 1.2,
        "validateAfterMs": 20.5
      }
    }
  ]
}
```

这样后续文档里的数据不再依赖手工复制，避免单位和口径混乱。

### 5.3 Trace Layer：Executor 阶段级耗时埋点

在 `Executor.executeStep` 内增加轻量 trace，不改变默认行为。建议新增配置：

```ts
interface ExecutorConfig {
  trace?: {
    enabled?: boolean;
    onStepTrace?: (trace: StepTrace) => void;
  };
}
```

核心数据结构：

```ts
interface StepTrace {
  taskId: string;
  stepId: string;
  action: string;
  tool: string;
  totalMs: number;
  stages: Array<{
    name:
      | 'validate_params'
      | 'validate_before'
      | 'prepare_tool_params'
      | 'security'
      | 'call_tool'
      | 'validate_after'
      | 'recovery';
    durationMs: number;
    success: boolean;
    error?: string;
  }>;
}
```

需要注意两点：

1. trace 必须是旁路能力，默认关闭。
2. trace 不能吞异常、不能改变原有 success/error/rollback 语义。

这一步完成后，可以直接回答：`create_file` 的 261ms 是耗在动态生成、校验、安全，还是工具调用。

### 5.4 Execution Layer：create_file 链路收口

在 trace 明确瓶颈后，再对 create 路径做定向优化。预期有三类优化点。

#### 5.4.1 避免不必要的动态代码生成

如果 `create_file` 的 `params.content` 已存在，或任务是 benchmark/stub 模式，则不应触发额外 LLM 生成。建议规则：

```text
content 已存在 → 直接写入
content 缺失 + canGenerate=true → 进入生成链路
content 缺失 + canGenerate=false → 返回参数缺失错误
```

这样可以避免 create 类任务在规则 planner 下误入生成路径。

#### 5.4.2 校验分级

当前所有 create/modify 都走相近的前后置校验，会让简单文件创建承担过多成本。建议把校验分为三档：

| 档位 | 适用场景 | 校验内容 |
| --- | --- | --- |
| basic | 普通文本/文档/测试 fixture | 路径合法、文件不存在/可覆盖策略 |
| syntax | TS/JS/JSON 等代码文件 | basic + 语法校验 |
| project | 影响项目构建的核心文件 | syntax + lint/typecheck/依赖检查 |

默认 create_file 使用 `basic` 或由 planner 指定 `validationLevel`。只有明确需要时才升级到 `syntax/project`。

#### 5.4.3 文件操作与上下文读取去重

refactor 样本显示 `apply_patch` 内部会出现额外 `read_file` 前置读取，这本身合理，但可以通过 step context 缓存降低重复读取：

```text
同一 task 内相同 path 的 read_file 结果 → 放入 ExecutorCollectedContext
apply_patch 前置读取 → 优先复用 context.files
写入/patch 成功 → 失效对应 path 缓存
```

这不会改变语义，但能减少多文件任务中的重复 I/O 与重复 MCP 调用。

### 5.5 Guardrail Layer：性能守护

新增 CI smoke benchmark，目标不是精确性能测试，而是防止明显退化。

建议阈值：

| 指标 | 阈值 | 说明 |
| --- | ---: | --- |
| query-explicit-file total median | < 5ms | 明确单文件任务不能走重路径 |
| query-structure total median | < 20ms | 允许 Filesense 轻量导航 |
| refactor-multi-file total median | < 20ms | 防止重复全仓扫描 |
| Filesense root navigate median | < 20ms | 防止回退到 sync+summarize |
| 单文件 query filesense 调用次数 | 0 | 策略正确性守护 |

CI 上绝对耗时会波动，因此阈值要宽松；更重要的是守住“是否注入重工具”和“是否出现数量级退化”。

## 6. 落地计划

### Phase 1：补齐可观测性（P0）

| 任务 | 产出 | 验收 |
| --- | --- | --- |
| 将 benchmark 脚本入仓 | `benchmarks/frontagent-flow-benchmark.mjs` | 本地可一键运行 |
| Executor 增加 trace hook | `StepTrace` 数据结构与回调 | 不开启 trace 时行为零变化 |
| 文档自动引用 benchmark JSON | 更新 `docs/frontagent-flow-timing-benchmark.md` | 数据口径一致 |

### Phase 2：定位 create_file 瓶颈（P0）

| 任务 | 产出 | 验收 |
| --- | --- | --- |
| 复跑 create-component trace | JSON trace 结果 | 能拆出 top stage |
| 对比 stub MCP / real MCP | 两组数据 | 判断瓶颈在 executor 还是 MCP |
| 输出专项分析 | 文档小节 | 明确下一步修改点 |

### Phase 3：定向优化 create/modify 链路（P1）

| 任务 | 产出 | 验收 |
| --- | --- | --- |
| content 已存在时跳过生成 | action skill 调整 | create stub 场景明显下降 |
| 校验分级 | `validationLevel` | basic create 不触发重校验 |
| 文件读取缓存 | context cache | refactor 重复读取减少 |

### Phase 4：CI 守护（P1）

| 任务 | 产出 | 验收 |
| --- | --- | --- |
| benchmark smoke 命令 | `pnpm bench:flow:smoke` | CI 可运行 |
| 阈值检查 | benchmark threshold config | 超阈值失败 |
| 趋势记录 | JSON artifact | 后续可看趋势 |

## 7. 风险与规避

| 风险 | 影响 | 规避策略 |
| --- | --- | --- |
| trace 增加运行时开销 | 影响正常任务 | 默认关闭，开启时只做 `performance.now()` |
| 优化 create_file 破坏安全校验 | 引入危险写入 | 安全检查不可跳过，只允许校验分级 |
| benchmark 受机器状态影响 | 数据波动 | 使用 median + 宽松阈值 + 调用次数守护 |
| 缓存导致读取旧内容 | 修改后上下文不一致 | 写入/patch 成功后失效 path 缓存 |
| 为了性能绕过 LLM 能力 | 功能退化 | 仅在 content 已存在或显式关闭生成时跳过 |

## 8. 验收标准

方案落地后，至少满足以下标准：

1. `pnpm bench:flow:local` 能稳定输出 JSON 与 Markdown 摘要。
2. `create-component` 的 `261ms` 能被拆分到具体阶段，且 top stage 占比清晰。
3. 明确单文件 query 不注入 Filesense，调用次数为 0。
4. 结构/debug/refactor 任务仍能注入 `filesense_navigate`，但不触发全仓 sync。
5. `pnpm --filter @frontagent/core typecheck`、`pnpm --filter @frontagent/mcp-filesense test -- --run`、`pnpm build` 通过。

## 9. 结论

FrontAgent 当前的性能优化重点已经发生变化：Filesense 的重扫问题已通过 `filesense_navigate` 基本收口，Planner 也不是瓶颈。下一阶段应围绕 __**Executor 可观测性与 create_file 链路治理**__ 展开。

推荐先做 trace 与 benchmark 入仓，再基于数据优化 create/modify/refactor 的具体阶段。这样既能避免盲改，也能把性能收益沉淀成长期守护能力。
