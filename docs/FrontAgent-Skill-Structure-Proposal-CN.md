# FrontAgent Skill 目录结构落地设计稿

## 目标

为 FrontAgent 增加一层真正面向内容编排的 skill 系统，使其从“有 runtime 能力”升级为“有可复用 skill 包”。

配套现状分析见：

- [`./FrontAgent-Skill-Patterns-Analysis-CN.md`](./FrontAgent-Skill-Patterns-Analysis-CN.md)

这里的 skill 指的是文章中的形态：

- 以 `SKILL.md` 为入口
- 通过 `references/` 做渐进式知识加载
- 通过 `assets/` 提供模板或产出骨架
- 在运行时按需激活，而不是长期塞进全局 prompt

## 设计原则

### 1. 保留现有内部 skills

现有 `packages/core/src/skills` 不应删除。

它解决的是运行时问题：

- 任务路由
- action 参数修正
- codegen 策略
- 错误跳过策略

相关代码：

- [`../packages/core/src/skills/planner-skills.ts`](../packages/core/src/skills/planner-skills.ts)
- [`../packages/core/src/skills/executor-skills.ts`](../packages/core/src/skills/executor-skills.ts)

### 2. 新增外部化 skill 内容层

新 skill 层解决的是内容编排问题：

- 某类任务该读什么参考资料
- 何时向用户发问
- 哪些阶段必须审批
- 模板从哪里拿
- checklist 从哪里读

### 3. 采用渐进披露

遵循：

1. skill 元数据常驻
2. `SKILL.md` 正文仅在命中时载入
3. `references/` 和 `assets/` 仅在步骤需要时载入

这样才能控制上下文膨胀。

## 推荐目录

建议在仓库根目录新增顶层 `skills/`：

```text
skills/
  frontend-library-wrapper/
    SKILL.md
    agents/
      openai.yaml
    references/
      framework-selection.md
      react-conventions.md
      vue-conventions.md
      tailwind-conventions.md

  frontend-generator/
    SKILL.md
    agents/
      openai.yaml
    assets/
      templates/
        page-spec.md
        component-spec.md
        acceptance-report.md
    references/
      output-contract.md
      style-guide.md

  frontend-reviewer/
    SKILL.md
    agents/
      openai.yaml
    references/
      review-checklist.md
      severity-rubric.md
      frontend-quality-rules.md

  requirement-interviewer/
    SKILL.md
    agents/
      openai.yaml
    references/
      question-flow.md
      gating-rules.md
      answer-completeness.md

  frontend-delivery-pipeline/
    SKILL.md
    agents/
      openai.yaml
    references/
      phase-playbook.md
      recovery-policy.md
      acceptance-gates.md
    assets/
      templates/
        phase-report.md
        qa-summary.md
```

## 为什么是这 5 个 skill

它们分别对应文章里的 5 种模式，同时能直接复用 FrontAgent 现有能力。

| Skill | 对应模式 | 作用 |
| --- | --- | --- |
| `frontend-library-wrapper` | Tool Wrapper | 包装框架和团队规范 |
| `frontend-generator` | Generator | 统一生成结构化产出 |
| `frontend-reviewer` | Reviewer | 外化当前代码质量审查能力 |
| `requirement-interviewer` | Inversion | 把需求澄清前置 |
| `frontend-delivery-pipeline` | Pipeline | 把阶段门禁写成可复用 workflow |

## 各 skill 的职责边界

### 1. `frontend-library-wrapper`

#### 目标

把“框架规范”从 SDD 和硬编码 prompt 中拆出来，变成按技术栈激活的 skill。

#### 触发方式

- 用户显式提到 `React`、`Vue`、`Tailwind`、`Next.js`
- 或项目扫描识别到对应依赖

#### 读取策略

- `SKILL.md` 只负责选择策略
- 具体规范放到 `references/*.md`

#### 适合承载的内容

- 命名约定
- 目录分层
- 状态管理约束
- 组件组织规则

### 2. `frontend-generator`

#### 目标

把“生成代码”升级为“生成稳定结构的工件”。

#### 典型输出

- 页面规格说明
- 组件规格说明
- 验收报告
- 代码生成前的中间产物

#### 读取策略

- `assets/templates/` 放固定模板
- `references/output-contract.md` 定义字段和顺序
- skill 指导模型先补变量，再填模板

#### 为什么单独拆出

当前 FrontAgent 会生成代码，但缺少模板输出层。这个 skill 用来补齐那一层。

### 3. `frontend-reviewer`

#### 目标

把现有 `CodeQualitySubAgent` 外化为 skill 入口。

#### 可复用的现有能力

- 严重级别输出
- checklist 风格 issue
- 规则回退
- 阶段完成后阻断

相关实现：

- [`../packages/core/src/sub-agents/code-quality-subagent.ts`](../packages/core/src/sub-agents/code-quality-subagent.ts)
- [`../packages/core/src/agent.ts`](../packages/core/src/agent.ts)

#### skill 层新增内容

- 审查 checklist 文件可替换
- 支持不同审查域：
  - 通用前端
  - 可访问性
  - 安全
  - 设计系统一致性

### 4. `requirement-interviewer`

#### 目标

解决 FrontAgent 当前最明显的缺口：在需求不完整时，先采访再执行。

#### 核心约束

- 未完成问题流前，不允许创建或修改文件
- 必须按问题序列推进
- 当答案缺失时只能追问，不能猜

#### 参考文件职责

- `question-flow.md`
  定义问题顺序
- `gating-rules.md`
  定义哪些信息缺失时禁止进入执行
- `answer-completeness.md`
  定义何时视为“信息已足够”

#### 适用任务

- 新页面/新功能规划
- 架构方案确认
- 多约束交付场景

### 5. `frontend-delivery-pipeline`

#### 目标

把 FrontAgent 已经成熟的阶段流能力外化为 skill。

#### 典型阶段

1. 澄清需求
2. 扫描上下文
3. 规划步骤
4. 生成或修改代码
5. 运行检查
6. 代码审查
7. 验收总结

#### 参考文件职责

- `phase-playbook.md`
  定义每一阶段做什么
- `recovery-policy.md`
  定义错误后的恢复策略
- `acceptance-gates.md`
  定义进入下一阶段的门禁

#### 与现有实现的关系

它不替代现有执行器，而是给执行器提供更高层的内容协议。

## 建议的 SKILL.md 写法

每个 skill 的 `SKILL.md` 只保留三类内容：

1. 何时触发
2. 何时读取哪个 reference
3. 何时必须停止并向用户提问或请求批准

不要在 `SKILL.md` 里重复堆很多细则。
细则应尽量下沉到 `references/`。

推荐骨架：

```md
---
name: frontend-reviewer
description: Review frontend code with severity-based findings, checklist-driven rules, and explicit blocking gates.
---

# frontend-reviewer

Use this skill when the user asks for code review, acceptance review, or quality audit.

## Trigger

- Requests to review frontend code
- Requests to score findings by severity
- Requests to validate work before acceptance

## Workflow

1. Read `references/review-checklist.md`
2. Read `references/severity-rubric.md`
3. Review only the files relevant to the request
4. Output findings grouped by severity
5. If no blocking issues exist, state residual risk briefly

## Guardrails

- Do not invent files that were not provided or discovered
- Do not output generic praise
- Do not merge warnings into errors unless the rubric says so
```

## 运行时接入建议

### 1. Loader 位置

建议新增：

- `packages/core/src/skill-content/loader.ts`
- `packages/core/src/skill-content/types.ts`
- `packages/core/src/skill-content/resolver.ts`

职责：

- 扫描 `skills/*/SKILL.md`
- 解析 metadata
- 命中后载入 skill 正文
- 在需要时读取 `references/` 或 `assets/`

### 2. 搜索路径

建议按以下顺序加载：

1. 项目目录 `./skills`
2. 用户目录 `$CODEX_HOME/skills`
3. 内置 skills 目录

这样项目可以覆盖全局默认 skill。

### 3. 与现有 Planner/Executor 的关系

建议保持双层结构：

- 内层：代码层 skill
  - 仍在 `packages/core/src/skills`
  - 负责运行时行为
- 外层：内容层 skill
  - 新增在 `skills/`
  - 负责知识装载和流程门禁

推荐的数据流：

```text
user task
  -> skill matcher
  -> load matched SKILL.md
  -> load selected references/assets
  -> build planner/executor prompt context
  -> existing Planner/Executor runtime
```

### 4. MVP 集成点

第一阶段先不要做复杂自动装配，只做 3 件事：

1. 识别命中的 skill
2. 把 `SKILL.md` 正文注入 Planner prompt
3. 允许 skill 指定要读取的 `references/`

这已经足够支撑第一版外部化 skill 系统。

## 分阶段落地建议

### Phase 1

- 建立 `skills/` 目录
- 实现 loader
- 先落一个 `frontend-reviewer`

理由：

- 当前能力最成熟
- 风险最低
- 便于验证 skill 结构是否合理

### Phase 2

- 加入 `requirement-interviewer`
- 加入 `frontend-delivery-pipeline`

理由：

- 先补系统最大行为缺口
- 再把现有 Pipeline 进行外化

### Phase 3

- 加入 `frontend-library-wrapper`
- 加入 `frontend-generator`

理由：

- 这两类更依赖模板、规范和项目上下文
- 适合在 Loader 和 references 机制稳定后再补

## 不建议做的事

- 不要把所有规则继续塞回一个大 system prompt
- 不要把 skill 内容和 runtime 逻辑混在同一个目录
- 不要为每个 skill 加大量 README 或过程文档
- 不要在第一版就做复杂 DSL

## 最终建议

最小可行方案不是“重写 FrontAgent”，而是：

1. 保留现有内部 `packages/core/src/skills`
2. 新增顶层 `skills/`
3. 优先外化 `Reviewer` 和 `Inversion`
4. 再逐步把 `Tool Wrapper`、`Generator`、`Pipeline` 做成标准 skill 包

如果这样落地，FrontAgent 会形成一个清晰的双层结构：

- 下层负责把 agent 跑稳
- 上层负责把 agent 变得可复用、可分发、可组合
