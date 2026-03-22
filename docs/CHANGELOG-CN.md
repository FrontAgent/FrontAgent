# 更新日志

该文件记录项目的主要版本变更。

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
