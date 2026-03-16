# 更新日志

该文件记录项目的主要版本变更。

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

