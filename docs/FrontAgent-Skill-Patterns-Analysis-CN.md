# FrontAgent 与 5 种 Agent Skill 模式对照分析

## 背景

本文对照 Google Cloud Tech 于 2026 年 3 月 17 日发布的文章
`5 Agent Skill design patterns every ADK developer should know`
来评估 FrontAgent 当前能力边界。

文章原始入口：

- <https://x.com/GoogleCloudTech/status/2033953579824758855>

文章总结了 5 种 skill 模式：

1. Tool Wrapper
2. Generator
3. Reviewer
4. Inversion
5. Pipeline

需要先澄清一件事：FrontAgent 当前的 `skills` 更偏向“运行时扩展层”，不是文章里强调的
`SKILL.md + references/assets` 内容编排层。

相关证据：

- 内部 Planner skill 注册机制：[`../packages/core/src/skills/planner-skills.ts`](../packages/core/src/skills/planner-skills.ts)
- 内部 Executor action skill 机制：[`../packages/core/src/skills/executor-skills.ts`](../packages/core/src/skills/executor-skills.ts)
- README 对 `Planner Skills Layer` 的定义：[`../README.md`](../README.md)

## 总结结论

| 模式 | 匹配度 | 判断 |
| --- | --- | --- |
| Tool Wrapper | 3/5 | 有约束注入和按需上下文加载能力，但没有外部化的 `SKILL.md` 封装层 |
| Generator | 3/5 | 有动态代码生成，但缺少模板资产和稳定结构化输出机制 |
| Reviewer | 4.5/5 | 已具备独立 reviewer 子代理、严重级别输出和阶段性阻断 |
| Inversion | 1.5/5 | 缺少系统化“先采访、后执行”的交互型 skill |
| Pipeline | 5/5 | 两阶段、分阶段、恢复重试、阶段校验都已成型 |

一句话结论：

FrontAgent 更强的是 agent runtime orchestration；文章更强调的是 skill content design。
FrontAgent 已经具备 `Pipeline + Reviewer + 部分 Tool Wrapper` 的底盘，但还没有把这些能力外化为可复用的 skill 包。

## 逐项对照

### 1. Tool Wrapper

#### 文章要点

- 把某个库、框架、团队约定包装成按需加载的 skill
- 触发后再读取 `references/` 中的详细规则
- 避免把所有知识硬塞进 system prompt

#### FrontAgent 现状

FrontAgent 已有“约束和知识按需注入”的基础能力，但载体不是 `SKILL.md`。

- SDD 会被转换成系统级强约束 prompt：
  [`../packages/sdd/src/prompt-generator.ts`](../packages/sdd/src/prompt-generator.ts)
- Agent 启动时把 SDD 注入给 Planner 和 Executor：
  [`../packages/core/src/agent.ts`](../packages/core/src/agent.ts)
- Planner 还会混合项目结构、已读文件、RAG 结果、页面结构：
  [`../packages/core/src/planner.ts`](../packages/core/src/planner.ts)

#### 判断

这说明 FrontAgent 已经具备 Tool Wrapper 的“效果”，但没有 Tool Wrapper 的“产品形态”。

缺口主要有两点：

- 缺少可分发的 skill 包目录
- 缺少对 `references/` 的渐进式装载协议

#### 结论

属于“能力已部分具备，但封装方式还不对”。

## 2. Generator

#### 文章要点

- 使用模板和样式参考生成稳定结构的输出
- 典型目录是 `assets/` 放模板，`references/` 放风格规则
- skill 负责调度填空流程，而不是把模板写死在 prompt 中

#### FrontAgent 现状

FrontAgent 已经把“规划”和“代码生成”拆开：

- Stage 1 只出结构化计划：
  [`../docs/TWO_STAGE_ARCHITECTURE.md`](TWO_STAGE_ARCHITECTURE.md)
- Stage 2 再按文件动态生成代码：
  [`../packages/core/src/executor.ts`](../packages/core/src/executor.ts)
- `create_file` 和 `apply_patch` 都有专门的 codegen action skill：
  [`../packages/core/src/skills/executor-skills.ts`](../packages/core/src/skills/executor-skills.ts)

#### 判断

这已经是 Generator 的一半：它会“生成”。
但它还缺文章强调的另一半：它不会“按模板稳定生成”。

目前缺少：

- 模板化资产目录
- 输出合同和变量槽位定义
- 不同生成器 skill 的可复用模板

#### 结论

Generator 底层能力存在，但还没有升级成“模板驱动生成系统”。

## 3. Reviewer

#### 文章要点

- 审查逻辑与审查标准分离
- 用 checklist 驱动 review
- 输出按严重级别分组

#### FrontAgent 现状

这是 FrontAgent 最成熟、也最接近文章的一部分。

- 有独立 `CodeQualitySubAgent`：
  [`../packages/core/src/sub-agents/code-quality-subagent.ts`](../packages/core/src/sub-agents/code-quality-subagent.ts)
- 输出结构中直接包含 `severity`、`rule`、`message`、`suggestion`
- 支持 LLM review 和规则回退
- 阶段完成后会触发 review，并把阻断项转成恢复流程：
  [`../packages/core/src/agent.ts`](../packages/core/src/agent.ts)

#### 判断

FrontAgent 的 Reviewer 不只是“给建议”，而是已经进入执行闭环：

- 发现问题
- 分类严重级别
- 反馈回主流程
- 触发修复步骤

这比文章里的基础 Reviewer 模式更工程化。

#### 结论

Reviewer 是当前最可以直接外化成 `SKILL.md` 的能力。

## 4. Inversion

#### 文章要点

- agent 先问问题，不准直接动手
- 通过显式 gating 阻止 premature execution
- 适合需求不清晰、需要审批或约束收集的任务

#### FrontAgent 现状

FrontAgent 会先补上下文，但不是先采访用户。

- Planner 会先判断是否缺少文件或页面上下文：
  [`../packages/core/src/planner.ts`](../packages/core/src/planner.ts)
- Executor 会在 patch 前自动补读文件：
  [`../packages/core/src/executor.ts`](../packages/core/src/executor.ts)

#### 判断

这属于“系统自动补事实”，不是“Inversion 式需求澄清”。

当前缺失的核心能力：

- 多轮问题流
- 问题未完成时禁止执行
- 显式审批节点
- 面向需求采集的 skill 包

#### 结论

这是 FrontAgent 当前最明显的短板。

## 5. Pipeline

#### 文章要点

- 严格阶段流
- 阶段门禁
- 不允许跳步
- 出错后可回到指定检查点

#### FrontAgent 现状

Pipeline 基本就是 FrontAgent 的主架构。

- README 直接把两阶段、分阶段、自愈写成核心卖点：
  [`../README.md`](../README.md)
- 执行器会做阶段分组、拓扑排序、阶段依赖控制：
  [`../packages/core/src/executor.ts`](../packages/core/src/executor.ts)
- 阶段失败后可生成恢复步骤并重跑验证
- 可切换 LangGraph checkpoint 执行

#### 判断

这不是“部分支持”，而是“系统基于 Pipeline 设计”。

#### 结论

Pipeline 是 FrontAgent 最强的能力，也是最适合拿来当外部 skill 系统骨架的部分。

## 核心差异

### FrontAgent 现在擅长什么

- 让 agent 跑稳
- 让步骤有阶段
- 让错误进入恢复环
- 让约束进入执行闭环

### 文章强调什么

- 让 skill 可复用
- 让知识按需装载
- 让输出结构可预测
- 让不同模式能组合

### 因此得到的判断

FrontAgent 不是缺“能力引擎”，而是缺“能力包装层”。

更具体地说：

- `packages/core/src/skills` 是内部 runtime 技术层
- 仓库还缺一个对外的 `skills/` 内容层

## 优先级建议

### P0

- 外化 `Reviewer`
- 新增 `Inversion`

原因：

- Reviewer 已经最成熟，改造成 skill 成本最低
- Inversion 是当前最大缺口，最能补足系统行为质量

### P1

- 把 SDD 约束和框架约束包装成 `Tool Wrapper`
- 给常见输出场景增加 `Generator`

### P2

- 让多个 skill 在一次任务中按需组合
- 做技能激活、渐进装载、阶段门禁的统一协议

## 最终判断

如果用一句工程化的话概括：

FrontAgent 已经具备“实现这 5 种模式”的运行时条件，但目前只把 `Pipeline` 和 `Reviewer`
真正做成了系统行为；`Tool Wrapper` 和 `Generator` 还停留在内部能力层；`Inversion`
则基本还没有产品化落地。
