import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listSkills = vi.fn(() => [
  {
    name: 'frontend-design',
    description: 'Design polished frontend UI',
    source: 'built-in',
    skillFilePath: '/skills/frontend-design/SKILL.md',
  },
]);

const runFrontAgentTask = vi.fn(async () => {
  throw new Error('frontagent_run_task should not be invoked by contract tests');
});

const planFrontAgentTask = vi.fn(async () => {
  throw new Error('frontagent_plan_task should not be invoked by contract tests');
});

vi.mock('@frontagent/core', () => ({
  LLMService: vi.fn(function LLMService() {}),
  SkillLab: vi.fn(function SkillLab() {
    return {
      listSkills,
    };
  }),
}));

vi.mock('./run.js', () => ({
  runFrontAgentTask,
  planFrontAgentTask,
}));

vi.mock('./sampling-llm.js', () => ({
  SamplingLLMBackend: vi.fn(function SamplingLLMBackend() {}),
}));

const { createFrontAgentMcpServer } = await import('./mcp-server.js');

function getRequestHandler(
  server: unknown,
  method: string,
): (request: { method: string; params?: Record<string, unknown> }) => Promise<unknown> {
  const handlers = (
    server as { _requestHandlers: Map<string, (request: unknown) => Promise<unknown>> }
  )._requestHandlers;
  const handler = handlers.get(method);
  if (!handler) {
    throw new Error(`Missing handler for ${method}`);
  }
  return handler as (request: {
    method: string;
    params?: Record<string, unknown>;
  }) => Promise<unknown>;
}

function parseTextResult(result: unknown): Record<string, unknown> {
  const text = (result as { content: Array<{ type: string; text: string }> }).content[0]?.text;
  return JSON.parse(text) as Record<string, unknown>;
}

function textResultIsError(result: unknown): boolean | undefined {
  return (result as { isError?: boolean }).isError;
}

type ListedTool = {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
};

const sharedTaskPropertyNames = [
  'task',
  'type',
  'files',
  'url',
  'sddPath',
  'securityMode',
  'disableRag',
  'ragSource',
  'ragRepo',
  'ragBranch',
  'openVikingEndpoint',
  'openVikingCorpus',
  'openVikingNamespace',
  'openVikingL1Entry',
  'filesenseEnabled',
  'filesenseOutput',
  'filesenseWriteMode',
  'filesenseMaxEntries',
  'filesenseMaxBytes',
  'filesenseTimeoutMs',
  'runLog',
  'logFile',
  'debug',
  'provider',
  'model',
  'baseUrl',
  'apiKey',
  'maxTokens',
  'temperature',
  'topP',
  'topK',
];

function toolByName(tools: ListedTool[], name: string): ListedTool {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new Error(`Missing tool ${name}`);
  }
  return tool;
}

function expectSharedTaskSchema(tool: ListedTool): void {
  expect(tool.inputSchema.type).toBe('object');
  expect(tool.inputSchema.required).toEqual(['task']);
  expect(Object.keys(tool.inputSchema.properties)).toEqual(sharedTaskPropertyNames);
  expect(tool.inputSchema.properties).toMatchObject({
    task: { type: 'string' },
    type: {
      type: 'string',
      enum: ['create', 'modify', 'debug', 'query', 'refactor', 'test'],
    },
    files: {
      type: 'array',
      items: { type: 'string' },
    },
    url: { type: 'string' },
    sddPath: { type: 'string' },
    securityMode: {
      type: 'string',
      enum: ['balanced', 'strict', 'developer'],
    },
    disableRag: { type: 'boolean' },
    ragSource: {
      type: 'string',
      enum: ['git', 'openviking', 'composite'],
    },
    ragRepo: { type: 'string' },
    ragBranch: { type: 'string' },
    openVikingEndpoint: { type: 'string' },
    openVikingCorpus: { type: 'string' },
    openVikingNamespace: { type: 'string' },
    openVikingL1Entry: { type: 'string' },
    filesenseEnabled: { type: 'boolean' },
    filesenseOutput: {
      type: 'string',
      enum: ['summary', 'candidates', 'verbose'],
    },
    filesenseWriteMode: {
      type: 'string',
      enum: ['cache', 'workspace', 'none'],
    },
    filesenseMaxEntries: { type: ['string', 'number'] },
    filesenseMaxBytes: { type: ['string', 'number'] },
    filesenseTimeoutMs: { type: ['string', 'number'] },
    runLog: { type: 'boolean' },
    logFile: { type: 'string' },
    debug: { type: 'boolean' },
    provider: {
      type: 'string',
      enum: ['openai', 'anthropic'],
    },
    model: { type: 'string' },
    baseUrl: { type: 'string' },
    apiKey: { type: 'string' },
    maxTokens: { type: ['string', 'number'] },
    temperature: { type: ['string', 'number'] },
    topP: { type: ['string', 'number'] },
    topK: { type: ['string', 'number'] },
  });
}

const securityDecision = {
  decision: 'deny',
  riskLevel: 'high',
  reasonCode: 'blocked_command',
  message: 'Command blocked',
  toolName: 'run_command',
  argsSummary: 'rm -rf dist',
  provenance: [{ source: 'builtin', ruleId: 'dangerous-command' }],
};

describe('createFrontAgentMcpServer contract', () => {
  beforeEach(() => {
    listSkills.mockClear();
    runFrontAgentTask.mockClear();
    planFrontAgentTask.mockClear();
  });

  it('lists the public runtime MCP tools with stable schemas', async () => {
    const server = createFrontAgentMcpServer({ projectRoot: '/workspace/project' });
    const handler = getRequestHandler(server, ListToolsRequestSchema.shape.method.value);

    const result = (await handler({ method: 'tools/list' })) as { tools: ListedTool[] };

    expect(result.tools.map((tool) => tool.name)).toEqual([
      'frontagent_status',
      'frontagent_run_task',
      'frontagent_plan_task',
      'frontagent_validate_sdd',
      'frontagent_list_skills',
      'frontagent_init_sdd',
    ]);

    expect(toolByName(result.tools, 'frontagent_status').inputSchema).toEqual({
      type: 'object',
      properties: {},
      required: [],
    });
    expect(toolByName(result.tools, 'frontagent_list_skills').inputSchema).toEqual({
      type: 'object',
      properties: {},
      required: [],
    });
    expectSharedTaskSchema(toolByName(result.tools, 'frontagent_run_task'));
    expectSharedTaskSchema(toolByName(result.tools, 'frontagent_plan_task'));
    expect(toolByName(result.tools, 'frontagent_validate_sdd').inputSchema).toEqual({
      type: 'object',
      properties: {
        sddPath: {
          type: 'string',
          description: 'Project-relative SDD path. Defaults to sdd.yaml.',
        },
      },
      required: [],
    });
    expect(toolByName(result.tools, 'frontagent_init_sdd').inputSchema).toEqual({
      type: 'object',
      properties: {
        output: {
          type: 'string',
          description: 'Project-relative output path. Defaults to sdd.yaml.',
        },
        force: {
          type: 'boolean',
          description: 'Overwrite an existing SDD file. Defaults to false.',
        },
      },
      required: [],
    });
  });

  it('dispatches frontagent_list_skills without invoking task execution or planning', async () => {
    const server = createFrontAgentMcpServer({ projectRoot: '/workspace/project' });
    const handler = getRequestHandler(server, CallToolRequestSchema.shape.method.value);

    const result = await handler({
      method: 'tools/call',
      params: {
        name: 'frontagent_list_skills',
        arguments: {},
      },
    });
    const payload = parseTextResult(result);

    expect(payload).toEqual({
      success: true,
      projectRoot: '/workspace/project',
      projectRootSource: 'explicit',
      skills: [
        {
          name: 'frontend-design',
          description: 'Design polished frontend UI',
          source: 'built-in',
          path: '/skills/frontend-design/SKILL.md',
        },
      ],
    });
    expect(listSkills).toHaveBeenCalledTimes(1);
    expect(runFrontAgentTask).not.toHaveBeenCalled();
    expect(planFrontAgentTask).not.toHaveBeenCalled();
  });

  it('dispatches frontagent_run_task with stable payload and error flag', async () => {
    runFrontAgentTask.mockImplementationOnce(async (options) => {
      options.onRunLogPath('/workspace/project/.frontagent/runs/run-1.json');
      options.onEvent({ type: 'security_decision', decision: securityDecision });
      return {
        success: false,
        taskId: 'task-1',
        output: 'partial output',
        error: 'run failed',
        duration: 42,
        validations: [],
        executedSteps: [
          {
            stepId: 'step-1',
            phase: 'Build',
            action: 'run',
            tool: 'run_command',
            status: 'failed',
            description: 'Run build',
            result: { success: false, error: 'command denied' },
          },
        ],
      };
    });
    const server = createFrontAgentMcpServer({ projectRoot: '/workspace/project' });
    const handler = getRequestHandler(server, CallToolRequestSchema.shape.method.value);

    const result = await handler({
      method: 'tools/call',
      params: {
        name: 'frontagent_run_task',
        arguments: {
          task: 'Build project',
          type: 'test',
          securityMode: 'strict',
        },
      },
    });
    const payload = parseTextResult(result);

    expect(payload).toEqual({
      success: false,
      taskId: 'task-1',
      output: 'partial output',
      error: 'run failed',
      duration: 42,
      runLogPath: '/workspace/project/.frontagent/runs/run-1.json',
      executedStepsSummary: [
        {
          stepId: 'step-1',
          phase: 'Build',
          action: 'run',
          tool: 'run_command',
          status: 'failed',
          description: 'Run build',
          error: 'command denied',
        },
      ],
      securityDecisions: [securityDecision],
    });
    expect(textResultIsError(result)).toBe(true);
    expect(runFrontAgentTask).toHaveBeenCalledTimes(1);
    expect(planFrontAgentTask).not.toHaveBeenCalled();
  });

  it('dispatches frontagent_plan_task with stable payload and success flag', async () => {
    planFrontAgentTask.mockImplementationOnce(async (options) => {
      options.onRunLogPath('/workspace/project/.frontagent/runs/plan-1.json');
      options.onEvent({ type: 'security_decision', decision: securityDecision });
      return {
        success: true,
        taskId: 'plan-1',
        plan: {
          taskId: 'plan-1',
          phases: [],
          steps: [],
          estimatedDuration: 0,
          risks: [],
        },
        duration: 7,
      };
    });
    const server = createFrontAgentMcpServer({ projectRoot: '/workspace/project' });
    const handler = getRequestHandler(server, CallToolRequestSchema.shape.method.value);

    const result = await handler({
      method: 'tools/call',
      params: {
        name: 'frontagent_plan_task',
        arguments: {
          task: 'Plan project',
          type: 'query',
          disableRag: true,
        },
      },
    });
    const payload = parseTextResult(result);

    expect(payload).toEqual({
      success: true,
      taskId: 'plan-1',
      plan: {
        taskId: 'plan-1',
        phases: [],
        steps: [],
        estimatedDuration: 0,
        risks: [],
      },
      duration: 7,
      runLogPath: '/workspace/project/.frontagent/runs/plan-1.json',
      securityDecisions: [securityDecision],
    });
    expect(textResultIsError(result)).toBe(false);
    expect(planFrontAgentTask).toHaveBeenCalledTimes(1);
    expect(runFrontAgentTask).not.toHaveBeenCalled();
  });
});
