# 更新日志

该文件记录项目的主要版本变更。

## [Unreleased]

## [2.1.1] - 2026-06-09

### 变更
- **core/executor**：拆分 Executor 的工具调用处理、校验跳过逻辑、进度约束、步骤反馈和 trace 记录逻辑，保持执行行为不变，同时降低核心执行路径的维护成本。
- **core/agent**：从 FrontAgent 主编排流程中提取上下文收集、facts 刷新、项目预扫描、任务执行准备和执行回调逻辑，减少主循环耦合。
- **core/context**：拆分 context fact 序列化、facts 合并、文件系统 facts 更新和模块依赖图更新逻辑，提升上下文持久化与工作区事实刷新的可测性。
- **core/planner**：拆分 planner phase helper，并补充 phase 处理相关测试。
- **mcp-filesense**：拆分 Filesense engine 的 helper、索引、notes、query 和 schema 编排职责，为查询、notes、schema 与索引持久化补充独立模块边界。
- **mcp-memory**：拆分 memory preload/recall helper 和持久化 writer，隔离记忆 I/O 与召回编排逻辑。
- **mcp-memory/rag**：从知识库实现中提取语义检索编排逻辑，保持 hybrid RAG 行为不变。
- **runtime-node**：拆分 runtime MCP task invocation setup，使 MCP server 的 schema 断言和 task handler 组装更清晰。
- **vscode**：拆分 webview body、script、style 和 template renderer，并补充对应测试，保持侧边栏 UI 行为不变。
- **sub-agents**：拆分 code-quality subagent prompt policy。
- **tooling**：移除临时 GitNexus RC patch，并对齐 Biome schema 版本。

### 修复
- **vscode/security**：加固 VS Code webview nonce 生成。
- **filesense**：保留 Filesense query 的相对路径语义。
- **filesense**：生成 Filesense notes 时保留 notes schema path 归属。
- **workflow**：恢复并加固本地 GitNexus contract gate。
- **workflow**：修复 core worktree 相对路径解析，并防止 bootstrap 在 worktree 不匹配时继续执行。

### 测试
- 新增 CLI command router 覆盖。
- 新增 runtime MCP contract 与 schema assertion 覆盖。
- 新增 hybrid RAG knowledge-base 覆盖。
- 新增 executor 在校验跳过、进度约束、步骤反馈、工具调用处理和 trace 记录上的覆盖。
- 新增 agent 在上下文收集、facts 刷新、项目预扫描、执行回调和任务执行准备上的覆盖。
- 新增 ContextManager 在 fact 序列化、facts 合并、文件系统 facts 更新和模块依赖图上的覆盖。
- 新增 Filesense engine helper、索引持久化、notes 生成、query result 和 schema 编排覆盖。
- 新增 memory preload/recall helper 与 persistence writer 覆盖。
- 新增 VS Code webview body、script、style 和 template renderer 覆盖。
- 清理 executor、shared utility 和 LLM service 测试中的 Biome warning。

### 兼容性说明
- npm CLI 包与 VS Code 扩展版本更新为 `2.1.1`。
- Node.js 要求保持 `>=20.0.0`。
- VS Code 扩展要求保持 `^1.120.0`。

## [1.0.1] - 2026-04-30

### 新增
- 新增首版 FrontAgent VS Code 桌面插件，在 Activity Bar 提供侧边栏任务台。
- 新增 VS Code 内的任务输入、当前文件/选区上下文、浏览器 URL 上下文、Run/Cancel、阶段与步骤进度、审批卡片和运行日志入口。
- 新增 VS Code 插件中的 SDD 初始化与校验命令。
- 新增共享的 `@frontagent/runtime-node` 运行时 API，供 CLI 与 VS Code 插件复用。
- 新增 FrontAgent 执行链路中的协作式 `AbortSignal` 取消支持。

### 变更
- 更新 npm 包元数据，对齐 `1.0.1` 版本发布。
- 文档补充 CLI 与 VS Code 插件两种使用方式。
- `fa run` 改为复用共享 Node runtime，同时保留原有 Ink 终端交互体验。

## [0.1.8] - 2026-04-29

### 新增
- 新增 `fa -v` 作为 CLI 版本输出短参数。
- 新增 `fa version` 显式版本命令。

## [0.1.7] - 2026-04-29

### 新增
- 新增渐进式探索协议，引导文件系统变更先观察、再确认、最后写入。
- 新增 FrontAgent 内置身份上下文，让“你是谁 / 你能做什么”这类 query 能基于稳定身份事实回答。

### 变更
- 将发布后的 CLI 命令从 `frontagent` 缩短为 `fa`。
- 精简 `fa run` 默认输出为状态摘要、工具调用摘要和最终回答，冗长内部日志仅在 `--debug` 中展示。

### 修复
- 修复 ESM bundle 中缺少 `__filename` 导致 `fa run` 崩溃的问题。
- 规范化已经包含 `/chat/completions` 的 OpenAI-compatible base URL。
- 修复 query 任务只完成工具步骤却没有最终回答时仍显示成功的问题。

## [0.1.6] - 2026-03-22

### 新增
- 新增基于 Weaviate 的 RAG 语义向量存储，同时保留本地 BM25 索引。
- 新增 RAG 缓存包导出/导入流程，用于分发预构建知识库索引。
- 新增仅用于检索前的大模型查询改写步骤，可将用户输入改写为更适合前端知识库检索的专业查询。

### 变更
- 明确统一 RAG 相关术语：远程 RAG 证据统一称为“知识库”，不再与当前工作区仓库混淆。
- 更新中英文文档，补充 Weaviate、查询改写和缓存包分发示例。

### 修复
- 修复 query 任务中 Planner 将远程 RAG 命中误判为当前工作区本地文件的问题。
- 优化 Weaviate 语义索引与相关 RAG 执行链路的稳定性。

## [0.1.5] - 2026-03-16

### 修复
- 修正 npm 发布元数据：
  - `bin.frontagent` 调整为 `dist/index.cjs`，避免 npm 发布时自动移除 CLI 入口。
  - `repository.url` 规范为 `git+https://github.com/ceilf6/FrontAgent.git`。
- 新增中英文变更日志，提升版本可追踪性。

## [0.1.4] - 2026-03-16

### 新增
- 引入 Planner / Executor Skills 层，支持技能化扩展与阶段注入。

### 变更
- 统一浏览器工具命名为 `browser_*`，并保留兼容别名。
- 更新中英文 README 的 Skills 使用说明与示例。

### 修复
- Planner 快照类型收敛为 `ReadonlyMap`，降低技能误改上下文风险。
- 修正文档中 `search_code` 示例参数为 `filePattern`。
