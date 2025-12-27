# 两阶段 Agent 架构

## 问题背景

在原始的单阶段架构中，Planner 使用 `generateObject` 在 JSON 中直接生成包含大量代码的执行计划，导致：
- **JSONParseError**: `Unterminated string in JSON` - JSON 中的代码字符串包含未转义的引号和特殊字符
- **Token 限制**: 大量代码导致 JSON 响应超过 token 限制
- **可维护性差**: 在 JSON schema 中处理代码生成逻辑复杂且容易出错

## 解决方案：两阶段架构

将 Agent 拆分为两个严格分离的阶段：

### **Stage 1: Planner（纯结构化规划）**
- **职责**: 只生成结构化的执行步骤描述，不生成代码
- **输出**: 使用 `generateObject` 返回符合严格 schema 的计划
- **关键点**:
  - 在 `params` 中不包含实际代码
  - 对于 `create_file`：只包含 `path` 和 `codeDescription`（代码的自然语言描述）
  - 对于 `apply_patch`：只包含 `path` 和 `changeDescription`（修改的自然语言描述）
  - 设置 `needsCodeGeneration` 标志来标识需要代码生成的步骤

### **Stage 2: Executor（逐文件代码生成 + 执行）**
- **职责**: 执行步骤，并在需要时动态生成代码
- **输出**: 使用 `generateText` 为每个文件单独生成代码
- **关键点**:
  - 检查步骤的 `needsCodeGeneration` 标志
  - 如果需要代码，调用 LLMService 的 `generateCodeForFile` 或 `generateModifiedCode`
  - 使用 `generateText` 而不是 `generateObject`，避免 JSON 解析问题
  - 将生成的代码添加到 params 中，然后调用 MCP 工具

## 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                        Two-Stage Agent                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Stage 1: Planner (Structured Planning)                  │  │
│  │  ┌──────────────────────────────────────────────────┐    │  │
│  │  │ Input: Task Description + Context                │    │  │
│  │  │ Process: LLM.generateObject()                    │    │  │
│  │  │ Output: ExecutionPlan (without code)             │    │  │
│  │  └──────────────────────────────────────────────────┘    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Stage 2: Executor (Dynamic Code Generation + Execution) │  │
│  │  ┌──────────────────────────────────────────────────┐    │  │
│  │  │ For each step:                                    │    │  │
│  │  │   if needsCodeGeneration:                         │    │  │
│  │  │     code = LLM.generateText()  ← avoids JSON!    │    │  │
│  │  │     params.content = code                         │    │  │
│  │  │   MCPClient.callTool(params)                      │    │  │
│  │  └──────────────────────────────────────────────────┘    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 实现细节

### 1. Planner 修改

**GeneratedPlanSchema 更新:**
```typescript
const GeneratedPlanSchema = z.object({
  summary: z.string(),
  steps: z.array(z.object({
    description: z.string(),
    action: z.enum([...]),
    tool: z.string(),
    params: z.object({
      path: z.string().optional(),
      codeDescription: z.string().optional(),  // ← 代码的描述，不是代码本身
      changeDescription: z.string().optional(), // ← 修改的描述，不是实际修改
      // ... 其他参数
    }).passthrough(),
    reasoning: z.string(),
    needsCodeGeneration: z.boolean().optional(), // ← 标识需要代码生成
  })),
  risks: z.array(z.string()).optional(),
  alternatives: z.array(z.string()).optional(),
});
```

**System Prompt 更新:**
```typescript
const system = `你是一个专业的前端工程 AI Agent，负责分析任务并生成执行计划。

# 两阶段 Agent 架构说明
你当前处于 Stage 1（规划阶段），只需要生成结构化的执行步骤描述，**不要生成任何实际代码**。
代码会在 Stage 2（执行阶段）由专门的代码生成器逐文件生成。

# 重要原则
1. **不要在 params 中包含任何代码**
2. **描述而非代码**：用自然语言描述要做什么
3. **设置 needsCodeGeneration 标志**：对于需要生成代码的步骤，将 needsCodeGeneration 设为 true
4. **清晰的文件路径**：确保 path 参数准确无误

# 示例
正确的 create_file 步骤：
{
  "description": "创建 Button 组件文件",
  "action": "create_file",
  "tool": "create_file",
  "params": {
    "path": "src/components/Button.tsx",
    "codeDescription": "创建一个支持 loading 状态和不同尺寸的 React Button 组件，使用 TypeScript 和 Tailwind CSS"
  },
  "reasoning": "需要一个可复用的按钮组件",
  "needsCodeGeneration": true
}

错误示例（不要这样做）：
{
  "params": {
    "path": "src/components/Button.tsx",
    "content": "export const Button = () => { ... }" // ❌ 不要包含实际代码
  }
}
`;
```

### 2. LLMService 新增方法

**generateCodeForFile (使用 generateText):**
```typescript
async generateCodeForFile(options: {
  task: string;
  filePath: string;
  codeDescription: string;
  context: string;
  existingCode?: string;
  language: string;
  sddConstraints?: string;
}): Promise<string> {
  const system = `你是一个专业的前端工程 AI Agent，负责生成高质量的代码。

# 任务说明
- 文件路径: ${options.filePath}
- 语言: ${options.language}
- 要求: ${options.codeDescription}

# 输出格式
直接输出完整的代码，不要包含任何 markdown 代码块标记（\`\`\`）或其他格式。
只输出纯代码内容，从第一行代码开始，到最后一行代码结束。`;

  const code = await this.generateText({ messages, system, temperature: 0.2 });

  // 清理可能的 markdown 代码块标记
  return code
    .replace(/^```[\w]*\n/m, '')
    .replace(/\n```$/m, '')
    .trim();
}
```

**generateModifiedCode (使用 generateText):**
```typescript
async generateModifiedCode(options: {
  originalCode: string;
  changeDescription: string;
  filePath: string;
  language: string;
  sddConstraints?: string;
}): Promise<string> {
  // 类似 generateCodeForFile，但接受原始代码和修改描述
  // 返回修改后的完整代码
}
```

### 3. Executor 动态代码生成

**executeStep 修改:**
```typescript
async executeStep(
  step: ExecutionStep,
  context: {
    task: AgentTask;
    collectedContext: { files: Map<string, string> };
    sddConstraints?: string;
  }
): Promise<ExecutorOutput> {
  // ... 执行前验证 ...

  // 2. 动态代码生成（如果需要）
  let toolParams = { ...step.params };
  const stepAny = step as any;

  if (stepAny.needsCodeGeneration && (step.action === 'create_file' || step.action === 'apply_patch')) {
    const filePath = toolParams.filePath as string;
    const language = this.detectLanguage(filePath);

    if (step.action === 'create_file') {
      const codeDescription = toolParams.codeDescription || step.description;
      const code = await this.config.llmService.generateCodeForFile({
        task: context.task.description,
        filePath,
        codeDescription,
        context: this.buildContextString(context.collectedContext),
        language: language || 'typescript',
        sddConstraints: context.sddConstraints,
      });

      toolParams = { ...toolParams, content: code };

    } else if (step.action === 'apply_patch') {
      const changeDescription = toolParams.changeDescription || step.description;
      const originalCode = context.collectedContext.files.get(filePath) || '';

      const modifiedCode = await this.config.llmService.generateModifiedCode({
        originalCode,
        changeDescription,
        filePath,
        language: language || 'typescript',
        sddConstraints: context.sddConstraints,
      });

      toolParams = { ...toolParams, content: modifiedCode };
    }
  }

  // 3. 调用 MCP 工具
  const toolResult = await this.callTool(step.tool, toolParams);

  // ... 后续处理 ...
}
```

### 4. Agent 集成

**构造函数更新:**
```typescript
constructor(config: AgentConfig) {
  // ... 初始化 ...

  // 初始化 LLM 服务
  this.llmService = new LLMService(config.llm);

  // 初始化 Executor（传递 llmService）
  this.executor = new Executor({
    hallucinationGuard: this.hallucinationGuard,
    llmService: this.llmService,  // ← 传递 LLM 服务
    debug: config.debug
  });
}
```

**execute 方法更新:**
```typescript
async execute(taskInput: string | AgentTask, options?: TaskExecuteOptions): Promise<AgentExecutionResult> {
  // ... 规划阶段 ...

  // 执行阶段
  const executionContext = this.contextManager.getContext(task.id);

  await this.executor.executeSteps(
    planResult.plan.steps,
    {
      task,
      collectedContext: { files: executionContext.collectedContext.files },
      sddConstraints: this.promptGenerator?.generate(),
    },
    (step, output) => { /* 回调 */ }
  );

  // ... 结果处理 ...
}
```

## 优势

### 1. **彻底避免 JSON 解析错误**
- Planner 只生成简单的结构化数据，不包含代码
- 代码生成使用 `generateText`，直接返回纯文本

### 2. **更好的 Token 利用**
- Planner 的响应更小，可以生成更多步骤
- 代码生成是按需的，只在执行时生成

### 3. **更灵活的代码生成**
- 可以为每个文件单独调整 prompt
- 可以利用执行过程中收集的上下文
- 可以在生成代码前读取相关文件

### 4. **更好的错误处理**
- 如果代码生成失败，只影响单个步骤
- 可以重试单个文件的代码生成

### 5. **更清晰的职责分离**
- Planner：专注于任务分解和规划
- Executor：专注于执行和代码生成
- LLMService：专注于不同类型的 LLM 调用

## 示例流程

### 用户任务
```
"创建一个 Button 组件，支持 loading 状态"
```

### Stage 1: Planner 输出
```json
{
  "summary": "创建 Button 组件文件",
  "steps": [
    {
      "description": "创建 Button.tsx 组件文件",
      "action": "create_file",
      "tool": "create_file",
      "params": {
        "path": "src/components/Button.tsx",
        "codeDescription": "创建一个 React Button 组件，支持 loading 状态、不同尺寸(sm/md/lg)、禁用状态，使用 TypeScript 和 Tailwind CSS"
      },
      "reasoning": "需要创建组件文件",
      "needsCodeGeneration": true
    }
  ]
}
```

### Stage 2: Executor 处理

1. **检测到 needsCodeGeneration = true**
2. **调用 LLMService.generateCodeForFile**
   - 输入: codeDescription
   - 输出: 完整的 TypeScript 代码（纯文本）
3. **将代码添加到 params.content**
4. **调用 MCP tool: create_file**
   - 参数: `{ path: "...", content: "<生成的代码>" }`
5. **验证并返回结果**

## 迁移指南

如果你的项目还在使用旧的单阶段架构，可以按以下步骤迁移：

1. **更新 Planner prompt**：添加两阶段架构说明
2. **更新 GeneratedPlanSchema**：添加 `needsCodeGeneration` 字段
3. **在 LLMService 中添加新方法**：`generateCodeForFile` 和 `generateModifiedCode`
4. **更新 Executor**：添加动态代码生成逻辑
5. **更新 Agent**：传递上下文给 Executor
6. **测试**：确保代码生成正确工作

## 总结

两阶段 Agent 架构通过严格分离规划和执行，彻底解决了 JSON 中生成代码导致的解析错误问题。这是一个更可靠、更灵活、更易于维护的架构设计。
