# FrontAgent

> 工程级 AI Agent 系统 - 以 SDD 为约束，通过 MCP 实现可控感知与执行

[快速开始](docs/QUICKSTART.md) | [架构文档](docs/architecture.md) | [设计文档](docs/design.md)

FrontAgent 是一个专为前端工程设计的 AI Agent 系统，旨在解决 Agent 在真实工程中落地时面临的核心问题：

- ✅ **两阶段架构** - 规划与执行分离，避免 JSON 解析错误，动态生成代码
- ✅ **幻觉防控** - 多层次的幻觉检测与拦截机制
- ✅ **SDD 约束** - 以软件设计文档作为 Agent 行为的硬约束
- ✅ **MCP 协议** - 通过 Model Context Protocol 实现可控的工具调用
- ✅ **最小修改** - 基于补丁的代码修改，支持回滚
- ✅ **Web 感知** - 通过浏览器 MCP 理解页面结构
- ✅ **Shell 集成** - 支持终端命令执行（需用户批准）

## TL;DR

```bash
# 1. 安装
git clone <repo>
cd frontagent
pnpm install
pnpm build
npm link

# 2. 配置 LLM（支持 OpenAI 和 Anthropic）
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

# 3. 进入目标工程目录，初始化 SDD
cd your-project
frontagent init

# 4. 让 AI 帮你完成任务
frontagent run "创建一个用户登录页面"
frontagent run "优化首页的加载性能"
frontagent run "添加暗黑模式支持"
```

## 架构概览

### 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FrontAgent System                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐           │
│  │ User Input  │────▶│ Agent Core  │────▶│   Output    │           │
│  └─────────────┘     └──────┬──────┘     └─────────────┘           │
│                             │                                        │
│           ┌─────────────────┼─────────────────┐                     │
│           ▼                 ▼                 ▼                     │
│  ┌────────────────┐ ┌────────────┐ ┌────────────────┐              │
│  │  SDD Layer     │ │  Planner   │ │   Executor     │              │
│  │ (Constraints)  │ │ (Stage 1)  │ │   (Stage 2)    │              │
│  └───────┬────────┘ └─────┬──────┘ └───────┬────────┘              │
│          │                │                 │                       │
│          ▼                ▼                 ▼                       │
│  ┌──────────────────────────────────────────────────────┐          │
│  │           MCP Layer (Trusted Interface)               │          │
│  ├──────────────┬───────────────┬──────────────────────┤          │
│  │  MCP File    │   MCP Web     │     MCP Shell        │          │
│  └──────┬───────┴───────┬───────┴──────────┬───────────┘          │
└─────────┼───────────────┼──────────────────┼────────────────────────┘
          ▼               ▼                  ▼
   ┌──────────────┐ ┌──────────┐     ┌──────────┐
   │  File System │ │ Browser  │     │  Shell   │
   │  (Project)   │ │(Playwright)│    │Commands  │
   └──────────────┘ └──────────┘     └──────────┘
```

### 两阶段架构设计

FrontAgent 采用创新的两阶段架构，彻底解决了 AI Agent 在生成大量代码时的 JSON 解析错误问题：

#### Stage 1: Planner（规划阶段）
- **输入**: 用户任务 + SDD 约束 + 项目上下文
- **输出**: 结构化执行计划（只包含描述，不包含代码）
- **技术**: 使用 `generateObject` 生成符合 Zod Schema 的 JSON
- **关键**: 不在 JSON 中包含任何代码，避免转义和解析问题

```json
{
  "summary": "创建登录页面",
  "steps": [
    {
      "description": "创建 Login.tsx 组件文件",
      "action": "create_file",
      "params": {
        "path": "src/pages/Login.tsx",
        "codeDescription": "创建一个包含用户名、密码输入框和登录按钮的 React 组件"
      },
      "needsCodeGeneration": true
    }
  ]
}
```

#### Stage 2: Executor（执行阶段）
- **输入**: 结构化执行计划
- **过程**: 逐步执行计划中的每个步骤
- **代码生成**: 遇到 `needsCodeGeneration: true` 的步骤时，使用 `generateText` 动态生成代码
- **技术**: 使用 MCP 工具执行文件操作、命令运行等

**优势**:
1. ✅ 彻底避免 JSON 解析错误（代码不在 JSON 中）
2. ✅ 更好的可控性（每个步骤单独验证）
3. ✅ 支持大型项目（无 JSON 大小限制）
4. ✅ 更精确的代码生成（基于实时上下文）

## 核心模块

### @frontagent/sdd - SDD 控制层

软件设计文档（SDD）作为 Agent 行为的硬约束来源：

```yaml
# sdd.yaml
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
      reason: "API 层修改需要审批"
```

### @frontagent/mcp-file - 文件操作 MCP

提供文件操作的 MCP 工具：

- `read_file` - 读取文件内容
- `list_directory` - 列出目录内容（支持递归）
- `create_file` - 创建新文件（两阶段架构：通过描述生成代码）
- `apply_patch` - 应用代码补丁（两阶段架构：通过描述生成修改）
- `search_code` - 搜索代码
- `get_ast` - 获取 AST 分析
- `rollback` - 回滚修改

### @frontagent/mcp-shell - Shell 命令 MCP

提供终端命令执行能力（需用户批准）：

- `run_command` - 执行 Shell 命令
  - 支持自定义工作目录
  - 支持超时设置
  - 命令执行前需用户批准
  - 自动区分警告和错误
  - 适用场景：`npm install`、`git init`、`pnpm build` 等

**使用示例**:
```typescript
// Agent 会请求用户批准后执行
await runCommand({
  command: "npm install",
  workingDirectory: "/path/to/project"
});
```

### @frontagent/mcp-web - Web 感知 MCP

提供浏览器交互的 MCP 工具：

- `navigate` - 导航到 URL
- `get_page_structure` - 获取页面 DOM 结构
- `get_accessibility_tree` - 获取无障碍树
- `get_interactive_elements` - 获取可交互元素
- `click` / `type` / `scroll` - 页面交互
- `screenshot` - 页面截图

### @frontagent/hallucination-guard - 幻觉防控

多层次的幻觉检测机制：

1. **文件存在性检查** - 验证引用的文件是否存在
2. **导入有效性检查** - 验证 import 是否可解析
3. **语法有效性检查** - 验证代码语法是否正确
4. **SDD 合规性检查** - 验证是否符合 SDD 约束

## 幻觉防控设计

### 幻觉来源与防控策略

| 幻觉类型 | 产生位置 | 防控机制 |
|---------|---------|---------|
| 文件幻觉 | Planner | 执行前校验文件存在性 |
| API 幻觉 | Planner | 导入有效性检查 |
| 语法幻觉 | Executor | AST 解析验证 |
| 依赖幻觉 | Executor | package.json 检查 |
| 规范幻觉 | Planner | SDD 合规性校验 |

### 防控层次

```
Layer 1: SDD 预约束
    └── 在 System Prompt 中注入约束
    
Layer 2: 规划时校验
    └── 验证计划是否符合 SDD
    
Layer 3: 执行时校验
    └── 每个工具调用前后验证
    
Layer 4: 输出时校验
    └── 最终输出全量验证
    
Layer 5: 回滚机制
    └── 校验失败自动回滚
```

## 技术栈

- **语言**: TypeScript
- **运行时**: Node.js 20+
- **包管理**: pnpm
- **MCP SDK**: @modelcontextprotocol/sdk
- **浏览器自动化**: Playwright
- **AST 分析**: ts-morph
- **LLM 集成**: Vercel AI SDK

## 目录结构

```
frontagent/
├── packages/
│   ├── shared/              # 共享类型和工具
│   ├── sdd/                 # SDD 控制层
│   ├── mcp-file/            # 文件操作 MCP Client
│   ├── mcp-web/             # Web 感知 MCP Client
│   ├── mcp-shell/           # Shell 命令 MCP Client
│   ├── hallucination-guard/ # 幻觉防控
│   └── core/                # Agent 核心（两阶段架构）
├── apps/
│   └── cli/                 # CLI 工具
├── examples/
│   ├── sdd-example.yaml     # SDD 配置示例
│   └── e-commerce-frontend/ # 电商前端示例项目
└── docs/
    ├── architecture.md      # 架构设计文档
    └── design.md            # 原始需求
```

## 使用示例

### 示例 1: 创建新项目

```bash
cd examples
frontagent run "创建一个电商前端项目，使用 React + TypeScript + Vite + Tailwind CSS"
```

Agent 会自动：
1. 分析项目需求
2. 生成执行计划
3. 创建 package.json 和配置文件
4. 请求执行 `npm install`（需用户批准）
5. 生成页面组件和样式文件

### 示例 2: 修改现有文件

```bash
frontagent run "修改 vite.config.ts，添加路径别名配置"
```

Agent 会：
1. 读取现有 vite.config.ts 文件
2. 理解当前配置
3. 生成新的配置代码
4. 应用最小化补丁

### 示例 3: 添加新功能

```bash
frontagent run "添加用户认证功能，包括登录、注册、Token 管理"
```

Agent 会：
1. 分析现有项目结构
2. 规划需要创建的文件
3. 生成认证相关组件
4. 创建 API 集成代码
5. 更新路由配置

### 示例 4: 性能优化

```bash
frontagent run "分析并优化首页的加载性能"
```

Agent 会：
1. 读取相关组件代码
2. 分析性能问题
3. 提出优化方案
4. 实施代码级优化（懒加载、代码分割等）

## 环境变量配置

### 必需配置

| 变量 | 说明 | 示例值 |
|------|------|--------|
| `PROVIDER` | LLM 提供商 | `openai` 或 `anthropic` |
| `API_KEY` | API 密钥 | `sk-...` |
| `MODEL` | 模型名称 | `gpt-4` 或 `claude-sonnet-4-20250514` |
| `BASE_URL` | API 端点 | `https://api.openai.com/v1` |

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

### 自定义 LLM 端点

```bash
# 使用本地 LLM 服务
export PROVIDER="openai"
export BASE_URL="http://localhost:8000/v1"
export MODEL="your-model-name"
export API_KEY="local-key"
```

## 常见问题

### Q: 如何配置不同的 LLM 模型？

A: 通过 `PROVIDER` 环境变量切换。FrontAgent 支持任何兼容 OpenAI 或 Anthropic API 的服务。

### Q: Agent 会自动执行危险命令吗？

A: 不会。所有 Shell 命令（如 `npm install`、`rm -rf` 等）都需要用户明确批准才会执行。

### Q: 如何回滚 Agent 的修改？

A: 使用 `rollback` 工具可以撤销最近的修改。建议在使用 FrontAgent 前先提交代码到 Git。

### Q: SDD 文件是必需的吗？

A: 不是必需的，但强烈建议使用。SDD 约束可以让 Agent 的行为更符合项目规范，减少幻觉。

### Q: 支持哪些前端框架？

A: 理论上支持所有前端框架（React、Vue、Angular、Svelte 等），因为 Agent 是基于文本和 AST 分析的。

### Q: 如何处理 Agent 生成的错误代码？

A: FrontAgent 内置了多层幻觉防控机制，会在执行前校验：
- 文件存在性
- 语法正确性
- SDD 合规性
- 依赖可用性

如果发现错误，可以使用 `frontagent run "修复上一次生成的代码错误"` 让 Agent 自我修正。

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
- [x] 两阶段 Agent 架构（Planner + Executor）
- [x] 多 LLM 提供商支持（OpenAI、Anthropic）
- [x] Shell 命令执行（带用户批准机制）
- [x] 动态代码生成（避免 JSON 解析错误）
- [x] MCP 工具集成（File、Web、Shell）
- [x] 类型自动规范化（处理 LLM 输出不确定性）

### 进行中 🚧
- [ ] SDD 约束增强（更细粒度的规则控制）
- [ ] 幻觉防控优化（更智能的验证机制）
- [ ] 上下文管理优化（更高效的文件缓存）

### 计划中 📋
- [ ] RAG 经验库集成（从历史任务中学习）
- [ ] GUI Agent 自动测试（基于 Playwright）
- [ ] VS Code 插件（IDE 内直接使用）
- [ ] 多 Agent 协作（大型任务分解）
- [ ] 自定义 MCP Server 支持（用户自定义工具）
- [ ] 代码审查模式（自动检查代码质量）
- [ ] 增量更新模式（只修改必要的部分）

## 快速参考

### 常用命令

```bash
# 初始化项目
frontagent init

# 执行任务
frontagent run "任务描述"

# 查看帮助
frontagent --help
```

### 环境变量速查

```bash
# 必需变量
export PROVIDER="anthropic"           # 或 "openai"
export API_KEY="your-api-key"
export MODEL="claude-sonnet-4-20250514"
export BASE_URL="https://api.anthropic.com"
```

### 项目初始化模板

```bash
# React + TypeScript + Vite
frontagent run "创建 React TypeScript 项目，使用 Vite 构建"

# Vue 3 + TypeScript
frontagent run "创建 Vue 3 TypeScript 项目"

# Next.js 项目
frontagent run "创建 Next.js 项目，支持 App Router"
```

## 贡献指南

欢迎贡献代码、报告问题或提出建议！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启 Pull Request

## License

MIT

