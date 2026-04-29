# 更新日志

该文件记录项目的主要版本变更。

## [Unreleased]

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
