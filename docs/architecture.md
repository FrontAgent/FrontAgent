# FrontAgent 工程级 Agent 系统架构设计

## 一、整体系统架构

### 1.1 架构总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FrontAgent System                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐       │
│  │   User Input    │────▶│  Agent Core     │────▶│   Output        │       │
│  │   (Task/Query)  │     │  (Orchestrator) │     │   (Code/Action) │       │
│  └─────────────────┘     └────────┬────────┘     └─────────────────┘       │
│                                   │                                          │
│                    ┌──────────────┼──────────────┐                          │
│                    ▼              ▼              ▼                          │
│  ┌─────────────────────┐ ┌──────────────┐ ┌──────────────────┐             │
│  │   SDD Control Layer │ │   Planner    │ │    Executor      │             │
│  │   (Hard Constraints)│ │  (ReAct/CoT) │ │  (Tool Invoker)  │             │
│  └──────────┬──────────┘ └──────┬───────┘ └────────┬─────────┘             │
│             │                   │                   │                        │
│             ▼                   ▼                   ▼                        │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                    MCP Layer (Trusted Interface)                 │       │
│  ├─────────────────────┬───────────────────┬───────────────────────┤       │
│  │   MCP Web Adapter   │  MCP File Adapter │  MCP Memory Adapter   │       │
│  │   (Browser Control) │  (Code Mutation)  │  (RAG/Experience)     │       │
│  └──────────┬──────────┴─────────┬─────────┴───────────┬───────────┘       │
│             │                    │                      │                    │
└─────────────┼────────────────────┼──────────────────────┼────────────────────┘
              ▼                    ▼                      ▼
       ┌──────────────┐    ┌──────────────┐      ┌──────────────┐
       │   Browser    │    │  File System │      │  Vector DB   │
       │  (Puppeteer) │    │  (Project)   │      │  (Chroma)    │
       └──────────────┘    └──────────────┘      └──────────────┘
```

### 1.2 核心模块划分

| 模块 | 职责 | 输入 | 输出 |
|------|------|------|------|
| **Agent Core** | 任务编排、上下文管理、会话状态 | 用户任务 | 执行结果 |
| **SDD Layer** | 约束解析、边界校验、规范检查 | SDD 配置 | 约束规则集 |
| **Planner** | 任务分解、步骤规划、依赖分析 | 任务 + 约束 | 执行计划 |
| **Executor** | 工具调用、结果验证、错误恢复 | 执行计划 | 执行结果 |
| **MCP Web Adapter** | DOM 感知、页面交互、状态获取 | 页面 URL | 结构化页面信息 |
| **MCP File Adapter** | 文件读写、补丁应用、版本控制 | 文件操作指令 | 操作结果 |
| **Hallucination Guard** | 输出校验、事实核查、幻觉拦截 | Agent 输出 | 校验结果 |

### 1.3 数据流设计

```
用户任务输入
    │
    ▼
┌───────────────────────────────────────────────────────────────┐
│ 1. SDD 约束加载                                                │
│    - 加载项目 SDD 配置                                         │
│    - 解析为结构化约束规则                                       │
│    - 生成 System Prompt 约束注入                               │
└───────────────────────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────────────────────┐
│ 2. 上下文收集 (通过 MCP)                                       │
│    - 如需：获取浏览器页面结构                                   │
│    - 如需：读取相关代码文件                                     │
│    - 如需：检索 RAG 经验库                                     │
└───────────────────────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────────────────────┐
│ 3. Planner 规划                                                │
│    - 任务分解为原子步骤                                         │
│    - 每步绑定可用工具                                          │
│    - 生成执行依赖图                                            │
└───────────────────────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────────────────────┐
│ 4. Executor 执行 (循环)                                        │
│    - 执行当前步骤                                              │
│    - 通过 MCP 调用工具                                         │
│    - 收集执行结果                                              │
│    - Hallucination Guard 校验                                  │
│    - 更新执行状态                                              │
└───────────────────────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────────────────────┐
│ 5. 结果输出                                                    │
│    - 生成执行报告                                              │
│    - 记录到 RAG 经验库                                         │
│    - 返回用户                                                  │
└───────────────────────────────────────────────────────────────┘
```

---

## 二、关键模块详细设计

### 2.1 SDD 控制层设计

#### 2.1.1 SDD Schema 设计 (YAML 格式)

```yaml
# sdd.yaml - 软件设计文档（结构化约束）
version: "1.0"
project:
  name: "my-frontend-app"
  type: "react-spa"
  
# 技术栈约束 - Agent 必须遵守
tech_stack:
  framework: "react"
  version: "^18.0.0"
  language: "typescript"
  styling: "tailwindcss"
  state_management: "zustand"
  forbidden_packages:
    - "jquery"
    - "lodash"  # 使用 es-toolkit 替代
    
# 目录结构约束
directory_structure:
  src:
    components:
      pattern: "PascalCase"
      max_lines: 300
      required_exports: ["default"]
    hooks:
      pattern: "use*.ts"
      forbidden: ["useEffect without deps"]
    utils:
      pattern: "camelCase"
      must_be_pure: true
    pages:
      pattern: "PascalCase"
      
# 模块边界约束
module_boundaries:
  - from: "components/*"
    can_import: ["hooks/*", "utils/*", "types/*"]
    cannot_import: ["pages/*", "api/*"]
  - from: "hooks/*"
    can_import: ["utils/*", "api/*", "types/*"]
    cannot_import: ["components/*", "pages/*"]
    
# 命名规范
naming_conventions:
  components: "PascalCase"
  hooks: "camelCase with 'use' prefix"
  utils: "camelCase"
  constants: "SCREAMING_SNAKE_CASE"
  types: "PascalCase with 'I' or 'T' prefix"
  
# 代码质量约束
code_quality:
  max_function_lines: 50
  max_file_lines: 300
  max_parameters: 4
  require_jsdoc: true
  forbidden_patterns:
    - "any"  # 禁止 TypeScript any
    - "// @ts-ignore"
    - "console.log"  # 生产代码禁止
    
# 修改安全边界
modification_rules:
  protected_files:
    - "package.json"  # 需要人工确认
    - "tsconfig.json"
    - ".env*"
  protected_directories:
    - "node_modules"
    - ".git"
  require_approval:
    - pattern: "*.config.*"
      reason: "配置文件修改需要人工审批"
    - pattern: "src/core/*"
      reason: "核心模块修改需要人工审批"
```

#### 2.1.2 SDD 解析器设计

```typescript
// sdd-parser.ts
interface SDDConstraints {
  techStack: TechStackConstraints;
  directoryRules: DirectoryRule[];
  moduleBoundaries: ModuleBoundary[];
  namingConventions: NamingConvention[];
  codeQuality: CodeQualityRules;
  modificationRules: ModificationRules;
}

interface ConstraintViolation {
  type: 'ERROR' | 'WARNING';
  rule: string;
  message: string;
  location?: string;
  suggestion?: string;
}

class SDDParser {
  parse(sddPath: string): SDDConstraints;
  validate(action: AgentAction): ConstraintViolation[];
  generateSystemPrompt(): string;  // 生成注入 LLM 的约束提示
}
```

### 2.2 Agent Planner 设计

#### 2.2.1 规划策略

采用 **ReAct (Reasoning + Acting)** 模式，结合 **Chain of Thought**：

```
┌─────────────────────────────────────────────────────────────┐
│                      Planner 流程                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 任务理解 (Thought)                                      │
│     ├── 解析用户意图                                        │
│     ├── 识别任务类型 (创建/修改/查询/调试)                   │
│     └── 确定所需上下文                                      │
│                                                             │
│  2. 约束检查 (Constraint Check)                             │
│     ├── 加载 SDD 约束                                       │
│     ├── 检查任务是否在允许范围内                             │
│     └── 识别需要人工审批的操作                               │
│                                                             │
│  3. 上下文收集 (Observation)                                │
│     ├── 调用 MCP 获取页面结构 (如需)                        │
│     ├── 调用 MCP 读取相关文件                               │
│     └── 检索 RAG 经验库                                     │
│                                                             │
│  4. 计划生成 (Plan)                                         │
│     ├── 分解为原子操作                                      │
│     ├── 为每个操作指定工具                                   │
│     ├── 确定执行顺序和依赖                                   │
│     └── 设置回滚点                                          │
│                                                             │
│  5. 计划验证 (Validate)                                     │
│     ├── 检查计划是否符合 SDD                                │
│     ├── 预估影响范围                                        │
│     └── 确认无幻觉风险                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 2.2.2 执行计划数据结构

```typescript
interface ExecutionPlan {
  taskId: string;
  summary: string;
  steps: ExecutionStep[];
  rollbackStrategy: RollbackStrategy;
  estimatedImpact: ImpactAssessment;
}

interface ExecutionStep {
  stepId: string;
  action: 'read' | 'write' | 'patch' | 'create' | 'delete' | 'browser_action';
  tool: string;  // MCP 工具名
  params: Record<string, unknown>;
  dependencies: string[];  // 依赖的 stepId
  validation: ValidationRule[];
  rollback?: RollbackAction;
}

interface ValidationRule {
  type: 'file_exists' | 'syntax_valid' | 'tests_pass' | 'lint_pass' | 'sdd_compliant';
  params?: Record<string, unknown>;
}
```

### 2.3 MCP Web Adapter 设计

#### 2.3.1 职责

- 提供结构化的页面感知能力
- 支持页面交互（点击、输入、滚动）
- 获取 Accessibility Tree 用于语义理解

#### 2.3.2 MCP 工具定义

```typescript
// MCP Web Tools
const webTools = {
  // 获取页面结构
  get_page_structure: {
    description: "获取当前页面的结构化 DOM 信息",
    parameters: {
      url: { type: "string", description: "页面 URL" },
      selector: { type: "string", description: "可选，限定范围的 CSS 选择器" },
      include_styles: { type: "boolean", default: false }
    },
    returns: {
      type: "object",
      properties: {
        title: "string",
        url: "string",
        viewport: "object",
        dom_tree: "DOMNode[]",
        accessibility_tree: "AXNode[]"
      }
    }
  },

  // 获取可交互元素
  get_interactive_elements: {
    description: "获取页面上所有可交互元素",
    parameters: {
      url: { type: "string" },
      filter: { type: "string", enum: ["all", "buttons", "inputs", "links"] }
    },
    returns: {
      type: "array",
      items: {
        selector: "string",
        type: "string",
        text: "string",
        aria_label: "string",
        bounding_box: "object"
      }
    }
  },

  // 执行页面操作
  browser_action: {
    description: "在浏览器中执行操作",
    parameters: {
      action: { type: "string", enum: ["click", "type", "scroll", "screenshot"] },
      selector: { type: "string" },
      value: { type: "string" }
    }
  },

  // 获取页面截图
  take_screenshot: {
    description: "获取页面截图",
    parameters: {
      url: { type: "string" },
      full_page: { type: "boolean", default: false },
      selector: { type: "string", description: "可选，只截取特定元素" }
    }
  }
};
```

### 2.4 MCP File Adapter 设计

#### 2.4.1 核心原则

- **最小 Diff 原则**：只修改必要的部分
- **可回滚**：所有修改都可以撤销
- **可校验**：修改前后都进行语法/lint 校验

#### 2.4.2 MCP 工具定义

```typescript
// MCP File Tools
const fileTools = {
  // 读取文件
  read_file: {
    description: "读取指定文件内容",
    parameters: {
      path: { type: "string", description: "相对于项目根目录的文件路径" },
      encoding: { type: "string", default: "utf-8" }
    },
    returns: {
      content: "string",
      lines: "number",
      language: "string"
    }
  },

  // 应用补丁（核心！）
  apply_patch: {
    description: "应用最小化代码补丁",
    parameters: {
      path: { type: "string" },
      patches: {
        type: "array",
        items: {
          type: "object",
          properties: {
            operation: { type: "string", enum: ["replace", "insert", "delete"] },
            start_line: { type: "number" },
            end_line: { type: "number" },
            content: { type: "string" }
          }
        }
      },
      dry_run: { type: "boolean", default: false }
    },
    returns: {
      success: "boolean",
      diff: "string",
      validation: {
        syntax_valid: "boolean",
        lint_errors: "array",
        type_errors: "array"
      }
    }
  },

  // 创建文件
  create_file: {
    description: "创建新文件",
    parameters: {
      path: { type: "string" },
      content: { type: "string" },
      overwrite: { type: "boolean", default: false }
    },
    validation: {
      check_sdd_path: true,  // 检查路径是否符合 SDD
      check_naming: true     // 检查命名是否符合规范
    }
  },

  // 列出目录
  list_directory: {
    description: "列出目录内容",
    parameters: {
      path: { type: "string" },
      recursive: { type: "boolean", default: false },
      pattern: { type: "string", description: "glob 模式过滤" }
    }
  },

  // 搜索代码
  search_code: {
    description: "在代码库中搜索",
    parameters: {
      query: { type: "string" },
      pattern: { type: "string", description: "正则表达式" },
      file_pattern: { type: "string", description: "文件过滤 glob" }
    }
  },

  // 获取 AST
  get_ast: {
    description: "获取文件的 AST 结构",
    parameters: {
      path: { type: "string" }
    },
    returns: {
      ast: "ASTNode",
      exports: "string[]",
      imports: "ImportInfo[]",
      functions: "FunctionInfo[]",
      components: "ComponentInfo[]"
    }
  },

  // 回滚修改
  rollback: {
    description: "回滚到指定快照",
    parameters: {
      snapshot_id: { type: "string" }
    }
  }
};
```

### 2.5 幻觉防控机制设计

#### 2.5.1 幻觉来源分析

| 幻觉类型 | 产生位置 | 表现 | 危害等级 |
|---------|---------|------|---------|
| **文件幻觉** | Planner/Executor | 引用不存在的文件 | 高 |
| **API 幻觉** | Planner | 调用不存在的函数/组件 | 高 |
| **语法幻觉** | Executor | 生成语法错误的代码 | 中 |
| **依赖幻觉** | Executor | 导入不存在的包 | 高 |
| **DOM 幻觉** | Web Adapter | 假设不存在的 DOM 结构 | 中 |
| **规范幻觉** | Planner | 违反 SDD 约束 | 中 |

#### 2.5.2 防控机制矩阵

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          幻觉防控层                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Layer 1: SDD 预约束                                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ • 在 System Prompt 中注入 SDD 约束                               │   │
│  │ • 明确告知 Agent 什么是不允许的                                  │   │
│  │ • 预防性地阻止幻觉产生                                           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Layer 2: 规划时校验                                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ • Planner 输出的计划必须通过 SDD 校验                           │   │
│  │ • 引用的文件必须确认存在                                        │   │
│  │ • 调用的工具必须在 MCP 定义中                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Layer 3: 执行时校验                                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ • 每个 Tool 调用前验证参数                                      │   │
│  │ • 代码修改后运行 lint/typecheck                                 │   │
│  │ • 新增依赖检查 package.json 是否存在                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Layer 4: 输出时校验                                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ • 最终输出前进行全量校验                                        │   │
│  │ • AST 解析验证语法正确性                                        │   │
│  │ • 模拟执行验证逻辑正确性                                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Layer 5: 回滚机制                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ • 所有修改创建快照                                              │   │
│  │ • 校验失败自动回滚                                              │   │
│  │ • 保留修改历史用于分析                                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 2.5.3 Hallucination Guard 实现

```typescript
interface HallucinationCheck {
  type: string;
  check: (input: unknown) => Promise<CheckResult>;
  severity: 'block' | 'warn' | 'info';
}

class HallucinationGuard {
  private checks: HallucinationCheck[] = [
    {
      type: 'file_existence',
      check: async (path: string) => {
        const exists = await this.fileAdapter.exists(path);
        return { pass: exists, message: exists ? null : `File not found: ${path}` };
      },
      severity: 'block'
    },
    {
      type: 'import_validity',
      check: async (importPath: string) => {
        // 检查导入是否有效（本地文件或 node_modules）
        const isValid = await this.validateImport(importPath);
        return { pass: isValid, message: isValid ? null : `Invalid import: ${importPath}` };
      },
      severity: 'block'
    },
    {
      type: 'syntax_validity',
      check: async (code: string, language: string) => {
        const result = await this.parseAST(code, language);
        return { pass: !result.errors.length, message: result.errors.join('\n') };
      },
      severity: 'block'
    },
    {
      type: 'sdd_compliance',
      check: async (action: AgentAction) => {
        const violations = this.sddParser.validate(action);
        return { 
          pass: violations.filter(v => v.type === 'ERROR').length === 0,
          message: violations.map(v => v.message).join('\n')
        };
      },
      severity: 'block'
    }
  ];

  async validate(output: AgentOutput): Promise<ValidationResult> {
    const results: CheckResult[] = [];
    for (const check of this.checks) {
      const result = await check.check(output);
      results.push({ ...result, type: check.type, severity: check.severity });
    }
    return {
      pass: results.every(r => r.pass || r.severity !== 'block'),
      results
    };
  }
}
```

---

## 三、技术选型与社区方案

### 3.1 核心技术栈

| 领域 | 选型 | 理由 |
|-----|------|------|
| **语言** | TypeScript | 类型安全、前端生态、MCP SDK 官方支持 |
| **运行时** | Node.js 20+ | 稳定、广泛支持 |
| **包管理** | pnpm | 速度快、磁盘效率高 |

### 3.2 MCP 实现

| 组件 | 选型 | 角色 |
|-----|------|------|
| **MCP SDK** | `@modelcontextprotocol/sdk` | 官方 TypeScript SDK，实现 MCP Server |
| **传输层** | stdio / SSE | 本地用 stdio，远程用 SSE |

**为什么选它**：
- MCP 是 Anthropic 官方推出的协议，专为 AI Agent 设计
- 官方 SDK 提供完整的类型定义和工具抽象
- 已被 Cursor、Claude Desktop 等工具采用

### 3.3 浏览器自动化

| 组件 | 选型 | 角色 |
|-----|------|------|
| **浏览器控制** | Playwright | 页面操作、截图、DOM 获取 |
| **Accessibility Tree** | Playwright Accessibility API | 获取语义化页面结构 |

**为什么选它**：
- Playwright 支持多浏览器（Chrome、Firefox、Safari）
- 内置 Accessibility Tree API，无需额外处理
- 比 Puppeteer 更现代、更稳定
- 支持 Headless 和 Headful 模式

### 3.4 AST / 代码分析

| 组件 | 选型 | 角色 |
|-----|------|------|
| **TypeScript AST** | `ts-morph` | TypeScript/JavaScript 代码分析和修改 |
| **通用 AST** | `recast` + `@babel/parser` | 保留格式的代码转换 |
| **Diff 生成** | `diff` | 生成和应用补丁 |

**为什么选它**：
- `ts-morph` 提供高层 API，简化 TypeScript AST 操作
- `recast` 可以在修改代码时保留原有格式（空格、注释等）
- 适合实现"最小 diff"的修改策略

### 3.5 向量数据库 / RAG

| 组件 | 选型 | 角色 |
|-----|------|------|
| **向量数据库** | ChromaDB | 存储和检索经验向量 |
| **Embedding** | OpenAI text-embedding-3-small | 生成文本向量 |

**为什么选它**：
- ChromaDB 轻量、易部署、支持本地运行
- 适合中小规模的经验库存储
- 支持元数据过滤

### 3.6 LLM 集成

| 组件 | 选型 | 角色 |
|-----|------|------|
| **LLM 调用** | Vercel AI SDK (`ai`) | 统一的 LLM 调用接口 |
| **模型** | Claude 3.5 Sonnet / GPT-4 | 主力推理模型 |

**为什么选它**：
- Vercel AI SDK 支持多模型统一接口
- 支持流式输出、工具调用
- TypeScript 原生支持

### 3.7 相关开源项目参考

| 项目 | 链接 | 参考点 |
|-----|------|--------|
| **browser-use** | github.com/browser-use/browser-use | 浏览器 Agent 实现思路 |
| **OpenHands** | github.com/All-Hands-AI/OpenHands | 工程级代码 Agent 架构 |
| **Aider** | github.com/paul-gauthier/aider | 代码编辑策略、Git 集成 |
| **MCP Servers** | github.com/modelcontextprotocol/servers | 官方 MCP Server 示例 |
| **SWE-agent** | github.com/princeton-nlp/SWE-agent | Agent 规划策略 |

---

## 四、项目目录结构

```
frontagent/
├── package.json
├── tsconfig.json
├── pnpm-workspace.yaml
│
├── packages/
│   ├── core/                      # Agent 核心
│   │   ├── src/
│   │   │   ├── agent.ts           # Agent 主类
│   │   │   ├── planner.ts         # 规划器
│   │   │   ├── executor.ts        # 执行器
│   │   │   ├── context.ts         # 上下文管理
│   │   │   └── types.ts           # 类型定义
│   │   └── package.json
│   │
│   ├── sdd/                       # SDD 控制层
│   │   ├── src/
│   │   │   ├── parser.ts          # SDD 解析器
│   │   │   ├── validator.ts       # 约束验证器
│   │   │   ├── schema.ts          # Schema 定义
│   │   │   └── prompt-generator.ts # System Prompt 生成
│   │   └── package.json
│   │
│   ├── mcp-web/                   # MCP Web Adapter
│   │   ├── src/
│   │   │   ├── server.ts          # MCP Server 实现
│   │   │   ├── browser.ts         # Playwright 封装
│   │   │   ├── tools/
│   │   │   │   ├── get-page-structure.ts
│   │   │   │   ├── get-interactive-elements.ts
│   │   │   │   ├── browser-action.ts
│   │   │   │   └── take-screenshot.ts
│   │   │   └── types.ts
│   │   └── package.json
│   │
│   ├── mcp-file/                  # MCP File Adapter
│   │   ├── src/
│   │   │   ├── server.ts          # MCP Server 实现
│   │   │   ├── tools/
│   │   │   │   ├── read-file.ts
│   │   │   │   ├── apply-patch.ts
│   │   │   │   ├── create-file.ts
│   │   │   │   ├── search-code.ts
│   │   │   │   └── get-ast.ts
│   │   │   ├── snapshot.ts        # 快照管理
│   │   │   └── types.ts
│   │   └── package.json
│   │
│   ├── hallucination-guard/       # 幻觉防控
│   │   ├── src/
│   │   │   ├── guard.ts           # 主校验类
│   │   │   ├── checks/
│   │   │   │   ├── file-existence.ts
│   │   │   │   ├── import-validity.ts
│   │   │   │   ├── syntax-validity.ts
│   │   │   │   └── sdd-compliance.ts
│   │   │   └── types.ts
│   │   └── package.json
│   │
│   └── shared/                    # 共享类型和工具
│       ├── src/
│       │   ├── types.ts
│       │   └── utils.ts
│       └── package.json
│
├── apps/
│   └── cli/                       # CLI 应用
│       ├── src/
│       │   └── index.ts
│       └── package.json
│
├── examples/                      # 示例
│   ├── sdd-example.yaml           # SDD 示例
│   └── demo-project/              # 演示项目
│
└── docs/
    ├── architecture.md            # 本文档
    └── design.md                  # 原始需求
```

