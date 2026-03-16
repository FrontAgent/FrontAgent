# FrontAgent

[![npm version](https://badge.fury.io/js/frontagent.svg)](https://www.npmjs.com/package/frontagent)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org)

> 面向前端工程的企业级 AI Agent 系统 — 以 SDD 为约束、通过 MCP 控制感知与执行

[English README](../README.md) | [快速开始](QUICKSTART.md) | [架构](architecture.md) | [设计文档](design.md)

FrontAgent 是一个专为前端工程设计的 AI Agent 系统，解决了在真实工程场景中部署 agent 时遇到的核心问题：

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
- ✅ **LangGraph 引擎（可选）** — 可切换图执行引擎并支持可选 checkpoint
- ✅ **Planner Skills 层** — 可复用的规划技能封装（任务拆解与阶段注入）
- ✅ **仓库管理阶段** — 验收通过后自动执行 git/gh 流程（commit/push/PR）

## TL;DR

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
frontagent init

# 4. 让 AI 帮你完成任务
frontagent run "创建用户登录页面"
frontagent run "优化首页加载性能"
frontagent run "添加深色模式支持"
# 使用 LangGraph 引擎 + checkpoint（可选）
frontagent run "添加路由守卫并创建 PR" --engine langgraph --langgraph-checkpoint
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

实现位置：packages/core/src/agent.ts:217-255

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

实现位置：packages/core/src/agent.ts:732-793

### 3. 两阶段架构

FrontAgent 采用两阶段架构，彻底解决在生成大量代码时的 JSON 解析问题：

阶段 1：Planner
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

阶段 2：Executor
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

阶段化执行：

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

工具错误反馈循环：

当工具执行失败时，系统会自动分析错误并生成修复步骤：

```typescript
// 1. 发现错误
Error: Cannot apply patch: file not found in context: src/App.tsx

// 2. LLM 分析错误并生成恢复步骤
{
  "canRecover": true,
  "analysis": "File src/App.tsx not read into context, need to read it first",
  "recoverySteps": [ ... ]
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
frontagent run "添加登录页" --engine native

# 使用 LangGraph 引擎
frontagent run "添加登录页" --engine langgraph

# LangGraph + checkpoint + 自定义恢复重试次数
frontagent run "添加登录页" --engine langgraph --langgraph-checkpoint --max-recovery-attempts 5
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

确认存在的文件:
- src/App.tsx
- src/components/Button.tsx
- package.json

确认不存在的路径:
- src/pages/Login.tsx

依赖状态:
已安装: react-router-dom, axios
缺失: @types/node

创建的模块示例:
- src/components/ui/Button.tsx (默认导出 Button)
- src/pages/HomePage.tsx (默认导出 HomePage)

项目状态:
- Dev server: Running (port: 5173) ← 自动检测
- Build status: Success

最近错误:
- [apply_patch] Cannot apply patch: file not found in context
```

优点：
- 📊 **结构化信息**：清晰分类（文件系统、依赖、模块图、项目状态）
- 🎯 **去重**：使用 Set/Map 自动去重
- 💡 **上下文感知**：LLM 知道哪些文件存在/不存在
- 🔄 **实时更新**：每次工具执行后自动更新 facts
- 📉 **减少 token 使用**：信息简洁，缩短 LLM 输入
- 🔗 **模块跟踪**：自动解析每个文件的 import/export

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

- `read_file`, `list_directory`, `create_file`, `apply_patch`, `search_code`, `get_ast`, `rollback`

### @frontagent/mcp-shell — Shell 命令 MCP

提供终端命令执行（需用户批准）：

- `run_command`：支持自定义工作目录、超时、区分警告/错误等

### @frontagent/mcp-web — Web 感知 MCP

提供浏览器交互工具：

- `browser_navigate`, `get_page_structure`, `get_accessibility_tree`, `get_interactive_elements`, `browser_click`, `browser_type`, `browser_scroll`, `browser_screenshot`, `browser_wait_for_selector`

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
│   ├── shared/
│   ├── sdd/
│   ├── mcp-file/
│   ├── mcp-web/
│   ├── mcp-shell/
│   ├── hallucination-guard/
│   └── core/
├── apps/
│   └── cli/
├── examples/
└── docs/
    ├── architecture.md
    └── design.md
```

## 使用示例

### 示例 1：创建新项目

```bash
cd examples
frontagent run "Create an e-commerce frontend project using React + TypeScript + Vite + Tailwind CSS"
```

流程会自动：分析需求 → 生成执行计划 → 创建 package.json 与配置 → 请求安装依赖（需用户批准）→ 生成页面与样式

### 示例 2：修改现有文件

```bash
frontagent run "Modify vite.config.ts to add path alias configuration"
```

Agent 会：读取现有配置 → 生成新配置代码 → 应用最小补丁

### 示例 3：添加新功能

```bash
frontagent run "Add user authentication feature, including login, registration, and token management"
```

Agent 会：分析项目结构 → 规划要创建的文件 → 生成认证相关组件与 API 集成 → 更新路由配置

### 示例 4：性能优化

```bash
frontagent run "Analyze and optimize homepage loading performance"
```

Agent 会：读取相关组件 → 分析性能瓶颈 → 提出优化方案 → 实施代码级优化（懒加载、代码拆分等）

### 示例 5：自动错误恢复

```bash
frontagent run "Add route configuration in App.tsx"
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
frontagent run "实现用户资料页并创建 PR" \
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

必需配置：

| 变量 | 含义 | 示例 |
|------|------|------|
| PROVIDER | LLM 提供商 | openai / anthropic |
| API_KEY  | API Key | sk-... |
| MODEL    | 模型名 | gpt-4 / claude-sonnet-4-20250514 |
| BASE_URL | API 地址 | https://api.openai.com/v1 |
| EXECUTION_ENGINE | 执行引擎 | native / langgraph |
| LANGGRAPH_CHECKPOINT | 是否启用 LangGraph checkpoint | true / false |
| MAX_RECOVERY_ATTEMPTS | 每阶段最大恢复重试次数 | 3 |

OpenAI 示例：

```bash
export PROVIDER="openai"
export BASE_URL="https://api.openai.com/v1"
export MODEL="gpt-4"
export API_KEY="sk-..."
```

Anthropic 示例：

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

已完成 ✅
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

进行中 🚧
- 增强的 SDD 约束（更细粒度规则）

计划中 📋
- RAG 经验库集成
- 基于 Playwright 的 GUI 自动化测试
- VS Code 插件
- 多 agent 协作
- 自定义 MCP 服务支持
- 代码审查模式
- 增量更新模式

## 贡献

欢迎贡献！提交 issue、bug 或建议：

1. Fork 仓库
2. 新建分支 `git checkout -b feature/amazing-feature`
3. 提交改动 `git commit -m 'Add amazing feature'`
4. 推送分支 `git push origin feature/amazing-feature`
5. 发起 Pull Request

## 许可

MIT
