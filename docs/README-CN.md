# FrontAgent

<div align="center">
  <img src="../assets/branding/icon.png" alt="FrontAgent Logo" width="200"/>
</div>

[![npm version](https://badge.fury.io/js/frontagent.svg)](https://www.npmjs.com/package/frontagent)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org)

> 面向前端工程的企业级 AI Agent 系统 — 以 SDD 为约束、通过 MCP 控制感知与执行

[English README](../README.md) | [快速开始](QUICKSTART.md) | [架构](architecture.md) | [设计文档](design.md)

FrontAgent 是一个专为前端工程设计的 AI Agent 系统，解决了在真实工程场景中部署 agent 时遇到的核心问题：

> **蒸馏 Planner 模型**：FrontAgent 的 Planner 阶段已蒸馏为 Hugging Face Planner 资产，统一收录在 [FrontAgent: Frontend Engineering Agent](https://hf.co/collections/ceilf6/frontagent-frontend-engineering-agent)。在支持的 Qwen Coder 基座模型上加载已发布 adapter，即可直接生成前端执行计划，无需调用大型 LLM API。训练流程、提示词、评估脚本和 Hugging Face 发布元数据位于 [models/frontagent-planner](../models/frontagent-planner)。

- ✅ **两阶段架构** — 规划与执行分离，避免 JSON 解析错误并支持动态代码生成
- ✅ **分阶段执行** — 步骤按阶段分组，支持阶段内错误恢复
- ✅ **自愈能力** — 工具错误反馈循环会自动分析错误并生成修复步骤
- ✅ **事实记忆** — 基于结构化事实的上下文系统，用于精确跟踪项目状态
- ✅ **模块依赖跟踪** — 自动解析 import/export，检测路径幻觉
- ✅ **幻觉预防** — 多层次幻觉检测与拦截
- ✅ **SDD 约束** — 将 Specification Driven Development 作为 agent 的硬约束
- ✅ **MCP 协议** — 通过 Model Context Protocol 受控调用工具
- ✅ **最小化改动** — 基于补丁的代码修改并支持回滚
- ✅ **Web 感知** — 通过浏览器 MCP 理解页面结构
- ✅ **Shell 集成** — 支持终端命令执行（需要用户批准）
- ✅ **预规划扫描** — 规划前扫描项目结构以生成准确路径
- ✅ **自动端口检测** — 从配置文件自动检测开发服务器端口
- ✅ **远程混合 RAG** — 对整个远程仓库建索引并自动排除子模块，组合 BM25 关键词检索与 embedding 语义检索
- ✅ **Filesense 导航** — 面向当前仓库的预算化导航，生成 schema 与笔记
- ✅ **LangGraph 引擎（可选）** — 可切换图执行引擎并支持可选 checkpoint
- ✅ **Planner Skills 层** — 可复用的规划技能封装（任务拆解与阶段注入）
- ✅ **蒸馏 Planner 资产** — 仓库原生维护 Hugging Face Planner 模型集合的训练、评估与发布资产
- ✅ **Skill Lab** — 通过本地 eval 套件对内容技能做 benchmark、改进与提升
- ✅ **VS Code 侧边栏** — Marketplace 插件提供任务运行、SDD 辅助、安全配置与运行日志
- ✅ **OSS Harness** — 面向维护者友好的本地 contract、quality、GitNexus 与 workflow gates
- ✅ **仓库管理阶段** — 验收通过后自动执行 git/gh 流程（commit/push/PR）
- ✅ **跨会话记忆** — 四阶段记忆体系（预加载、运行时召回、任务后持久化、结构化存储），跨运行保留项目事实、错误修复经验与依赖状态

## 当前发布快照

当前仓库的 npm CLI 包与 VS Code 插件均对齐到 `frontagent@2.1.1`。

- 运行时要求：Node.js `>=20.0.0`；VS Code 插件 engine 为 `^1.120.0`。
- 构建产物：`pnpm build` 会构建 monorepo、打包 CLI、同步 VS Code 版本，并生成 `apps/vscode/frontagent-2.1.1.vsix`。
- 质量门禁：`pnpm quality:predev`、`pnpm quality:precommit`、`pnpm quality:ci` 和 `pnpm quality:local` 会组合执行 contract 检查、lint、typecheck、测试、workflow 测试与构建验证。
- v2.1.1 重点：拆小 agent/executor/context/Filesense/memory/runtime/webview 模块，加固 VS Code webview nonce 生成，恢复 GitNexus contract checks，并扩展 focused tests。

## 三种使用方式

FrontAgent 支持终端、VS Code 与独立桌面三种使用方式：

- **CLI**：在终端里使用 `fa init`、`fa run`、RAG 命令、Skill Lab，以及适合自动化脚本的工作流。
- **VS Code 插件**：在 Activity Bar 打开 FrontAgent 侧边栏任务台，直接运行任务、附加当前文件或选区、填写浏览器 URL、查看阶段/步骤进度、审批敏感操作、初始化/校验 SDD，并在 VS Code 内打开运行日志。
- **桌面客户端**：独立的 Electron GUI（`apps/desktop`），复用同一套 Node 运行时脊柱——任务控制台用于发起任务、实时查看阶段/步骤遥测、审批敏感操作，并提供设置面板配置 LLM provider/model。

你可以在 VS Code Marketplace 搜索 `FrontAgent`，或使用插件 ID `ceilf6.frontagent` 安装。

### 桌面客户端

桌面客户端是一个 sandboxed Electron 窗口，接到真实运行时（`window.frontagent` → IPC → `runFrontAgentTask`）；设置持久化到本机用户数据目录，运行时不可用时优雅降级。

- **下载**：在 [GitHub Releases](https://github.com/FrontAgent/FrontAgent/releases) 页面下载对应平台的未签名压缩包 `frontagent-desktop-${version}-${os}-${arch}.zip`（每个 `v*` tag 自动发布），解压后运行 `frontagent` 可执行文件。LLM API Key 从环境变量读取（`PROVIDER_API_KEY` / `API_KEY`）；provider/model/base URL 在应用内设置面板配置。
- **本地构建**：`pnpm --filter @frontagent/desktop package` 在 `apps/desktop/release/` 下产出未打包的应用；`pnpm --filter @frontagent/desktop dev` 对接 Vite 开发服务器运行；`pnpm --filter @frontagent/desktop run release` 产出可分发 zip。

> 桌面压缩包目前未签名；代码签名、公证与原生安装器（dmg/nsis/AppImage）为后续计划。

## CLI 快速开始

```bash
# 1. 通过 npm 全局安装
npm install -g frontagent
# 或使用 pnpm
pnpm add -g frontagent
# 或使用 yarn
yarn global add frontagent

# 2. 配置 LLM（支持 OpenAI 与 Anthropic）
# OpenAI 配置
export PROVIDER="openai"
export BASE_URL="https://api.openai.com/v1"
export MODEL="gpt-4"
export API_KEY="sk-..."

# 或 Anthropic 配置
export PROVIDER="anthropic"
export BASE_URL="https://api.anthropic.com"
export MODEL="claude-sonnet-4-20250514"
export API_KEY="sk-ant-..."

# 3. 进入你的项目目录并初始化 SDD
cd your-project
fa init

# 4. 让 AI 帮你完成任务
fa run "创建用户登录页面"
fa run "优化首页加载性能"
fa run "添加深色模式支持"
# 使用 LangGraph 引擎 + checkpoint（可选）
fa run "添加路由守卫并创建 PR" --engine langgraph --langgraph-checkpoint
```

## MCP Server

FrontAgent 可以作为本地 stdio MCP Server 接入 Claude Desktop、Cursor、Codex，以及其他可以启动命令式 MCP Server 的客户端。

MCP 模式只向外部 Host 暴露 FrontAgent 的上层 agent 能力，不直接暴露 `read_file`、`apply_patch`、`run_command`、browser tools 或 `rag_query` 等内部原始工具。

### 启动 Server

```bash
# 使用已安装的 CLI
fa mcp serve

# 或者在源码 checkout 中先执行 pnpm build，再运行构建后的 CLI
node /absolute/path/to/FrontAgent-app/apps/cli/dist/index.js \
  mcp serve
```

默认情况下，如果 MCP Host 暴露且只暴露一个 file root，FrontAgent 会把该 workspace root 作为项目根目录。若 Host 没有暴露 roots，则退回 MCP Server 进程的当前工作目录。

只有需要固定项目，或 Host 暴露多个 workspace roots 且 FrontAgent 无法安全选择时，才需要使用 `--project-root`：

```bash
fa mcp serve --project-root /absolute/path/to/your-project
```

一个 MCP Server 进程绑定一个已解析的项目根目录。

常用 server 参数：

```bash
fa mcp serve \
  --engine native \
  --security-mode balanced \
  --rag-repo https://github.com/ceilf6/Lab.git \
  --rag-branch main \
  --filesense-enabled true \
  --log-file .frontagent/runs/mcp-server.log
```

### Host 配置

大多数 MCP Host 使用 `mcpServers` 配置。优先使用最简配置：

```json
{
  "mcpServers": {
    "frontagent": {
      "command": "fa",
      "args": [
        "mcp",
        "serve"
      ]
    }
  }
}
```

如果 Host UI 分“命令”和“参数”两个输入框：

- 命令：`fa`
- 参数：`mcp`、`serve`

不要把 `fa mcp serve` 整串填进命令框。

如果遇到 `找不到命令 "fa"` 或 `env: node: No such file or directory`，说明 GUI Host 没继承终端里的 `PATH`。先在终端确认路径：

```bash
which node
which fa
```

再改用绝对路径：

```json
{
  "mcpServers": {
    "frontagent": {
      "command": "/opt/homebrew/bin/node",
      "args": [
        "/opt/homebrew/bin/fa",
        "mcp",
        "serve"
      ]
    }
  }
}
```

如果使用源码构建产物：

```json
{
  "mcpServers": {
    "frontagent": {
      "command": "/opt/homebrew/bin/node",
      "args": [
        "/absolute/path/to/FrontAgent-app/apps/cli/dist/index.js",
        "mcp",
        "serve"
      ]
    }
  }
}
```

如果需要 direct LLM fallback，可通过 Host 配置传入环境变量：

```json
{
  "mcpServers": {
    "frontagent": {
      "command": "fa",
      "args": [
        "mcp",
        "serve"
      ],
      "env": {
        "PROVIDER": "openai",
        "BASE_URL": "https://api.openai.com/v1",
        "MODEL": "gpt-4",
        "API_KEY": "sk-..."
      }
    }
  }
}
```

配置位置示例：

- Claude Desktop：在 `claude_desktop_config.json` 的 `mcpServers` 下添加 server。
- Cursor：在 Cursor MCP 配置中添加到 `mcpServers`，例如 `.cursor/mcp.json`。
- Codex 或其他 MCP Host：在 Host 的 MCP Server 配置界面中使用相同的 command、args 和 env 值。

### 暴露的 MCP 工具

FrontAgent 暴露六个 MCP 工具：

- `frontagent_status`：查看项目、SDD、skills、LLM backend、RAG、日志状态。
- `frontagent_run_task`：执行完整 FrontAgent 任务。输入包括 `task`、`type`、`files`、`url`、`sddPath` 和 `securityMode`。
- `frontagent_plan_task`：只生成执行计划，不执行、不写文件。
- `frontagent_validate_sdd`：校验 SDD。
- `frontagent_list_skills`：列出可见内容技能。
- `frontagent_init_sdd`：初始化 SDD；已存在时默认不覆盖，除非 `force=true`。

`frontagent_run_task` 返回结构化 JSON 文本：

```json
{
  "success": true,
  "taskId": "task_...",
  "output": "...",
  "error": null,
  "duration": 1234,
  "runLogPath": "/absolute/path/.frontagent/runs/...",
  "executedStepsSummary": [],
  "securityDecisions": []
}
```

### LLM Backend 行为

MCP 模式使用 `auto` LLM backend 选择：

1. 如果 Host 支持 MCP Sampling，FrontAgent 会通过 `sampling/createMessage` 请求 Host 模型。
2. 如果 Sampling 不支持或不可用，FrontAgent 会回退到 direct LLM 配置。

Direct fallback 使用与 `fa run` 相同的环境变量和 flags：

```bash
export PROVIDER="openai"
export BASE_URL="https://api.openai.com/v1"
export MODEL="gpt-4"
export API_KEY="sk-..."
```

只读工具如 `frontagent_status`、`frontagent_list_skills`、`frontagent_validate_sdd` 和 `frontagent_init_sdd` 不需要 LLM 配置。`frontagent_run_task` 和 `frontagent_plan_task` 需要 Host Sampling 支持或有效的 direct LLM fallback。

### 安全模型

MCP 模式保留 FrontAgent 内部安全边界：

- 外部 MCP Host 不能直接调用内部文件、shell、browser 或 RAG 工具。
- 内部文件写入、shell 命令、browser 操作和其他副作用仍会经过 `SecurityManager`。
- 默认安全模式为 `balanced`。
- 因为 stdio MCP 没有 FrontAgent 的交互审批 UI，任何需要 `ask` 决策的动作都会 fail closed。
- `frontagent_init_sdd` 只会在配置的项目根目录内写入 SDD 文件。

## 远程 RAG

FrontAgent 现在支持一个面向整个远程仓库的知识库流程，用于增强规划和代码生成：

- 会将远程仓库同步到 `.frontagent/rag-cache/repo`
- 以分块方式索引整个仓库，并自动排除 Git 子模块路径
- 同时执行 BM25 关键词检索与 embedding 语义检索
- 对两路候选结果分别做 metadata filter，再进行融合排序
- 索引文件和向量缓存都会写入 `.frontagent/rag-cache`

默认知识源：

- 仓库：`https://github.com/ceilf6/Lab.git`
- Source mode：默认是 `git`；当配置了 `FRONTAGENT_OPENVIKING_ENDPOINT` 时，FrontAgent 默认使用 `composite`（优先 `OpenViking`，Git RAG 作为 fallback）

CLI 参数：

```bash
fa run "解释 React setState 的行为" \
  --provider openai \
  --base-url https://yunwu.ai/v1 \
  --api-key YOUR_TOKEN \
  --rag-repo https://github.com/ceilf6/Lab.git \
  --rag-branch main \
  --rag-keyword-candidates 40 \
  --rag-semantic-candidates 40 \
  --rag-keyword-weight 0.45 \
  --rag-semantic-weight 0.55

# 当 provider=openai 时，RAG embedding 默认继承同一套 base-url/api-key
# 只有 embedding 端点与大模型端点不同的时候，才需要单独覆盖
fa run "解释 React setState 的行为" \
  --provider openai \
  --base-url https://yunwu.ai/v1 \
  --api-key YOUR_TOKEN \
  --rag-embedding-model text-embedding-3-small \
  --rag-embedding-batch-size 32 \
  --rag-embedding-timeout-ms 30000

# 使用 Weaviate 作为语义向量库（BM25 仍保留本地索引）
fa run "解释 React setState 的行为" \
  --provider openai \
  --base-url https://yunwu.ai/v1 \
  --api-key YOUR_TOKEN \
  --rag-embedding-model text-embedding-3-small \
  --rag-vector-store-provider weaviate \
  --rag-weaviate-url http://127.0.0.1:8080 \
  --rag-weaviate-collection-prefix FrontAgentRagChunk \
  --rag-weaviate-batch-size 64 \
  --rag-weaviate-timeout-ms 30000

# 使用 OpenViking Wiki 作为主知识提供方，并保留 Git RAG fallback
fa run "FrontAgent RAG 在哪里实现？" \
  --rag-source composite \
  --open-viking-endpoint https://openviking.example.com/query \
  --open-viking-corpus wiki \
  --open-viking-namespace docs/openviking \
  --open-viking-l1-entry docs/openviking/frontagent-l1.md

# 只使用 OpenViking，并禁用 Git fallback
fa run "FrontAgent RAG 在哪里实现？" \
  --rag-source openviking \
  --open-viking-endpoint https://openviking.example.com/query \
  --disable-open-viking-fallback

# 禁用检索前的 LLM 查询优化
fa run "如何自实现选择框" \
  --disable-rag-query-rewrite

# 在 BM25 + embedding 初筛后默认启用交叉编码器重排序
fa run "解释 React setState 的行为" \
  --provider openai \
  --base-url https://yunwu.ai/v1 \
  --api-key YOUR_TOKEN \
  --rag-embedding-model text-embedding-3-small \
  --rag-reranker-model jina-reranker-v2-base-multilingual \
  --rag-reranker-base-url https://your-reranker-endpoint/v1 \
  --rag-reranker-timeout-ms 30000

# 单次运行禁用重排序
fa run "解释 React setState 的行为" \
  --disable-rag-reranker

# 禁用语义检索，仅使用 BM25
fa run "解释 React setState 的行为" \
  --disable-rag-semantic

# 单次运行禁用远程 RAG
fa run "创建页面" --disable-rag

# 本次查询前强制同步远程 git；默认会复用本地缓存
fa run "解释 React setState 的行为" --rag-sync-on-query
```

## Skill Lab

FrontAgent 现在内置了一个本地 Skill Lab 流程，用于迭代 `skills/` 下的内容技能。

```bash
# 列出当前可见的内容技能
fa skill list

# 创建一个新的内容技能骨架
fa skill scaffold pricing-audit

# 为某个 skill 生成 starter trigger evals
fa skill init-evals frontend-design

# 为某个 skill 生成 starter behavior evals（输出质量二元检查）
fa skill init-behavior-evals frontend-design

# 对当前 skill 触发表现做 benchmark
fa skill benchmark frontend-design

# 同时跑 trigger + behavior benchmark
fa skill benchmark frontend-design --behavior

# 自动生成候选 skill，并与基线对比
fa skill improve frontend-design

# 使用 trigger + behavior 双评测进行改进
fa skill improve frontend-design --behavior

# 审核后将候选版本提升为当前 skill
fa skill promote frontend-design 20260331T120000Z
```

当前 Skill Lab 支持两条评测维度：
- Trigger eval：检查 skill 是否被正确触发。
- Behavior eval：检查 skill 对最终输出质量的帮助是否通过二元 checks。

你可以保持默认 trigger-only，也可以在 benchmark/improve 加 `--behavior` 开启双评测。

环境变量：

```bash
export FRONTAGENT_RAG_SOURCE="composite" # git | openviking | composite
export FRONTAGENT_OPENVIKING_ENDPOINT="https://openviking.example.com/query"
export FRONTAGENT_OPENVIKING_API_KEY=""
export FRONTAGENT_OPENVIKING_CORPUS="wiki"
export FRONTAGENT_OPENVIKING_NAMESPACE="docs/openviking"
export FRONTAGENT_OPENVIKING_L1_ENTRY="docs/openviking/frontagent-l1.md"
export FRONTAGENT_OPENVIKING_TIMEOUT_MS="30000"
export FRONTAGENT_RAG_REPO="https://github.com/ceilf6/Lab.git"
export FRONTAGENT_RAG_BRANCH="main"
export FRONTAGENT_RAG_SYNC_ON_QUERY="false"
export FRONTAGENT_RAG_MAX_RESULTS="5"
export FRONTAGENT_RAG_KEYWORD_CANDIDATES="40"
export FRONTAGENT_RAG_SEMANTIC_CANDIDATES="40"
export FRONTAGENT_RAG_KEYWORD_WEIGHT="0.45"
export FRONTAGENT_RAG_SEMANTIC_WEIGHT="0.55"
export FRONTAGENT_RAG_QUERY_REWRITE_MAX_TOKENS="160"
export FRONTAGENT_RAG_QUERY_REWRITE_TEMPERATURE="0.1"
export FRONTAGENT_RAG_RERANKER_MODEL="jina-reranker-v2-base-multilingual"
export FRONTAGENT_RAG_RERANKER_BASE_URL="https://your-reranker-endpoint/v1"
export FRONTAGENT_RAG_RERANKER_API_KEY="sk-..."
export FRONTAGENT_RAG_RERANKER_CANDIDATE_COUNT="20"
export FRONTAGENT_RAG_RERANKER_MAX_DOCUMENT_CHARS="1800"
export FRONTAGENT_RAG_RERANKER_TIMEOUT_MS="30000"
export FRONTAGENT_RAG_EMBEDDING_MODEL="text-embedding-3-small"
export FRONTAGENT_RAG_EMBEDDING_BASE_URL="https://api.openai.com/v1"
export FRONTAGENT_RAG_EMBEDDING_API_KEY="sk-..."
export FRONTAGENT_RAG_EMBEDDING_DIMENSIONS=""
export FRONTAGENT_RAG_EMBEDDING_BATCH_SIZE="32"
export FRONTAGENT_RAG_EMBEDDING_TIMEOUT_MS="30000"
export FRONTAGENT_RAG_VECTOR_STORE_PROVIDER="weaviate"
export FRONTAGENT_RAG_WEAVIATE_URL="http://127.0.0.1:8080"
export FRONTAGENT_RAG_WEAVIATE_API_KEY=""
export FRONTAGENT_RAG_WEAVIATE_COLLECTION_PREFIX="FrontAgentRagChunk"
export FRONTAGENT_RAG_WEAVIATE_BATCH_SIZE="64"
export FRONTAGENT_RAG_WEAVIATE_TIMEOUT_MS="30000"

# Filesense 轻量级当前仓库导航
export FRONTAGENT_FILESENSE_ENABLED="true"
export FRONTAGENT_FILESENSE_OUTPUT="summary"       # summary | candidates | verbose
export FRONTAGENT_FILESENSE_WRITE_MODE="cache"     # cache | workspace | none
export FRONTAGENT_FILESENSE_MAX_ENTRIES="300"
export FRONTAGENT_FILESENSE_MAX_BYTES="131072"
export FRONTAGENT_FILESENSE_TIMEOUT_MS="3000"
```

如果 `provider=openai`，并且没有单独设置 `FRONTAGENT_RAG_EMBEDDING_BASE_URL` / `FRONTAGENT_RAG_EMBEDDING_API_KEY`，FrontAgent 会自动复用智能体 LLM 的 `base-url` 和 `api-key`。

主模型采样参数：

```bash
fa run "解释 React createElement" \
  --temperature 0.2 \
  --top-p 0.9
```

- `--temperature` 已支持。
- `--top-p` 已支持，会通过 AI SDK 通用采样参数传递。
- `--top-k` 已暴露，但是否生效取决于 provider/model。比如 Anthropic 支持，OpenAI 兼容 chat 模型通常会把它视为 unsupported。
- `repetition_penalty` 目前还没有在 FrontAgent 中暴露，因为当前 AI SDK/provider 栈没有稳定的跨 provider 通用透传路径。

在发起检索前，FrontAgent 现在会先用一条独立的大模型请求，把用户原始问题改写成更适合前端知识库检索的查询语句。这一步复用主智能体的 `provider/base-url/model/api-key`，但改写后的查询只用于 RAG，不会替换用户原始任务，也不会污染后续 Agent。

在 BM25 + embedding 初筛之后，FrontAgent 现在会默认把 Top-N 候选文档块再送到一个 `/rerank` 兼容端点做交叉编码器式重排序，进一步提升最终排序精度。只要 reranker 的 model/base-url/api-key 可用，就会自动执行；如果你要关闭，可使用 `--disable-rag-reranker`。

当 `FRONTAGENT_RAG_VECTOR_STORE_PROVIDER=weaviate` 时，FrontAgent 会继续把 BM25 保存在本地 `index.json`，但语义向量会写入并查询 Weaviate，而不是本地 `embeddings.json`。

Filesense 用作当前仓库导航 provider。FrontAgent 在准备结构、定位、创建和重构时会优先使用 `filesense_navigate`，因为它有预算控制，且避免全仓持久同步。`filesense_sync_and_summarize` 仍可用于显式索引维护，但不是常规规划路径。

预构建缓存包分发流程：

- 不要把 `.frontagent/rag-cache` 直接提交到 Git
- 先导出一个预构建缓存包，再上传到 GitHub Releases 或对象存储
- 其他使用者在第一次 query 前先导入这个缓存包即可

```bash
# 导出当前缓存目录为可分发 tar.gz 包
fa rag export

# 导出到指定路径
fa rag export --output ./artifacts/frontagent-rag-cache.tar.gz

# 从本地文件导入
fa rag import ./artifacts/frontagent-rag-cache.tar.gz --force

# 从远程 URL 导入
fa rag import https://example.com/frontagent-rag-cache.tar.gz --force
```

## 架构概览

### 系统架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FrontAgent 系统                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐          │
│  │ 用户输入    │────▶│ Agent Core  │────▶│   输出       │          │
│  └─────────────┘     └──────┬──────┘     └─────────────┘          │
│                             │                                       │
│           ┌─────────────────┼─────────────────┐                    │
│           ▼                 ▼                 ▼                    │
│  ┌────────────────┐ ┌────────────┐ ┌────────────────┐             │
│  │  SDD 层        │ │  Planner   │ │   Executor     │             │
│  │ (约束)         │ │ (阶段 1)   │ │   (阶段 2)     │             │
│  └───────┬────────┘ └─────┬──────┘ └───────┬────────┘             │
│          │                │                 │                      │
│          ▼                ▼                 ▼                      │
│  ┌──────────────────────────────────────────────────────┐         │
│  │           MCP 层（受信任接口）                        │         │
│  ├──────────────┬───────────────┬──────────────────────┤         │
│  │  MCP File    │   MCP Web     │     MCP Shell        │         │
│  └──────┬───────┴───────┬───────┴──────────┬───────────┘         │
└─────────┼───────────────┼──────────────────┼──────────────────────┘
          ▼               ▼                  ▼
   ┌──────────────┐ ┌──────────┐     ┌──────────┐
   │ 文件系统     │ │ 浏览器   │     │ Shell    │
   │ (项目)       │ │(Playwright)│   │命令      │
   └──────────────┘ └──────────┘     └──────────┘
```

### 执行流程

```
用户任务
   │
   ▼
┌──────────────────┐
│  预规划（Pre-Planning）│ ← 在规划前扫描项目结构（NEW）
│  文件扫描         │   自动检测开发服务器端口（NEW）
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Planner（阶段 1） │ ← 遵循 SDD 约束
└────────┬─────────┘   输出项目文件列表与端口信息
         │  生成带 phase 字段的执行计划
         ▼
┌──────────────────────────────────────────┐
│           Executor（阶段 2）              │
│  ┌────────────────────────────────┐      │
│  │  Phase 1: 分析                  │      │
│  │  ├─ 步骤 1 ✓                   │      │
│  │  ├─ 步骤 2 ✗（错误）          │      │
│  │  └─ 错误恢复                    │      │
│  │     ├─ 分析错误                 │      │
│  │     ├─ 生成修复步骤             │      │
│  │     └─ 执行修复 ✓              │      │
│  └────────────────────────────────┘      │
│  ┌────────────────────────────────┐      │
│  │  Phase 2: 创建                  │      │
│  │  ├─ 步骤 3 ✓                   │      │
│  │  └─ 步骤 4 ✓                   │      │
│  └────────────────────────────────┘      │
│                                           │
│  每个步骤后：                             │
│  └─ 更新 Facts（事实库）                  │
│     ├─ 文件系统状态                        │
│     ├─ 依赖状态                            │
│     ├─ 模块依赖图                          │
│     └─ 项目状态                            │
│                                           │
│  阶段完成校验：                            │
│  └─ 检查缺失模块引用                        │
│     └─ 自动生成修复步骤 ✓                 │
└───────────────────────────────────────────┘
         │
         ▼
    任务完成 ✓
```

默认阶段序列：
`阶段1-分析 -> 阶段2-创建 -> 阶段3-安装 -> 阶段4-验证/验收 -> 阶段5-启动 -> 阶段6-浏览器验证 -> 阶段7-仓库管理（git/gh）`

## 主要功能

### 1. 预规划项目扫描（NEW）

在生成执行计划前，FrontAgent 会自动扫描项目结构，提供给 LLM 更准确的文件上下文：

```typescript
// 在规划前自动执行
const projectStructure = await scanProjectFiles();
// 返回示例："Project files (245 files): src/App.tsx, src/components/Button.tsx, ..."

// LLM 获取该上下文后会生成更准确的文件路径
```

优点：
- ✅ **路径更准确** — LLM 知道现有文件并生成正确相对路径
- ✅ **减少幻觉** — 减少“文件未找到”错误
- ✅ **更好上下文** — Planner 在规划前了解项目结构

实现位置：`packages/core/src/agent/project-prescan-preparation.ts`

### 2. 自动开发服务器端口检测（NEW）

FrontAgent 会从项目配置中自动检测开发服务器端口：

```typescript
// 检测来源（优先级顺序）
// 1. vite.config.ts/js: server.port 字段
// 2. package.json 脚本: --port 或 -p 标志
// 3. 框架默认: Vite (5173), Next.js (3000), CRA (3000), Angular (4200)
// 4. 回退值: 5173

const devServerPort = await detectDevServerPort();
// 用于浏览器相关任务
```

优点：
- ✅ **自动发现端口** — 无需手动配置端口
- ✅ **框架感知** — 识别不同框架的默认端口
- ✅ **浏览器测试更可靠** — 使用正确的端口进行验证

实现位置：`packages/core/src/agent/dev-server-detection.ts`

### 3. 两阶段架构

FrontAgent 采用两阶段架构，彻底解决在生成大量代码时的 JSON 解析问题：

#### 阶段 1：Planner

- 输入：用户任务 + SDD 约束 + 项目上下文 + 项目文件列表（NEW）
- 输出：结构化执行计划（仅描述、无代码）
- 技术：使用 `generateObject` 生成符合 Zod Schema 的 JSON
- 要点：JSON 中不包含代码，避免转义与解析问题

```json
{
  "summary": "Create login page",
  "steps": [
    {
      "description": "Create Login.tsx component file",
      "action": "create_file",
      "params": {
        "path": "src/pages/Login.tsx",
        "codeDescription": "Create a React component with username, password inputs and login button"
      },
      "needsCodeGeneration": true
    }
  ]
}
```

#### 阶段 2：Executor

- 输入：结构化执行计划
- 流程：按计划逐步执行
- 代码生成：遇到 `needsCodeGeneration: true` 时使用 `generateText` 动态生成代码
- 技术：使用 MCP 工具进行文件操作、命令执行等

优势：
1. ✅ 避免 JSON 解析错误（JSON 中没有代码）
2. ✅ 更好可控（每个步骤单独校验）
3. ✅ 支持大型项目（无 JSON 大小限制）
4. ✅ 基于实时上下文的更精确代码生成

### 4. 分阶段执行与自愈

FrontAgent 实现了分阶段执行与自动错误恢复：

#### 阶段化执行

执行计划会被划分为多个阶段，每个阶段专注一个目标：

```json
{
  "steps": [ ... ]
}
```

示例（包含仓库管理阶段）：

```json
{
  "steps": [
    {
      "stepId": "step-1",
      "phase": "分析阶段",
      "description": "读取现有文件并分析项目结构",
      "action": "read_file"
    },
    {
      "stepId": "step-2",
      "phase": "创建阶段",
      "description": "创建新组件文件",
      "action": "create_file"
    },
    {
      "stepId": "step-3",
      "phase": "安装阶段",
      "description": "安装必要依赖",
      "action": "run_command"
    },
    {
      "stepId": "step-4",
      "phase": "验证阶段",
      "description": "运行测试并确认验收通过",
      "action": "run_command"
    },
    {
      "stepId": "step-5",
      "phase": "仓库管理阶段",
      "description": "提交改动、推送分支并用 gh 创建或更新 PR",
      "action": "run_command"
    }
  ]
}
```

优点：
- 🎯 **执行流程清晰**
- 🔄 **阶段内自动恢复错误**
- 📊 **进度可视化**
- 🔀 **依赖感知的阶段调度**（Phase DAG）减少错序跳步
- 🚀 **验收后自动化交付**（可选）支持仓库管理阶段

#### 工具错误反馈循环

当工具执行失败时，系统会自动分析错误并生成修复步骤：

```typescript
// 1. 发现错误
Error: Cannot apply patch: file not found in context: src/App.tsx

// 2. LLM 分析错误并生成恢复步骤
{
  "canRecover": true,
  "analysis": "File src/App.tsx not read into context, need to read it first",
  "recoverySteps": [
    {
      "description": "Read src/App.tsx into context",
      "action": "read_file",
      "tool": "filesystem",
      "params": { "path": "src/App.tsx" }
    },
    {
      "description": "Reapply patch to src/App.tsx",
      "action": "apply_patch",
      "tool": "filesystem",
      "params": { }
    }
  ]
}

// 3. 自动执行修复步骤
// 4. 继续原始流程
```

特性：
- 🔍 **智能错误分析**
- 🛠️ **自动生成修复步骤**
- 📝 **内置常见错误处理模式**
- ♻️ **阶段级别恢复，非阻塞整体流程**

### 5. LangGraph 执行引擎（NEW）

FrontAgent 现在支持可切换执行引擎：

- `native`（默认）：现有执行器流程 + 阶段 DAG 调度
- `langgraph`：通过 `StateGraph` 运行阶段流，可选启用 `MemorySaver` checkpoint

CLI 用法：

```bash
# 使用 native 引擎（默认）
fa run "添加登录页" --engine native

# 使用 LangGraph 引擎
fa run "添加登录页" --engine langgraph

# LangGraph + checkpoint + 自定义恢复重试次数
fa run "添加登录页" --engine langgraph --langgraph-checkpoint --max-recovery-attempts 5
```

### 6. Planner Skills 层（NEW）

FrontAgent 在 Planner 中新增了独立的 `skills` 层，用于封装可复用的规划能力。

- 内置任务 skill：`task.create`、`task.modify`、`task.query`、`task.debug`、`task.refactor`、`task.test`
- 内置阶段 skill：`phase.repository-management`（验收后自动注入 git/gh 流程）
- 自定义任务 skill 若命中同类条件，可覆盖内置 skill（后注册优先）
- Executor 也支持 action 级别 skill（参数规则/代码生成/错误策略）
- 支持运行时扩展自定义 skill：

```typescript
import { createAgent, type TaskPlanningSkill } from '@frontagent/core';

const agent = createAgent(config);

const customSkill: TaskPlanningSkill = {
  name: 'task.security-audit',
  supports: (task) => task.type === 'debug' && task.description.includes('安全'),
  plan: ({ stepFactory }) => [
    stepFactory.createStep({
      description: '扫描安全敏感模式',
      action: 'search_code',
      tool: 'search_code',
      params: {
        pattern: 'eval|innerHTML|dangerouslySetInnerHTML',
        filePattern: 'src/**/*.{ts,tsx,js,jsx}',
      },
    }),
  ],
};

agent.registerTaskSkill(customSkill);
console.log(agent.getPlannerSkillSnapshot());

agent.registerExecutorActionSkill({
  name: 'action.run-command.noncritical-policy',
  action: 'run_command',
  shouldSkipToolError: ({ errorMsg, params }) => {
    if (typeof params.command === 'string' && params.command.includes('echo')) {
      return true;
    }
    return errorMsg.includes('already exists');
  },
});
console.log(agent.getExecutorSkillSnapshot());
```

### 7. 基于事实的上下文系统

传统 agent 使用执行日志作为上下文，导致冗余与不准确；FrontAgent 使用结构化的“事实”系统：

示例（简化）:

```yaml
## 文件系统状态

### 确认存在的文件：
- src/App.tsx
- src/components/Button.tsx
- package.json

### 确认不存在的路径：
- src/pages/Login.tsx

## 依赖状态

### 已安装包：
react-router-dom, axios

### 缺失包：
@types/node

## 已创建模块

### component（3 个模块）：
- src/components/ui/Button.tsx (默认导出 Button)
- src/components/ui/Card.tsx (默认导出 Card)
- src/components/layout/Header.tsx (导出 Header, Navigation)

### page（2 个模块）：
- src/pages/HomePage.tsx (默认导出 HomePage)
- src/pages/LoginPage.tsx (默认导出 LoginPage)

### ⚠️ 缺失模块引用：
- src/pages/HomePage.tsx 引用了不存在的模块：../components/ui/Spinner

## 项目状态
- Dev server: Running (port: 5173) ← 自动检测
- Build status: Success

## 最近错误
- [apply_patch] Cannot apply patch: file not found in context
```

优点：
- 📊 **结构化信息**：清晰分类（文件系统、依赖、模块图、项目状态）
- 🎯 **去重**：使用 Set/Map 自动去重
- 💡 **上下文感知**：LLM 知道哪些文件存在/不存在
- 🔄 **实时更新**：每次工具执行后自动更新 facts
- 📉 **减少 token 使用**：信息简洁，缩短 LLM 输入
- 🔗 **模块跟踪**：自动解析每个文件的 import/export

### 8. 跨会话记忆系统（NEW）

FrontAgent 现在实现了四阶段记忆架构，能够跨任务运行持久化知识，让 Agent 不再每次从零开始。

#### 架构

记忆系统将上下文视为一条时序流水线：

1. **阶段 1 — 启动预加载**：在规划前加载持久化记忆并从上次快照恢复 `ProjectFacts`
2. **阶段 2 — 运行时召回**：在代码生成阶段根据文件路径、标签和关键词动态召回相关记忆
3. **阶段 3 — 任务后持久化**：每次任务完成后提取并保存持久化经验（已创建文件、错误修复、依赖变更）
4. **阶段 4 — 压缩**：待多轮交互模式加入后实现

#### 存储布局

```
<projectRoot>/.frontagent/memory/
  MEMORY.md              # 索引入口（简洁的主题列表）
  topics/
    project-structure.md  # 文件系统布局、关键模块
    dependencies.md       # 包、版本、已知问题
    errors.md             # 历史错误修复记录
  snapshots/
    facts-latest.json     # 最新 ProjectFacts 快照
```

所有记忆文件均为人类可读的 Markdown（可直接查看和编辑）。Facts 快照使用 JSON 以提高效率。

#### Prompt 分区

系统 prompt 现在被结构化为三个独立区域，各自拥有独立的 token 预算：

1. **Rules 区** — SDD 约束、行为指令（单任务内不可变）
2. **Memory 区** — 从 `.frontagent/memory/` 加载的持久化项目知识
3. **Context 区** — 动态的任务级数据（文件、RAG 结果、技能、事实）

#### 关键设计决策

- **单写者模式**：所有写入均通过 `MemoryStore`，避免并发冲突
- **去重追踪**：每个会话维护 `injectedKeys` 集合，防止重复注入相同记忆
- **预算控制**：可配置的字符限制 — 预加载默认 8000 字符，单步召回默认 2000 字符
- **非阻塞持久化**：记忆写入不在关键路径上，错误会被完全吞掉
- **向后兼容**：没有历史记忆的新项目运行行为与之前完全一致

#### 配置

```typescript
const agent = createAgent({
  // ...其他配置
  memory: {
    enabled: true,                // 默认: true
    preloadBudgetChars: 8000,     // 启动时注入的最大字符数
    recallBudgetChars: 2000,      // 单次代码生成召回的最大字符数
    maxTopicFiles: 10,            // 启动时加载的最大主题文件数
  },
});
```

实现位置：`packages/core/src/memory/`

## 核心模块

### @frontagent/sdd — SDD 控制层

将 Specification Driven Development (SDD) 作为 agent 行为的硬约束：

```yaml
# sdd.yaml（示例）
version: "1.0"

project:
  name: "my-project"
  type: "react-spa"

tech_stack:
  framework: "react"
  version: "^18.0.0"
  language: "typescript"
  forbidden_packages:
    - "jquery"
    - "lodash"

code_quality:
  max_function_lines: 50
  max_file_lines: 300
  forbidden_patterns:
    - "any"
    - "// @ts-ignore"

modification_rules:
  protected_files:
    - "package.json"
  require_approval:
    - pattern: "src/api/*"
      reason: "API 层修改需审批"
```

### @frontagent/mcp-file — 文件操作 MCP

提供文件操作相关的 MCP 工具：

- `read_file`：读取文件内容
- `list_directory`：列出目录内容（支持递归）
- `create_file`：创建新文件（两阶段：从描述生成代码）
- `apply_patch`：应用代码补丁（两阶段：从描述生成改动）
- `search_code`：搜索代码
- `get_ast`：获取 AST 分析
- `rollback`：回滚改动

### @frontagent/mcp-shell — Shell 命令 MCP

提供终端命令执行（需用户批准）：

- `run_command`：执行 shell 命令
  - 支持自定义工作目录
  - 支持超时设置
  - 执行前需要用户批准
  - 自动区分 warning 和 error
  - 适用场景：`npm install`、`git init`、`pnpm build` 等

### @frontagent/mcp-web — Web 感知 MCP

提供浏览器交互工具：

- `browser_navigate`：导航到 URL
- `get_page_structure`：获取页面 DOM 结构
- `get_accessibility_tree`：获取 accessibility tree
- `get_interactive_elements`：获取可交互元素
- `browser_click` / `browser_type` / `browser_scroll`：页面交互
- `browser_screenshot`：页面截图
- `browser_wait_for_selector`：等待元素可用

### @frontagent/hallucination-guard — 幻觉防护

多层幻觉检测：

1. 文件存在性检查
2. import 可解析性检查
3. 语法有效性检验
4. SDD 合规性检查

## 技术栈

- 语言：TypeScript
- 运行时：Node.js 20+
- 包管理器：pnpm
- MCP SDK：@modelcontextprotocol/sdk
- 浏览器自动化：Playwright
- AST 分析：ts-morph
- LLM 集成：Vercel AI SDK

## 目录结构（概览）

```
frontagent/
├── packages/
│   ├── shared/              # 共享类型与工具
│   ├── sdd/                 # SDD 控制层
│   ├── mcp-file/            # 文件操作 MCP client
│   ├── mcp-web/             # Web 感知 MCP client
│   ├── mcp-shell/           # Shell 命令 MCP client
│   ├── hallucination-guard/ # 幻觉防护
│   └── core/                # Agent 核心（两阶段架构）
│       └── memory/          # 跨会话记忆系统
├── apps/
│   └── cli/                 # CLI 工具
├── examples/
│   ├── sdd-example.yaml     # SDD 配置示例
│   └── e-commerce-frontend/ # 电商前端示例
└── docs/
    ├── architecture.md      # 架构设计
    └── design.md            # 原始需求
```

## 使用示例

### 示例 1：创建新项目

```bash
cd examples
fa run "Create an e-commerce frontend project using React + TypeScript + Vite + Tailwind CSS"
```

流程会自动：分析需求 → 生成执行计划 → 创建 package.json 与配置 → 请求安装依赖（需用户批准）→ 生成页面与样式

### 示例 2：修改现有文件

```bash
fa run "Modify vite.config.ts to add path alias configuration"
```

Agent 会：读取现有配置 → 生成新配置代码 → 应用最小补丁

### 示例 3：添加新功能

```bash
fa run "Add user authentication feature, including login, registration, and token management"
```

Agent 会：分析项目结构 → 规划要创建的文件 → 生成认证相关组件与 API 集成 → 更新路由配置

### 示例 4：性能优化

```bash
fa run "Analyze and optimize homepage loading performance"
```

Agent 会：读取相关组件 → 分析性能瓶颈 → 提出优化方案 → 实施代码级优化（懒加载、代码拆分等）

### 示例 5：自动错误恢复

```bash
fa run "Add route configuration in App.tsx"
```

执行过程示例：

```
Phase 1: Analysis Phase
  ✓ Step 1: Read package.json

Phase 2: Creation Phase
  ✗ Step 2: Modify App.tsx
     Error: Cannot apply patch: file not found in context

  🔄 Error recovery in progress...
     Analysis: App.tsx not read into context

  ✓ Recovery Step 1: Read src/App.tsx into context
  ✓ Recovery Step 2: Reapply patch to App.tsx

Phase 3: Validation Phase
  ✓ Step 3: Run type check

✅ Task complete! Auto-fixed 1 error
```

关键特点：
- 🎯 **分阶段执行**
- 🔄 **自动修复**
- 📊 **事实跟踪**
- ⚡ **一次完成，无需重试**

### 示例 6：启用 LangGraph 引擎

```bash
fa run "实现用户资料页并创建 PR" \
  --type create \
  --engine langgraph \
  --langgraph-checkpoint \
  --max-recovery-attempts 5
```

说明：
- `--engine langgraph`：启用图编排执行流
- `--langgraph-checkpoint`：启用本次运行的内存 checkpoint
- 验收通过后，可进入仓库管理阶段自动执行 `git/gh` 流程

## 环境变量

### 必需配置

| 变量 | 含义 | 示例 |
|------|------|------|
| PROVIDER | LLM 提供商 | openai / anthropic |
| API_KEY  | API Key | sk-... |
| MODEL    | 模型名 | gpt-4 / claude-sonnet-4-20250514 |
| BASE_URL | API 地址 | https://api.openai.com/v1 |
| EXECUTION_ENGINE | 执行引擎 | native / langgraph |
| LANGGRAPH_CHECKPOINT | 是否启用 LangGraph checkpoint | true / false |
| MAX_RECOVERY_ATTEMPTS | 每阶段最大恢复重试次数 | 3 |

### OpenAI 配置示例

```bash
export PROVIDER="openai"
export BASE_URL="https://api.openai.com/v1"
export MODEL="gpt-4"
export API_KEY="sk-..."
```

### Anthropic 配置示例

```bash
export PROVIDER="anthropic"
export BASE_URL="https://api.anthropic.com"
export MODEL="claude-sonnet-4-20250514"
export API_KEY="sk-ant-..."
```

## 开发

```bash
# 开发模式
pnpm dev

# 类型检查
pnpm typecheck

# 构建
pnpm build

# 清理
pnpm clean
```

## 路线图

### 已完成 ✅

- 两阶段架构（Planner + Executor）
- 分阶段执行
- 工具错误反馈循环（自愈）
- 基于事实的上下文系统
- 模块依赖图
- 生成后校验
- 路径幻觉检测
- 多 LLM 提供商支持（OpenAI, Anthropic）
- Shell 命令执行（需批准）
- 动态代码生成（避免 JSON 解析错误）
- MCP 工具集成（File, Web, Shell）
- 类型自动归一化
- 支持无限步任务
- LLM schema 约束优化与自动修复策略
- 预规划文件扫描（NEW）
- 自动开发端口检测（NEW）
- 依赖感知的阶段 DAG 调度（NEW）
- LangGraph 执行引擎（可选）（NEW）
- 仓库管理阶段（git/gh 自动化）（NEW）
- 跨会话记忆系统（NEW）— 四阶段持久化记忆 + 结构化 Markdown 存储 + 运行时召回 + Prompt 分区
- Planner 蒸馏模型 — 基于 FrontAgent Planner 提示词 SFT 微调，发布在 [FrontAgent: Frontend Engineering Agent](https://hf.co/collections/ceilf6/frontagent-frontend-engineering-agent) Hugging Face collection，训练与发布资产位于 [models/frontagent-planner](../models/frontagent-planner)
- VS Code 插件 — 侧边栏任务台、当前文件/选区上下文、SDD 命令、安全配置、运行日志和打包后的 Marketplace 产物
- 本地 stdio MCP Server — 面向 Host 的 FrontAgent 任务、规划、状态、skill 和 SDD 工具，并采用 fail-closed 的内部执行安全模型
- Filesense 仓库导航 — 有预算控制的当前仓库结构查找，支持生成 JSON schemas，并显式提供 cache/workspace/none 写入模式
- OSS Harness 质量门禁 — Bootstrap、local contract、precommit、CI、GitNexus 和 workflow-rule checks

### 进行中 🚧

- 增强的 SDD 约束（更细粒度规则）

### 计划中 📋

- 记忆驱动模式学习（从历史任务自动提取编码习惯）
- 基于 Playwright 的 GUI 自动化测试
- 多 agent 协作
- 自定义 MCP 服务支持
- 代码审查模式
- 增量更新模式

## 友情链接

- [Linux.do](https://linux.do/) - 学 AI，上 L 站。
- [Aionui](https://github.com/iOfficeAI/AionUi) - 手机远程控制 AI 干活，token 依赖患者福音。
- [OfficeCLI](https://github.com/iOfficeAI/OfficeCLI) - 专为 AI 智能体设计的 Office 套件。
- [deepseek-pp](https://github.com/zhu1090093659/deepseek-pp) - DeepSeek 网页对话浏览器扩展插件。
- [MuseAI](https://github.com/yejiming/MuseAI) - 本地 AI 伴侣、文字冒险与穿书互动应用。
- [RedBox](https://github.com/Jamailar/RedBox) - 面向小红书创作者的本地化 AI 创作工作台。
- [taichuy/1flowbase](https://github.com/taichuy/1flowbase) - 多模型工作流虚拟模型网关，可发布 OpenAI/Claude 兼容端点并查看 trace、token、延迟和成本。

## 贡献

欢迎贡献！提交 issue、bug 或建议：

1. Fork 仓库
2. 新建分支 `git checkout -b feature/amazing-feature`
3. 提交改动 `git commit -m 'Add amazing feature'`
4. 推送分支 `git push origin feature/amazing-feature`
5. 发起 Pull Request

## 许可

MIT
