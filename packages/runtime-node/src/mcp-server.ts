#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type AgentEvent, type LLMBackend, LLMService, SkillLab } from '@frontagent/core';
import type { SecurityDecision } from '@frontagent/shared';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  getDefaultRagCacheDir,
  type RuntimeConfigInput,
  resolveBuiltInSkillRoots,
  resolveRuntimeConfig,
} from './config.js';
import { planFrontAgentTask, type RunFrontAgentTaskOptions, runFrontAgentTask } from './run.js';
import { SamplingLLMBackend } from './sampling-llm.js';
import { initSddConfig, validateSddConfig } from './sdd.js';

export interface FrontAgentMcpServerOptions extends RuntimeConfigInput {
  projectRoot?: string;
  builtInSkillRoots?: string[];
  debug?: boolean | string;
  logFile?: string;
}

type ToolResultPayload = Record<string, unknown>;
type ProjectRootResolution = {
  projectRoot: string;
  source: 'explicit' | 'host_roots' | 'cwd';
};

function textResult(payload: ToolResultPayload, isError = false) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
    isError,
  };
}

function boolValue(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function stringArrayValue(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length > 0 ? values : undefined;
}

function samplingSupported(server: Server): boolean {
  const capabilities = server.getClientCapabilities() as
    | {
        sampling?: object;
        tasks?: { requests?: { sampling?: object } };
      }
    | undefined;
  return Boolean(capabilities?.sampling || capabilities?.tasks?.requests?.sampling);
}

function rootsSupported(server: Server): boolean {
  const capabilities = server.getClientCapabilities() as
    | {
        roots?: object;
      }
    | undefined;
  return Boolean(capabilities?.roots);
}

function rootUriToPath(uri: string): string | undefined {
  if (!uri.startsWith('file://')) return undefined;
  try {
    return fileURLToPath(uri);
  } catch {
    return undefined;
  }
}

async function resolveProjectRoot(
  server: Server,
  configuredProjectRoot?: string,
): Promise<ProjectRootResolution> {
  if (configuredProjectRoot) {
    return {
      projectRoot: resolve(configuredProjectRoot),
      source: 'explicit',
    };
  }

  if (rootsSupported(server)) {
    try {
      const response = await server.listRoots();
      const fileRoots = response.roots
        .map((root) => rootUriToPath(root.uri))
        .filter((root): root is string => Boolean(root));

      if (fileRoots.length === 1) {
        return {
          projectRoot: resolve(fileRoots[0]),
          source: 'host_roots',
        };
      }

      if (fileRoots.length > 1) {
        throw new Error(
          `Host exposed multiple workspace roots (${fileRoots.join(', ')}). Start FrontAgent with --project-root to choose one explicitly.`,
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('multiple workspace roots')) {
        throw error;
      }
    }
  }

  return {
    projectRoot: resolve(process.cwd()),
    source: 'cwd',
  };
}

function createAutoBackend(
  server: Server,
  input: RuntimeConfigInput,
  projectRoot: string,
): LLMBackend {
  const resolved = resolveRuntimeConfig(input, projectRoot);
  const direct = new LLMService(resolved.llm);
  return new SamplingLLMBackend({
    server: server as unknown as ConstructorParameters<typeof SamplingLLMBackend>[0]['server'],
    fallback: direct,
  });
}

function createSkillLab(projectRoot: string, builtInSkillRoots?: string[]): SkillLab {
  return new SkillLab({
    projectRoot,
    skillContent: {
      builtInSkillRoots: resolveBuiltInSkillRoots(builtInSkillRoots),
    },
  });
}

function summarizeExecutedSteps(result: Awaited<ReturnType<typeof runFrontAgentTask>>) {
  return result.executedSteps.map((step) => ({
    stepId: step.stepId,
    phase: step.phase,
    action: step.action,
    tool: step.tool,
    status: step.status,
    description: step.description,
    error: step.result?.error,
  }));
}

function collectSecurityDecisions(
  events: AgentEvent[],
  decisions: SecurityDecision[],
): (event: AgentEvent) => void {
  return (event) => {
    events.push(event);
    if (event.type === 'security_decision') {
      decisions.push(event.decision);
    }
  };
}

function toRuntimeInput(
  args: Record<string, unknown>,
  defaults: FrontAgentMcpServerOptions,
): RuntimeConfigInput {
  return {
    provider: stringValue(args.provider) ?? defaults.provider,
    model: stringValue(args.model) ?? defaults.model,
    baseUrl: stringValue(args.baseUrl) ?? defaults.baseUrl,
    apiKey: stringValue(args.apiKey) ?? defaults.apiKey,
    maxTokens: (args.maxTokens as string | number | undefined) ?? defaults.maxTokens,
    temperature: (args.temperature as string | number | undefined) ?? defaults.temperature,
    topP: (args.topP as string | number | undefined) ?? defaults.topP,
    topK: (args.topK as string | number | undefined) ?? defaults.topK,
    engine: stringValue(args.engine) ?? defaults.engine,
    securityMode: stringValue(args.securityMode) ?? defaults.securityMode ?? 'balanced',
    disableRag: boolValue(args.disableRag, defaults.disableRag ?? false),
    ragSource: stringValue(args.ragSource) ?? defaults.ragSource,
    ragRepo: stringValue(args.ragRepo) ?? defaults.ragRepo,
    ragBranch: stringValue(args.ragBranch) ?? defaults.ragBranch,
    ragSyncOnQuery: boolValue(args.ragSyncOnQuery, Boolean(defaults.ragSyncOnQuery ?? false)),
    ragMaxResults: (args.ragMaxResults as string | number | undefined) ?? defaults.ragMaxResults,
    ragKeywordCandidates:
      (args.ragKeywordCandidates as string | number | undefined) ?? defaults.ragKeywordCandidates,
    ragSemanticCandidates:
      (args.ragSemanticCandidates as string | number | undefined) ?? defaults.ragSemanticCandidates,
    ragKeywordWeight:
      (args.ragKeywordWeight as string | number | undefined) ?? defaults.ragKeywordWeight,
    ragSemanticWeight:
      (args.ragSemanticWeight as string | number | undefined) ?? defaults.ragSemanticWeight,
    ragChunkSize: (args.ragChunkSize as string | number | undefined) ?? defaults.ragChunkSize,
    ragChunkOverlap:
      (args.ragChunkOverlap as string | number | undefined) ?? defaults.ragChunkOverlap,
    ragMaxFileSizeKb:
      (args.ragMaxFileSizeKb as string | number | undefined) ?? defaults.ragMaxFileSizeKb,
    ragExcludePath: stringArrayValue(args.ragExcludePath) ?? defaults.ragExcludePath,
    disableRagQueryRewrite: boolValue(
      args.disableRagQueryRewrite,
      defaults.disableRagQueryRewrite ?? false,
    ),
    ragQueryRewriteMaxTokens:
      (args.ragQueryRewriteMaxTokens as string | number | undefined) ??
      defaults.ragQueryRewriteMaxTokens,
    ragQueryRewriteTemperature:
      (args.ragQueryRewriteTemperature as string | number | undefined) ??
      defaults.ragQueryRewriteTemperature,
    disableRagReranker: boolValue(args.disableRagReranker, defaults.disableRagReranker ?? false),
    ragRerankerModel: stringValue(args.ragRerankerModel) ?? defaults.ragRerankerModel,
    ragRerankerBaseUrl: stringValue(args.ragRerankerBaseUrl) ?? defaults.ragRerankerBaseUrl,
    ragRerankerApiKey: stringValue(args.ragRerankerApiKey) ?? defaults.ragRerankerApiKey,
    ragRerankerCandidateCount:
      (args.ragRerankerCandidateCount as string | number | undefined) ??
      defaults.ragRerankerCandidateCount,
    ragRerankerMaxDocumentChars:
      (args.ragRerankerMaxDocumentChars as string | number | undefined) ??
      defaults.ragRerankerMaxDocumentChars,
    ragRerankerTimeoutMs:
      (args.ragRerankerTimeoutMs as string | number | undefined) ?? defaults.ragRerankerTimeoutMs,
    disableRagSemantic: boolValue(args.disableRagSemantic, defaults.disableRagSemantic ?? false),
    ragEmbeddingModel: stringValue(args.ragEmbeddingModel) ?? defaults.ragEmbeddingModel,
    ragEmbeddingBaseUrl: stringValue(args.ragEmbeddingBaseUrl) ?? defaults.ragEmbeddingBaseUrl,
    ragEmbeddingApiKey: stringValue(args.ragEmbeddingApiKey) ?? defaults.ragEmbeddingApiKey,
    ragEmbeddingDimensions:
      (args.ragEmbeddingDimensions as string | number | undefined) ??
      defaults.ragEmbeddingDimensions,
    ragEmbeddingBatchSize:
      (args.ragEmbeddingBatchSize as string | number | undefined) ?? defaults.ragEmbeddingBatchSize,
    ragEmbeddingTimeoutMs:
      (args.ragEmbeddingTimeoutMs as string | number | undefined) ?? defaults.ragEmbeddingTimeoutMs,
    ragVectorStoreProvider:
      stringValue(args.ragVectorStoreProvider) ?? defaults.ragVectorStoreProvider,
    ragWeaviateUrl: stringValue(args.ragWeaviateUrl) ?? defaults.ragWeaviateUrl,
    ragWeaviateApiKey: stringValue(args.ragWeaviateApiKey) ?? defaults.ragWeaviateApiKey,
    ragWeaviateCollectionPrefix:
      stringValue(args.ragWeaviateCollectionPrefix) ?? defaults.ragWeaviateCollectionPrefix,
    ragWeaviateBatchSize:
      (args.ragWeaviateBatchSize as string | number | undefined) ?? defaults.ragWeaviateBatchSize,
    ragWeaviateTimeoutMs:
      (args.ragWeaviateTimeoutMs as string | number | undefined) ?? defaults.ragWeaviateTimeoutMs,
    openVikingEnabled: boolValue(
      args.openVikingEnabled,
      Boolean(defaults.openVikingEnabled ?? false),
    ),
    openVikingEndpoint: stringValue(args.openVikingEndpoint) ?? defaults.openVikingEndpoint,
    openVikingApiKey: stringValue(args.openVikingApiKey) ?? defaults.openVikingApiKey,
    openVikingCorpus: stringValue(args.openVikingCorpus) ?? defaults.openVikingCorpus,
    openVikingNamespace: stringValue(args.openVikingNamespace) ?? defaults.openVikingNamespace,
    openVikingL1Entry: stringValue(args.openVikingL1Entry) ?? defaults.openVikingL1Entry,
    openVikingTimeoutMs:
      (args.openVikingTimeoutMs as string | number | undefined) ?? defaults.openVikingTimeoutMs,
    disableOpenVikingFallback: boolValue(
      args.disableOpenVikingFallback,
      Boolean(defaults.disableOpenVikingFallback ?? false),
    ),
    filesenseEnabled: boolValue(args.filesenseEnabled, Boolean(defaults.filesenseEnabled ?? true)),
    filesenseOutput: stringValue(args.filesenseOutput) ?? defaults.filesenseOutput,
    filesenseWriteMode: stringValue(args.filesenseWriteMode) ?? defaults.filesenseWriteMode,
    filesenseMaxEntries:
      (args.filesenseMaxEntries as string | number | undefined) ?? defaults.filesenseMaxEntries,
    filesenseMaxBytes:
      (args.filesenseMaxBytes as string | number | undefined) ?? defaults.filesenseMaxBytes,
    filesenseTimeoutMs:
      (args.filesenseTimeoutMs as string | number | undefined) ?? defaults.filesenseTimeoutMs,
  };
}

function toRunOptions(input: {
  args: Record<string, unknown>;
  defaults: FrontAgentMcpServerOptions;
  projectRoot: string;
  llmBackend: LLMBackend;
  runLogPathRef: { value: string | null };
  onEvent: (event: AgentEvent) => void;
}): RunFrontAgentTaskOptions {
  return {
    ...toRuntimeInput(input.args, input.defaults),
    projectRoot: input.projectRoot,
    task: stringValue(input.args.task) ?? '',
    type: stringValue(input.args.type) ?? 'query',
    files: stringArrayValue(input.args.files),
    url: stringValue(input.args.url),
    sddPath: stringValue(input.args.sddPath) ?? 'sdd.yaml',
    runLog: boolValue(input.args.runLog, true),
    logFile: stringValue(input.args.logFile) ?? input.defaults.logFile,
    debug: boolValue(input.args.debug, false) || input.defaults.debug,
    filterConsole: true,
    streamShellOutput: false,
    builtInSkillRoots: input.defaults.builtInSkillRoots,
    codeQualityIsolationMode: 'in_memory',
    llmBackend: input.llmBackend,
    onRunLogPath: (path) => {
      input.runLogPathRef.value = path;
    },
    onEvent: input.onEvent,
    onApprovalRequest: () => Promise.resolve(false),
  };
}

const sharedTaskProperties = {
  task: { type: 'string', description: 'Natural-language FrontAgent task.' },
  type: {
    type: 'string',
    enum: ['create', 'modify', 'debug', 'query', 'refactor', 'test'],
    description: 'FrontAgent task type. Defaults to query.',
  },
  files: {
    type: 'array',
    items: { type: 'string' },
    description: 'Project-relative files relevant to the task.',
  },
  url: { type: 'string', description: 'Optional browser URL for web tasks.' },
  sddPath: { type: 'string', description: 'Project-relative SDD path. Defaults to sdd.yaml.' },
  securityMode: {
    type: 'string',
    enum: ['balanced', 'strict', 'developer'],
    description: 'Tool security mode. Defaults to balanced.',
  },
  disableRag: { type: 'boolean', description: 'Disable remote knowledge RAG for this call.' },
  ragSource: {
    type: 'string',
    enum: ['git', 'openviking', 'composite'],
    description: 'RAG knowledge source.',
  },
  ragRepo: { type: 'string', description: 'Remote RAG repository URL.' },
  ragBranch: { type: 'string', description: 'Remote RAG branch.' },
  openVikingEndpoint: { type: 'string', description: 'OpenViking knowledge query endpoint.' },
  openVikingCorpus: { type: 'string', description: 'OpenViking corpus name.' },
  openVikingNamespace: { type: 'string', description: 'OpenViking namespace.' },
  openVikingL1Entry: { type: 'string', description: 'OpenViking L1 navigation entry path.' },
  filesenseEnabled: {
    type: 'boolean',
    description: 'Enable lightweight Filesense navigation. Defaults to true.',
  },
  filesenseOutput: {
    type: 'string',
    enum: ['summary', 'candidates', 'verbose'],
    description: 'Filesense navigate output shape. Defaults to summary.',
  },
  filesenseWriteMode: {
    type: 'string',
    enum: ['cache', 'workspace', 'none'],
    description: 'Filesense navigate write mode. Defaults to cache.',
  },
  filesenseMaxEntries: {
    type: ['string', 'number'],
    description: 'Default Filesense navigate max entries budget.',
  },
  filesenseMaxBytes: {
    type: ['string', 'number'],
    description: 'Default Filesense navigate max bytes budget.',
  },
  filesenseTimeoutMs: {
    type: ['string', 'number'],
    description: 'Default Filesense navigate timeout in milliseconds.',
  },
  runLog: { type: 'boolean', description: 'Write FrontAgent run log. Defaults to true.' },
  logFile: { type: 'string', description: 'Optional FrontAgent run log path.' },
  debug: { type: 'boolean', description: 'Enable debug behavior for this call.' },
  provider: {
    type: 'string',
    enum: ['openai', 'anthropic'],
    description: 'Direct fallback LLM provider.',
  },
  model: { type: 'string', description: 'Direct fallback LLM model.' },
  baseUrl: { type: 'string', description: 'Direct fallback LLM API base URL.' },
  apiKey: { type: 'string', description: 'Direct fallback LLM API key.' },
  maxTokens: { type: ['string', 'number'], description: 'Max LLM output tokens.' },
  temperature: { type: ['string', 'number'], description: 'LLM temperature.' },
  topP: { type: ['string', 'number'], description: 'LLM top_p.' },
  topK: { type: ['string', 'number'], description: 'LLM top_k.' },
};

const tools = [
  {
    name: 'frontagent_status',
    description: 'Inspect FrontAgent MCP server status for the bound project.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'frontagent_run_task',
    description:
      'Run a full FrontAgent frontend-engineering task with planning, execution, validation, and summary output.',
    inputSchema: {
      type: 'object' as const,
      properties: sharedTaskProperties,
      required: ['task'],
    },
  },
  {
    name: 'frontagent_plan_task',
    description: 'Generate a FrontAgent execution plan without executing tools or writing files.',
    inputSchema: {
      type: 'object' as const,
      properties: sharedTaskProperties,
      required: ['task'],
    },
  },
  {
    name: 'frontagent_validate_sdd',
    description: 'Validate the project SDD configuration.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        sddPath: {
          type: 'string',
          description: 'Project-relative SDD path. Defaults to sdd.yaml.',
        },
      },
      required: [],
    },
  },
  {
    name: 'frontagent_list_skills',
    description: 'List FrontAgent content skills visible for this project.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'frontagent_init_sdd',
    description: 'Create a FrontAgent SDD template inside the project root.',
    inputSchema: {
      type: 'object' as const,
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
    },
  },
];

export function createFrontAgentMcpServer(options: FrontAgentMcpServerOptions = {}): Server {
  const configuredProjectRoot = options.projectRoot ? resolve(options.projectRoot) : undefined;
  const server = new Server(
    {
      name: 'frontagent-mcp-server',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;

    try {
      const projectRootResolution = await resolveProjectRoot(server, configuredProjectRoot);
      const { projectRoot } = projectRootResolution;

      switch (request.params.name) {
        case 'frontagent_status': {
          const runtimeInput = toRuntimeInput(args, options);
          const resolved = resolveRuntimeConfig(runtimeInput, projectRoot);
          const sddPath = resolve(projectRoot, 'sdd.yaml');
          const skills = createSkillLab(projectRoot, options.builtInSkillRoots).listSkills();
          return textResult({
            projectRoot,
            projectRootSource: projectRootResolution.source,
            sdd: {
              path: sddPath,
              exists: existsSync(sddPath),
            },
            skills: {
              count: skills.length,
              names: skills.map((skill) => skill.name),
            },
            llm: {
              strategy: 'auto',
              samplingSupported: samplingSupported(server),
              effectiveBackend: samplingSupported(server) ? 'sampling' : 'direct',
              directConfigured: Boolean(resolved.llm.apiKey),
              provider: resolved.provider,
              model: resolved.model,
              baseURL: resolved.llm.baseURL ?? null,
            },
            rag: {
              enabled: resolved.rag.enabled !== false,
              source: resolved.rag.source,
              repoUrl: resolved.rag.repoUrl,
              branch: resolved.rag.branch,
              cacheDir: resolved.rag.cacheDir ?? getDefaultRagCacheDir(projectRoot),
              openViking: {
                enabled: resolved.rag.openViking?.enabled ?? false,
                endpointConfigured: Boolean(resolved.rag.openViking?.endpoint),
                corpus: resolved.rag.openViking?.corpus ?? null,
                namespace: resolved.rag.openViking?.namespace ?? null,
                l1Entry: resolved.rag.openViking?.l1Entry ?? null,
                fallbackToGit: resolved.rag.openViking?.fallbackToGit ?? true,
              },
            },
            filesense: resolved.filesense,
            runLogs: {
              directory: resolve(projectRoot, '.frontagent', 'runs'),
            },
          });
        }

        case 'frontagent_run_task': {
          const events: AgentEvent[] = [];
          const securityDecisions: SecurityDecision[] = [];
          const runLogPathRef = { value: null as string | null };
          const runtimeInput = toRuntimeInput(args, options);
          const llmBackend = createAutoBackend(server, runtimeInput, projectRoot);
          const result = await runFrontAgentTask(
            toRunOptions({
              args,
              defaults: options,
              projectRoot,
              llmBackend,
              runLogPathRef,
              onEvent: collectSecurityDecisions(events, securityDecisions),
            }),
          );
          return textResult(
            {
              success: result.success,
              taskId: result.taskId,
              output: result.output,
              error: result.error,
              duration: result.duration,
              runLogPath: runLogPathRef.value,
              executedStepsSummary: summarizeExecutedSteps(result),
              securityDecisions,
            },
            !result.success,
          );
        }

        case 'frontagent_plan_task': {
          const events: AgentEvent[] = [];
          const securityDecisions: SecurityDecision[] = [];
          const runLogPathRef = { value: null as string | null };
          const runtimeInput = toRuntimeInput(args, options);
          const llmBackend = createAutoBackend(server, runtimeInput, projectRoot);
          const result = await planFrontAgentTask(
            toRunOptions({
              args,
              defaults: options,
              projectRoot,
              llmBackend,
              runLogPathRef,
              onEvent: collectSecurityDecisions(events, securityDecisions),
            }),
          );
          return textResult(
            {
              success: result.success,
              taskId: result.taskId,
              plan: result.plan,
              error: result.error,
              duration: result.duration,
              runLogPath: runLogPathRef.value,
              securityDecisions,
            },
            !result.success,
          );
        }

        case 'frontagent_validate_sdd': {
          return textResult(
            validateSddConfig(
              projectRoot,
              stringValue(args.sddPath) ?? 'sdd.yaml',
            ) as unknown as ToolResultPayload,
          );
        }

        case 'frontagent_list_skills': {
          const skills = createSkillLab(projectRoot, options.builtInSkillRoots).listSkills();
          return textResult({
            success: true,
            projectRoot,
            projectRootSource: projectRootResolution.source,
            skills: skills.map((skill) => ({
              name: skill.name,
              description: skill.description,
              source: skill.source,
              path: skill.skillFilePath,
            })),
          });
        }

        case 'frontagent_init_sdd': {
          return textResult(
            initSddConfig(projectRoot, stringValue(args.output) ?? 'sdd.yaml', {
              force: boolValue(args.force, false),
            }) as unknown as ToolResultPayload,
          );
        }

        default:
          return textResult(
            { success: false, error: `Unknown tool: ${request.params.name}` },
            true,
          );
      }
    } catch (error) {
      return textResult(
        {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
        true,
      );
    }
  });

  return server;
}

export async function startFrontAgentMcpServer(
  options: FrontAgentMcpServerOptions = {},
): Promise<void> {
  const server = createFrontAgentMcpServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  const close = async () => {
    await server.close();
    process.exit(0);
  };
  process.on('SIGINT', () => {
    void close();
  });
  process.on('SIGTERM', () => {
    void close();
  });
}
