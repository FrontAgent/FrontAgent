# Filesense 按需导航优化定量测试

## 背景

本次优化的目标是把 FrontAgent 中的 Filesense 从“默认全仓同步 + 摘要”改为“按需、轻量、有预算的导航能力”。旧策略在 planner 中遇到多数文件读写步骤时都会前置：

```text
filesense_sync_and_summarize(path='.')
```

这会递归写入 `FILES.json` 与 `FILES.notes.json`，对单文件任务、明确路径任务和大仓库都偏重。新策略改为 planner 根据任务意图选择性注入：

```text
filesense_navigate(paths=[...], depth=..., maxEntries=..., maxBytes=..., output='summary')
```

`filesense_navigate` 默认只读扫描，不写业务目录索引文件；返回面向 Agent 消费的 `summary / candidates / factsDelta / warnings`。

## 测试环境

- 机器：本地 macOS / Apple Silicon
- Node：项目当前 Node 运行环境
- 仓库：`FrontAgent-app`
- 分支提交：`da79289 优化 filesense 按需导航能力`
- 测试方式：构造临时前端仓库 fixture，重复运行 7 次取统计值
- Fixture 规模：
  - 约 83 个目录
  - 964 个文件
  - 包含 `package.json`、`vite.config.ts`、`src/main.tsx` 和 80 个 feature 目录

> 注：这是本地微基准，绝对耗时会受磁盘缓存和机器状态影响；更重要的是相对比例和写入副作用差异。

## 测试项

| 项目 | 说明 |
| --- | --- |
| Baseline：`sync + summarize` | 使用优化前 engine 的 `syncIndexes('.') + summarize('.')`，模拟旧 planner 默认注入效果 |
| New：`navigate root depth=2` | 新 `filesense_navigate`，从根目录扫描，`depth=2`、`maxEntries=300` |
| New：`navigate focused depth=1` | 新 `filesense_navigate`，只扫描明确局部路径，`depth=1`、`maxEntries=80` |
| New：budgeted sync | 新 `filesense_sync` 的预算参数，`depth=1`、`maxEntries=20` |

## 结果摘要

| 指标 | 平均耗时 | 中位数 | 相对旧方案 | 说明 |
| --- | ---: | ---: | ---: | --- |
| Baseline：`sync + summarize` | 101.09 ms | 95.25 ms | 100% | 扫描 83 个目录，写 83 个索引和 83 个 notes |
| `navigate root depth=2` | 5.08 ms | 4.94 ms | 5.02% | 约 **19.9x** 更快；扫描结果按预算截断 |
| `navigate focused depth=1` | 0.25 ms | 0.24 ms | 0.25% | 约 **408x** 更快；明确局部路径几乎无额外成本 |
| `sync depth=1 maxEntries=20` | 2.15 ms | 2.06 ms | 2.13% | 约 **47x** 更快；需要写索引时也可限界 |

## 写入副作用对比

| 项目 | 是否写业务目录 `FILES.json / FILES.notes.json` | 写入规模 |
| --- | --- | --- |
| Baseline：`sync + summarize` | 是 | 本次 fixture 写入 83 个 `FILES.json` + 83 个 `FILES.notes.json` |
| `filesense_navigate` | 否 | 验证结果：`hadWorkspaceIndexAfterNavigate=false` |
| Budgeted `filesense_sync` | 是 | 受 `depth / maxEntries / timeoutMs` 限制，本次只扫描/写入 2 个目录 |

## 触发策略对比

用 10 个典型 planner 场景做策略回放：

| 场景 | 旧策略是否注入 | 新策略是否注入 | 新策略原因 |
| --- | --- | --- | --- |
| 普通 query，无文件步骤 | 否 | 否 | no file-system exploration or mutation steps |
| 查询项目目录结构 | 否 | 是 | query requires repository structure |
| 明确单文件读取 `package.json` | 是 | 否 | known single-file task can use direct file tools |
| 明确单文件修改 `src/App.tsx` | 是 | 否 | known single-file task can use direct file tools |
| 新建组件 | 是 | 是 | create task benefits from nearby placement conventions |
| 查找应用入口 | 是 | 是 | task needs locating files or entrypoints |
| 多文件 refactor | 是 | 是 | multi-file change benefits from local directory map |
| debug 未知模块 | 是 | 是 | debug or structure task benefits from lightweight map |
| 只运行命令 | 否 | 否 | no file-system exploration or mutation steps |
| 泛目录查看 | 是 | 是 | debug or structure task benefits from lightweight map |

在这组样例中：

- 旧策略注入：7/10
- 新策略注入：6/10
- 注入数量下降：14.3%
- 更重要的是：新策略把“昂贵的全仓 sync+summarize”替换为“有预算的 navigate”，所以即使需要注入，成本也显著下降。

## 原始关键数据

```json
{
  "fixture": {
    "directories": 83,
    "generatedFiles": 964,
    "runs": 7
  },
  "measurements": {
    "baselineSyncAndSummarizeMs": {
      "avg": 101.09,
      "min": 91.01,
      "median": 95.25,
      "max": 131.18
    },
    "navigateRootDepth2Ms": {
      "avg": 5.08,
      "min": 4.53,
      "median": 4.94,
      "max": 6.27
    },
    "navigateFocusedDepth1Ms": {
      "avg": 0.25,
      "min": 0.20,
      "median": 0.24,
      "max": 0.30
    },
    "budgetedSyncDepth1Ms": {
      "avg": 2.15,
      "min": 1.94,
      "median": 2.06,
      "max": 2.54
    }
  },
  "ratios": {
    "navigateRootVsBaseline": 0.0502,
    "navigateFocusedVsBaseline": 0.0025,
    "budgetedSyncVsBaseline": 0.0213
  }
}
```

## 结论

这次优化达到了“减轻包袱、增强能力”的目标：

1. **默认行为更轻**：不再对多数文件任务默认全仓 `sync_and_summarize('.')`。
2. **需要时更可控**：`filesense_navigate` 有 `depth / maxEntries / maxBytes / timeoutMs` 预算。
3. **能力更贴近 Agent**：结果直接提供 `summary / candidates / factsDelta`，便于 planner/executor 消费。
4. **副作用更少**：导航默认只读，不污染业务目录。
5. **性能收益明显**：根目录轻量导航平均只需旧方案约 5%；明确局部导航约 0.25%。

