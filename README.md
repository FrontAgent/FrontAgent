# FrontAgent

[![npm version](https://badge.fury.io/js/frontagent.svg)](https://www.npmjs.com/package/frontagent)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org)

> Enterprise-grade AI Agent System - Constrained by SDD, Powered by MCP for Controlled Perception and Execution

[中文文档](docs/README-CN.md) | [Quick Start](docs/QUICKSTART.md) | [Architecture](docs/architecture.md) | [Design Doc](docs/design.md)

FrontAgent is an AI Agent system designed specifically for frontend engineering, addressing core challenges faced when deploying agents in real-world engineering scenarios:

- ✅ **Two-Stage Architecture** - Separate planning and execution to avoid JSON parsing errors and enable dynamic code generation
- ✅ **Phase-Based Execution** - Steps grouped by phases with error recovery within each phase
- ✅ **Self-Healing** - Tool Error Feedback Loop automatically analyzes errors and generates fix steps
- ✅ **Facts Memory** - Structured facts-based context system for precise project state tracking
- ✅ **Module Dependency Tracking** - Automatic import/export parsing to detect path hallucinations
- ✅ **Hallucination Prevention** - Multi-layer hallucination detection and interception
- ✅ **SDD Constraints** - Specification Driven Development as hard constraints for agent behavior
- ✅ **MCP Protocol** - Controlled tool invocation via Model Context Protocol
- ✅ **Minimal Changes** - Patch-based code modifications with rollback support
- ✅ **Web Awareness** - Understand page structure through browser MCP
- ✅ **Shell Integration** - Terminal command execution (requires user approval)
- ✅ **Pre-Planning Scan** - Scan project structure before planning to generate accurate file paths
- ✅ **Auto Port Detection** - Automatically detect dev server ports from config files
- ✅ **Remote README-First RAG** - Seed retrieval from a remote repository README and lazily fetch linked files/commits on demand
- ✅ **LangGraph Engine (Optional)** - Switchable graph-based execution engine with optional checkpoints
- ✅ **Planner Skills Layer** - Reusable planning skills for task decomposition and phase injection
- ✅ **Repository Management Phase** - Auto git/gh workflow after acceptance (commit, push, PR)

## TL;DR

```bash
# 1. Install globally via npm
npm install -g frontagent
# or using pnpm
pnpm add -g frontagent
# or using yarn
yarn global add frontagent

# 2. Configure LLM (supports OpenAI and Anthropic)
# OpenAI config
export PROVIDER="openai"
export BASE_URL="https://api.openai.com/v1"
export MODEL="gpt-4"
export API_KEY="sk-..."

# Or Anthropic config
export PROVIDER="anthropic"
export BASE_URL="https://api.anthropic.com"
export MODEL="claude-sonnet-4-20250514"
export API_KEY="sk-ant-..."

# 3. Navigate to your project directory and initialize SDD
cd your-project
frontagent init

# 4. Let AI help you complete tasks
frontagent run "Create a user login page"
frontagent run "Optimize homepage loading performance"
frontagent run "Add dark mode support"
# Use LangGraph engine + checkpoint (optional)
frontagent run "Add route guards and open a PR" --engine langgraph --langgraph-checkpoint
```

## Remote RAG

FrontAgent now supports a lightweight remote knowledge base flow for planning and code generation:

- It uses a remote repository README as the seed index
- It does **not** clone the whole knowledge repository
- It parses links from the README and lazily fetches linked files / commits only when a query actually hits them
- Retrieved documents are cached under `.frontagent/rag-cache`

Default seed source:

- Repository: `https://github.com/ceilf6/Lab.git`
- Seed README: `README.md`

CLI options:

```bash
frontagent run "Explain React setState behavior" \
  --rag-repo https://github.com/ceilf6/Lab.git \
  --rag-branch main \
  --rag-seed README.md

# Disable remote RAG for a run
frontagent run "Create a page" --disable-rag
```

Environment variables:

```bash
export FRONTAGENT_RAG_REPO="https://github.com/ceilf6/Lab.git"
export FRONTAGENT_RAG_BRANCH="main"
export FRONTAGENT_RAG_SEED_PATH="README.md"
export FRONTAGENT_RAG_MAX_RESULTS="5"
```

## Architecture Overview

### System Architecture

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

### Execution Flow

```
User Task
   │
   ▼
┌──────────────────┐
│  Pre-Planning    │ ← Scan project structure (NEW!)
│  File Scan       │   Detect dev server port (NEW!)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Planner (Stage1)│ ← SDD Constraints
└────────┬─────────┘   Project file list
         │             Dev server port
         │ Generates execution plan (with phase field)
         ▼
┌──────────────────────────────────────────┐
│           Executor (Stage 2)              │
│  ┌────────────────────────────────┐      │
│  │  Phase 1: Analysis              │      │
│  │  ├─ Step 1 ✓                  │      │
│  │  ├─ Step 2 ✗ (error)          │      │
│  │  └─ Error Recovery             │      │
│  │     ├─ Analyze error           │      │
│  │     ├─ Generate fix steps     │      │
│  │     └─ Execute fix ✓          │      │
│  └────────────────────────────────┘      │
│  ┌────────────────────────────────┐      │
│  │  Phase 2: Creation              │      │
│  │  ├─ Step 3 ✓                  │      │
│  │  └─ Step 4 ✓                  │      │
│  └────────────────────────────────┘      │
│                                           │
│  After each step:                         │
│  └─ Update Facts                          │
│     ├─ File system state                  │
│     ├─ Dependency state                   │
│     ├─ Module dependency graph            │
│     └─ Project state                      │
│                                           │
│  Phase completion validation:             │
│  └─ Check missing module references       │
│     └─ Auto-generate fix steps ✓          │
└───────────────────────────────────────────┘
         │
         ▼
    Task Complete ✓
```

Default phase taxonomy:
`Phase 1 Analysis -> Phase 2 Creation -> Phase 3 Installation -> Phase 4 Validation/Acceptance -> Phase 5 Startup -> Phase 6 Browser Validation -> Phase 7 Repository Management (git/gh)`

## Key Features

### 1. Pre-Planning Project Scan (NEW!)

Before generating the execution plan, FrontAgent now automatically scans the project structure to provide accurate file context to the LLM:

```typescript
// Automatically executed before planning
const projectStructure = await scanProjectFiles();
// Returns: "Project files (245 files): src/App.tsx, src/components/Button.tsx, ..."

// LLM receives this context and generates more accurate file paths
```

**Benefits**:
- ✅ **Accurate File Paths** - LLM knows existing files and generates correct relative paths
- ✅ **Reduced Hallucination** - Fewer "file not found" errors
- ✅ **Better Context** - Planner understands the project structure before planning

**Implementation**: `packages/core/src/agent.ts:217-255`

### 2. Automatic Dev Server Port Detection (NEW!)

FrontAgent now automatically detects the development server port from your project configuration:

```typescript
// Detection sources (in order):
// 1. vite.config.ts/js: server.port field
// 2. package.json scripts: --port or -p flags
// 3. Framework defaults: Vite (5173), Next.js (3000), CRA (3000), Angular (4200)
// 4. Fallback: 5173

const devServerPort = await detectDevServerPort();
// Used in browser navigation tasks
```

**Benefits**:
- ✅ **Automatic Port Discovery** - No manual port configuration needed
- ✅ **Framework Awareness** - Recognizes different framework defaults
- ✅ **Browser Testing** - Correct port used for browser validation tasks

**Implementation**: `packages/core/src/agent.ts:732-793`

### 3. Two-Stage Architecture

FrontAgent uses an innovative two-stage architecture that completely solves JSON parsing errors when generating large amounts of code:

#### Stage 1: Planner
- **Input**: User task + SDD constraints + project context + project file list (NEW!)
- **Output**: Structured execution plan (descriptions only, no code)
- **Tech**: Uses `generateObject` to produce Zod Schema-compliant JSON
- **Key**: No code in JSON, avoiding escape and parsing issues

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

#### Stage 2: Executor
- **Input**: Structured execution plan
- **Process**: Execute each step in the plan sequentially
- **Code Generation**: When encountering `needsCodeGeneration: true`, dynamically generate code using `generateText`
- **Tech**: Use MCP tools for file operations, command execution, etc.

**Advantages**:
1. ✅ Completely avoid JSON parsing errors (code not in JSON)
2. ✅ Better controllability (each step validated individually)
3. ✅ Support large projects (no JSON size limit)
4. ✅ More precise code generation (based on real-time context)

### 4. Phase-Based Execution & Self-Healing

FrontAgent implements advanced phase-based execution and automatic error recovery:

#### Phase-Based Execution

The execution plan is automatically divided into multiple phases, each focused on a specific goal:

```json
{
  "steps": [
    {
      "stepId": "step-1",
      "phase": "Analysis Phase",
      "description": "Read existing files, analyze project structure",
      "action": "read_file"
    },
    {
      "stepId": "step-2",
      "phase": "Creation Phase",
      "description": "Create new component files",
      "action": "create_file"
    },
    {
      "stepId": "step-3",
      "phase": "Installation Phase",
      "description": "Install necessary dependencies",
      "action": "run_command"
    },
    {
      "stepId": "step-4",
      "phase": "Validation Phase",
      "description": "Run tests to verify functionality",
      "action": "run_command"
    },
    {
      "stepId": "step-5",
      "phase": "Repository Management Phase",
      "description": "Commit changes, push branch, and create/update PR with gh",
      "action": "run_command"
    }
  ]
}
```

**Advantages**:
- 🎯 **Clear Execution Flow** - Each phase has a clear objective
- 🔄 **Intra-Phase Error Recovery** - Errors automatically fixed within phases
- 📊 **Better Progress Tracking** - Users see which phase is currently executing
- 🔀 **Dependency-Aware Phase Ordering** - Phase DAG scheduling reduces out-of-order skips
- 🚀 **Post-Acceptance Automation** - Optional repository management phase can handle git/gh flow

#### Tool Error Feedback Loop

When tool execution fails, the system automatically analyzes errors and generates fix steps:

```typescript
// 1. Error detected
Error: Cannot apply patch: file not found in context: src/App.tsx

// 2. LLM analyzes error
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
      "params": { /* original params */ }
    }
  ]
}

// 3. Auto-execute fix steps
// 4. Continue original flow
```

**Features**:
- 🔍 **Smart Error Analysis** - LLM understands error causes and finds root issues
- 🛠️ **Auto-Generate Fixes** - No manual intervention needed
- 📝 **Common Error Patterns** - Built-in handling for common errors
- ♻️ **Phase-Level Recovery** - Errors fixed within phases without blocking overall flow

### 5. LangGraph Execution Engine (NEW!)

FrontAgent now supports a switchable execution engine:

- `native` (default): Existing executor flow with phase DAG scheduling
- `langgraph`: Runs phase flow through `StateGraph` with optional `MemorySaver` checkpoint

CLI options:

```bash
# Use native engine (default)
frontagent run "Add login page" --engine native

# Use LangGraph engine
frontagent run "Add login page" --engine langgraph

# LangGraph + checkpoint + custom recovery attempts
frontagent run "Add login page" --engine langgraph --langgraph-checkpoint --max-recovery-attempts 5
```

### 6. Planner Skills Layer (NEW!)

FrontAgent adds a dedicated `skills` layer in Planner to encapsulate reusable planning logic.

- Built-in task skills: `task.create`, `task.modify`, `task.query`, `task.debug`, `task.refactor`, `task.test`
- Built-in phase skill: `phase.repository-management` (injects git/gh workflow after acceptance)
- Custom task skills with the same match condition override built-ins (latest registered wins)
- Executor also supports action-level skills (for params/codegen/error policy)
- Supports runtime extension via API:

```typescript
import { createAgent, type TaskPlanningSkill } from '@frontagent/core';

const agent = createAgent(config);

const customSkill: TaskPlanningSkill = {
  name: 'task.security-audit',
  supports: (task) => task.type === 'debug' && task.description.includes('security'),
  plan: ({ stepFactory }) => [
    stepFactory.createStep({
      description: 'Scan for security-sensitive patterns',
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

### 7. Facts-Based Context System

Traditional agents use logs as context, leading to information redundancy and inaccuracy. FrontAgent uses a structured "facts" system:

**Traditional approach (log-based)**:
```
Executed operation log:
1. Attempted to read src/App.tsx - failed
2. Attempted to create src/components/Button.tsx - success
3. Attempted to read src/App.tsx - success
4. Installed react-router-dom - success
...(lots of redundant info)
```

**FrontAgent approach (facts-based)**:
```yaml
## File System State

### Confirmed Existing Files:
- src/App.tsx
- src/components/Button.tsx
- package.json

### Confirmed Non-Existent Paths:
- src/pages/Login.tsx

## Dependency State

### Installed Packages:
react-router-dom, axios

### Missing Packages:
@types/node

## Created Modules

### component (3 modules):
- src/components/ui/Button.tsx (default export: Button)
- src/components/ui/Card.tsx (default export: Card)
- src/components/layout/Header.tsx (exports: Header, Navigation)

### page (2 modules):
- src/pages/HomePage.tsx (default export: HomePage)
- src/pages/LoginPage.tsx (default export: LoginPage)

### ⚠️ Missing Module References:
- src/pages/HomePage.tsx references non-existent module: ../components/ui/Spinner

## Project State
- Dev server: Running (port: 5173) ← Auto-detected!
- Build status: Success

## Recent Errors
- [apply_patch] Cannot apply patch: file not found in context
```

**Advantages**:
- 📊 **Structured Information** - Clear state categories (filesystem, dependencies, module graph, project state)
- 🎯 **Deduplication** - Automatic deduplication using Set/Map
- 💡 **Context Awareness** - LLM knows which files exist/don't exist
- 🔄 **Real-time Updates** - Auto-update facts after each tool execution
- 📉 **Reduced Token Usage** - Concise information reduces LLM input length
- 🔗 **Module Tracking** - Auto-parse import/export relationships for each created file

## Core Modules

### @frontagent/sdd - SDD Control Layer

Specification Driven Development (SDD) as hard constraints for agent behavior:

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
      reason: "API layer changes require approval"
```

### @frontagent/mcp-file - File Operations MCP

Provides file operation MCP tools:

- `read_file` - Read file content
- `list_directory` - List directory content (supports recursion)
- `create_file` - Create new file (two-stage: generate code from description)
- `apply_patch` - Apply code patches (two-stage: generate changes from description)
- `search_code` - Search code
- `get_ast` - Get AST analysis
- `rollback` - Rollback changes

### @frontagent/mcp-shell - Shell Command MCP

Provides terminal command execution (requires user approval):

- `run_command` - Execute shell commands
  - Custom working directory support
  - Timeout settings
  - User approval required before execution
  - Auto-distinguish warnings from errors
  - Use cases: `npm install`, `git init`, `pnpm build`, etc.

### @frontagent/mcp-web - Web Awareness MCP

Provides browser interaction MCP tools:

- `browser_navigate` - Navigate to URL
- `get_page_structure` - Get page DOM structure
- `get_accessibility_tree` - Get accessibility tree
- `get_interactive_elements` - Get interactive elements
- `browser_click` / `browser_type` / `browser_scroll` - Page interactions
- `browser_screenshot` - Page screenshot
- `browser_wait_for_selector` - Wait for element availability

### @frontagent/hallucination-guard - Hallucination Prevention

Multi-layer hallucination detection:

1. **File Existence Check** - Verify referenced files exist
2. **Import Validity Check** - Verify imports are resolvable
3. **Syntax Validity Check** - Verify code syntax is correct
4. **SDD Compliance Check** - Verify compliance with SDD constraints

## Tech Stack

- **Language**: TypeScript
- **Runtime**: Node.js 20+
- **Package Manager**: pnpm
- **MCP SDK**: @modelcontextprotocol/sdk
- **Browser Automation**: Playwright
- **AST Analysis**: ts-morph
- **LLM Integration**: Vercel AI SDK

## Directory Structure

```
frontagent/
├── packages/
│   ├── shared/              # Shared types and utilities
│   ├── sdd/                 # SDD control layer
│   ├── mcp-file/            # File operations MCP client
│   ├── mcp-web/             # Web awareness MCP client
│   ├── mcp-shell/           # Shell commands MCP client
│   ├── hallucination-guard/ # Hallucination prevention
│   └── core/                # Agent core (two-stage architecture)
├── apps/
│   └── cli/                 # CLI tool
├── examples/
│   ├── sdd-example.yaml     # SDD config example
│   └── e-commerce-frontend/ # E-commerce frontend example
└── docs/
    ├── architecture.md      # Architecture design
    └── design.md            # Original requirements
```

## Usage Examples

### Example 1: Create New Project

```bash
cd examples
frontagent run "Create an e-commerce frontend project using React + TypeScript + Vite + Tailwind CSS"
```

Agent will automatically:
1. Analyze project requirements
2. Generate execution plan
3. Create package.json and config files
4. Request to execute `npm install` (requires user approval)
5. Generate page components and style files

### Example 2: Modify Existing Files

```bash
frontagent run "Modify vite.config.ts to add path alias configuration"
```

Agent will:
1. Read existing vite.config.ts
2. Understand current configuration
3. Generate new config code
4. Apply minimal patches

### Example 3: Add New Features

```bash
frontagent run "Add user authentication feature, including login, registration, and token management"
```

Agent will:
1. Analyze existing project structure
2. Plan files to create
3. Generate auth-related components
4. Create API integration code
5. Update route configuration

### Example 4: Performance Optimization

```bash
frontagent run "Analyze and optimize homepage loading performance"
```

Agent will:
1. Read relevant component code
2. Analyze performance issues
3. Propose optimization solutions
4. Implement code-level optimizations (lazy loading, code splitting, etc.)

### Example 5: Auto Error Recovery

```bash
frontagent run "Add route configuration in App.tsx"
```

Execution process shows self-healing:
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

**Key Features**:
- 🎯 **Phase-Based Execution** - Clear execution phases (Analysis, Creation, Validation)
- 🔄 **Auto-Fix** - Detected file not read, auto-insert read step
- 📊 **Facts Tracking** - System knows which files are read/unread
- ⚡ **No Retry Needed** - One-shot completion, no manual re-runs needed

### Example 6: Enable LangGraph Engine

```bash
frontagent run "Implement user profile page and open PR" \
  --type create \
  --engine langgraph \
  --langgraph-checkpoint \
  --max-recovery-attempts 5
```

Notes:
- `--engine langgraph` enables graph-based phase orchestration
- `--langgraph-checkpoint` enables in-memory checkpointing for the run
- After acceptance passes, repository management phase can run `git/gh` actions

## Environment Variables

### Required Configuration

| Variable | Description | Example Value |
|---------|-------------|---------------|
| `PROVIDER` | LLM provider | `openai` or `anthropic` |
| `API_KEY` | API key | `sk-...` |
| `MODEL` | Model name | `gpt-4` or `claude-sonnet-4-20250514` |
| `BASE_URL` | API endpoint | `https://api.openai.com/v1` |
| `EXECUTION_ENGINE` | Execution engine | `native` or `langgraph` |
| `LANGGRAPH_CHECKPOINT` | Enable LangGraph checkpoint | `true` / `false` |
| `MAX_RECOVERY_ATTEMPTS` | Max recovery attempts per phase | `3` |

### OpenAI Configuration Example

```bash
export PROVIDER="openai"
export BASE_URL="https://api.openai.com/v1"
export MODEL="gpt-4"
export API_KEY="sk-..."
```

### Anthropic Configuration Example

```bash
export PROVIDER="anthropic"
export BASE_URL="https://api.anthropic.com"
export MODEL="claude-sonnet-4-20250514"
export API_KEY="sk-ant-..."
```

## Development

```bash
# Development mode
pnpm dev

# Type check
pnpm typecheck

# Build
pnpm build

# Clean
pnpm clean
```

## Roadmap

### Completed ✅
- [x] Two-stage agent architecture (Planner + Executor)
- [x] Phase-based execution
- [x] Tool Error Feedback Loop (self-healing)
- [x] Facts-based context system
- [x] Module dependency graph
- [x] Post-generation validation
- [x] Path hallucination detection
- [x] Multi-LLM provider support (OpenAI, Anthropic)
- [x] Shell command execution (with user approval)
- [x] Dynamic code generation (avoid JSON parsing errors)
- [x] MCP tool integration (File, Web, Shell)
- [x] Type auto-normalization (handle LLM output uncertainty)
- [x] Unlimited steps (support complex tasks with many steps)
- [x] LLM schema constraint optimization (multi-strategy auto-fix, smart retry)
- [x] **Pre-planning file scan** (NEW!)
- [x] **Auto dev server port detection** (NEW!)
- [x] **Dependency-aware phase DAG scheduling** (NEW!)
- [x] **LangGraph execution engine (optional)** (NEW!)
- [x] **Repository management phase (git/gh automation)** (NEW!)

### In Progress 🚧
- [ ] Enhanced SDD constraints (finer-grained rule control)

### Planned 📋
- [ ] RAG experience base integration (learn from historical tasks)
- [ ] GUI agent auto-testing (Playwright-based)
- [ ] VS Code plugin (use directly in IDE)
- [ ] Multi-agent collaboration (decompose large tasks)
- [ ] Custom MCP server support (user-defined tools)
- [ ] Code review mode (auto-check code quality)
- [ ] Incremental update mode (only modify necessary parts)

## Contributing

Contributions are welcome! Please feel free to submit issues, bug reports, or suggestions.

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT
