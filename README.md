# FrontAgent

> 工程级 AI Agent 系统 - 以 SDD 为约束，通过 MCP 实现可控感知与执行

FrontAgent 是一个专为前端工程设计的 AI Agent 系统，旨在解决 Agent 在真实工程中落地时面临的核心问题：

- ✅ **幻觉防控** - 多层次的幻觉检测与拦截机制
- ✅ **SDD 约束** - 以软件设计文档作为 Agent 行为的硬约束
- ✅ **MCP 协议** - 通过 Model Context Protocol 实现可控的工具调用
- ✅ **最小修改** - 基于补丁的代码修改，支持回滚
- ✅ **Web 感知** - 通过浏览器 MCP 理解页面结构

## 架构概览

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
│  │ (Constraints)  │ │ (ReAct)    │ │ (Tool Invoker) │              │
│  └───────┬────────┘ └─────┬──────┘ └───────┬────────┘              │
│          │                │                 │                       │
│          ▼                ▼                 ▼                       │
│  ┌──────────────────────────────────────────────────────┐          │
│  │           MCP Layer (Trusted Interface)               │          │
│  ├──────────────────┬───────────────────────────────────┤          │
│  │  MCP Web Adapter │     MCP File Adapter              │          │
│  └────────┬─────────┴──────────────┬────────────────────┘          │
└───────────┼────────────────────────┼────────────────────────────────┘
            ▼                        ▼
     ┌──────────────┐        ┌──────────────┐
     │   Browser    │        │  File System │
     │ (Playwright) │        │  (Project)   │
     └──────────────┘        └──────────────┘
```

## 快速开始

### 安装

```bash
# 克隆仓库
git clone https://github.com/your-org/frontagent.git
cd frontagent

# 安装依赖
pnpm install

# 构建
pnpm build
```

### 初始化项目 SDD

```bash
# 在你的项目目录中
pnpm frontagent init

# 这会创建 sdd.yaml 配置文件
```

### 验证 SDD 配置

```bash
pnpm frontagent validate sdd.yaml
```

### 运行 Agent 任务

```bash
# 查询任务
pnpm frontagent run "查找所有使用了 useState 的组件"

# 修改任务
pnpm frontagent run "添加 loading 状态到 Button 组件" \
  --type modify \
  --files src/components/Button.tsx

# 创建任务
pnpm frontagent run "创建一个 Modal 组件" \
  --type create \
  --files src/components/Modal.tsx
```

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
- `apply_patch` - 应用代码补丁（最小 diff）
- `create_file` - 创建新文件
- `search_code` - 搜索代码
- `list_directory` - 列出目录
- `get_ast` - 获取 AST 分析
- `rollback` - 回滚修改

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
│   ├── mcp-file/            # 文件操作 MCP Server
│   ├── mcp-web/             # Web 感知 MCP Server
│   ├── hallucination-guard/ # 幻觉防控
│   └── core/                # Agent 核心
├── apps/
│   └── cli/                 # CLI 工具
├── examples/
│   └── sdd-example.yaml     # SDD 配置示例
└── docs/
    ├── architecture.md      # 架构设计文档
    └── design.md            # 原始需求
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

## 配置 LLM

FrontAgent 支持 OpenAI 和 Anthropic（Claude）两种 LLM 提供商。

### 方式 1: 环境变量（推荐）

```bash
# 配置 Anthropic Claude Sonnet 4.5
export ANTHROPIC_API_KEY=sk-ant-xxx
export MODEL=claude-sonnet-4-5-20250929

# 配置 OpenAI GPT-4
export OPENAI_API_KEY=sk-xxx
export MODEL=gpt-4-turbo

# 使用自定义代理
export ANTHROPIC_BASE_URL=https://your-proxy.com
# 或使用通用配置
export BASE_URL=https://your-proxy.com
export API_KEY=your-key
```

### 方式 2: CLI 参数

```bash
# 使用 Claude Sonnet 4.5
frontagent run "创建按钮组件" \
  --provider anthropic \
  --model claude-sonnet-4-5-20250929 \
  --api-key sk-ant-xxx

# 使用 GPT-4 通过代理
frontagent run "修复 bug" \
  --provider openai \
  --model gpt-4-turbo \
  --base-url https://api.openai-proxy.com/v1 \
  --max-tokens 8192 \
  --temperature 0.7
```

### 支持的模型

**Anthropic Claude:**
- `claude-opus-4-5-20251101` - Opus 4.5（最强）
- `claude-sonnet-4-5-20250929` - Sonnet 4.5（推荐）
- `claude-sonnet-4-20250514` - Sonnet 4
- `claude-3-5-sonnet-20241022` - Sonnet 3.5（默认）
- `claude-3-5-haiku-20241022` - Haiku 3.5（快速）

**OpenAI:**
- `gpt-4-turbo` - GPT-4 Turbo
- `gpt-4` - GPT-4
- `gpt-3.5-turbo` - GPT-3.5 Turbo

### 配置优先级

1. CLI 参数
2. 厂商专用环境变量（`OPENAI_API_KEY`、`ANTHROPIC_API_KEY`）
3. 通用环境变量（`API_KEY`、`BASE_URL`、`MODEL`）
4. 默认值

## 路线图

- [ ] RAG 经验库集成
- [ ] GUI Agent 自动测试
- [ ] VS Code 插件
- [ ] 多 Agent 协作
- [ ] 自定义 MCP Server 支持

## License

MIT

