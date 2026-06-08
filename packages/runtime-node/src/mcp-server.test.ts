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

describe('createFrontAgentMcpServer contract', () => {
  beforeEach(() => {
    listSkills.mockClear();
    runFrontAgentTask.mockClear();
    planFrontAgentTask.mockClear();
  });

  it('lists the public runtime MCP tools with stable schemas', async () => {
    const server = createFrontAgentMcpServer({ projectRoot: '/workspace/project' });
    const handler = getRequestHandler(server, ListToolsRequestSchema.shape.method.value);

    const result = (await handler({ method: 'tools/list' })) as {
      tools: Array<{
        name: string;
        description: string;
        inputSchema: {
          type: string;
          properties: Record<string, unknown>;
          required: string[];
        };
      }>;
    };

    expect(result.tools.map((tool) => tool.name)).toEqual([
      'frontagent_status',
      'frontagent_run_task',
      'frontagent_plan_task',
      'frontagent_validate_sdd',
      'frontagent_list_skills',
      'frontagent_init_sdd',
    ]);

    expect(result.tools.find((tool) => tool.name === 'frontagent_status')?.inputSchema).toEqual({
      type: 'object',
      properties: {},
      required: [],
    });
    expect(
      result.tools.find((tool) => tool.name === 'frontagent_list_skills')?.inputSchema,
    ).toEqual({
      type: 'object',
      properties: {},
      required: [],
    });
    expect(
      result.tools.find((tool) => tool.name === 'frontagent_run_task')?.inputSchema.required,
    ).toEqual(['task']);
    expect(
      Object.keys(
        result.tools.find((tool) => tool.name === 'frontagent_run_task')?.inputSchema.properties ??
          {},
      ),
    ).toEqual(expect.arrayContaining(['task', 'type', 'files', 'securityMode', 'runLog']));
    expect(
      result.tools.find((tool) => tool.name === 'frontagent_plan_task')?.inputSchema.required,
    ).toEqual(['task']);
    expect(
      result.tools.find((tool) => tool.name === 'frontagent_validate_sdd')?.inputSchema.required,
    ).toEqual([]);
    expect(
      result.tools.find((tool) => tool.name === 'frontagent_init_sdd')?.inputSchema.required,
    ).toEqual([]);
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
