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
});
