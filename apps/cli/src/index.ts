/**
 * FrontAgent CLI — thin Commander router.
 *
 * Heavy imports (core, MCP, React/Ink) are deferred via dynamic import
 * inside each command's .action() so that cheap paths like `--help`,
 * `--version`, `-v`, `version`, `info`, and `init` never pay the startup cost.
 */

import { pathToFileURL } from 'node:url';
import { Command } from 'commander';
import { getCliVersion } from './version.js';

export type RegisterCliCommand = (program: Command) => void;
export type PromptCommandOptions = {
  compact: boolean;
  language: string;
};

export interface CliCommandHandlers {
  init: (options: { output: string }) => Promise<void>;
  validate: (sddPath?: string) => Promise<void>;
  prompt: (sddPath: string, options: PromptCommandOptions) => Promise<void>;
  run: (task: string, options: Record<string, unknown>) => Promise<void>;
  mcpServe: (options: Record<string, unknown>) => Promise<void>;
  info: () => Promise<void>;
}

export interface CreateCliProgramOptions {
  version?: string;
  handlers?: Partial<CliCommandHandlers>;
  registerCommands?: RegisterCliCommand[];
}

function runtimeNodePackageName() {
  return '@frontagent/runtime-node';
}

function createDefaultHandlers(): CliCommandHandlers {
  return {
    init: async (options) => {
      const { default: initCommand } = await import('./commands/init.js');
      await initCommand(options);
    },
    validate: async (sddPath) => {
      const { default: validateCommand } = await import('./commands/validate.js');
      await validateCommand(sddPath);
    },
    prompt: async (sddPath, options) => {
      const { default: promptCommand } = await import('./commands/prompt.js');
      await promptCommand(sddPath, options);
    },
    run: async (task, options) => {
      const { default: runCommand } = await import('./commands/run.js');
      await runCommand(task, options);
    },
    mcpServe: async (options) => {
      const runtimeNode = (await import(runtimeNodePackageName())) as {
        startFrontAgentMcpServer: (options: Record<string, unknown>) => Promise<void>;
      };
      await runtimeNode.startFrontAgentMcpServer(options);
    },
    info: async () => {
      const { default: infoCommand } = await import('./commands/info.js');
      await infoCommand();
    },
  };
}

export function createCliProgram(options: CreateCliProgramOptions = {}) {
  const cliVersion = options.version ?? getCliVersion();
  const handlers = { ...createDefaultHandlers(), ...options.handlers };
  const program = new Command();

  program
    .name('fa')
    .description('FrontAgent - 工程级 AI Agent 系统')
    .version(cliVersion, '-v, --version');

  // ── version ─────────────────────────────────────────────────────────
  program
    .command('version')
    .description('显示版本号')
    .action(() => {
      console.log(cliVersion);
    });

  // ── init ────────────────────────────────────────────────────────────
  program
    .command('init')
    .description('初始化项目 SDD 配置')
    .option('-o, --output <path>', 'SDD 配置文件输出路径', 'sdd.yaml')
    .action(async (options) => {
      await handlers.init(options);
    });

  // ── validate ────────────────────────────────────────────────────────
  program
    .command('validate')
    .description('验证 SDD 配置文件')
    .argument('[sdd-path]', 'SDD 配置文件路径（默认：当前目录的 sdd.yaml）')
    .action(async (sddPath) => {
      await handlers.validate(sddPath);
    });

  // ── prompt ──────────────────────────────────────────────────────────
  program
    .command('prompt')
    .description('生成 SDD 约束提示词')
    .argument('[sdd-path]', 'SDD 配置文件路径', 'sdd.yaml')
    .option('-c, --compact', '生成简洁版本', false)
    .option('-l, --language <lang>', '语言 (zh/en)', 'zh')
    .action(async (sddPath, options) => {
      await handlers.prompt(sddPath, options);
    });

  // ── run ─────────────────────────────────────────────────────────────
  program
    .command('run')
    .description('运行 Agent 任务')
    .argument('[task]', '任务描述（使用 --resume 恢复会话时可省略）')
    .option('--resume [sessionId]', '恢复最近未完成的会话，或指定 sessionId 恢复')
    .option('-s, --sdd <path>', 'SDD 配置文件路径', 'sdd.yaml')
    .option('-t, --type <type>', '任务类型 (create/modify/query/debug/refactor/test)', 'query')
    .option('-f, --files <files...>', '相关文件列表')
    .option('-u, --url <url>', '浏览器 URL (用于 Web 相关任务)')
    .option('--provider <provider>', 'LLM 提供商 (openai/anthropic)')
    .option('--model <model>', 'LLM 模型')
    .option('--base-url <url>', 'LLM API 基础 URL (用于代理或兼容 API)')
    .option('--api-key <key>', 'LLM API Key (默认从环境变量读取)')
    .option('--max-tokens <tokens>', '最大 token 数', '4096')
    .option('--temperature <temp>', '温度参数', '0.7')
    .option('--top-p <n>', 'Nucleus sampling (top_p)', process.env.TOP_P)
    .option('--top-k <n>', 'Top-k sampling（仅部分 provider 支持）', process.env.TOP_K)
    .option(
      '--engine <engine>',
      '执行引擎 (native/langgraph)',
      process.env.EXECUTION_ENGINE || 'native',
    )
    .option(
      '--security-mode <mode>',
      '安全模式 (balanced/strict/developer)',
      process.env.FRONTAGENT_SECURITY_MODE || 'balanced',
    )
    .option('--langgraph-checkpoint', '启用 LangGraph checkpoint', false)
    .option(
      '--max-recovery-attempts <n>',
      '阶段恢复最大重试次数',
      process.env.MAX_RECOVERY_ATTEMPTS || '3',
    )
    .option('--disable-rag', '禁用远程知识库 RAG', false)
    .option(
      '--rag-source <source>',
      'RAG 知识源 (git/openviking/composite)',
      process.env.FRONTAGENT_RAG_SOURCE,
    )
    .option(
      '--open-viking-endpoint <url>',
      'OpenViking 知识库查询接口',
      process.env.FRONTAGENT_OPENVIKING_ENDPOINT,
    )
    .option('--open-viking-api-key <key>', 'OpenViking API Key (默认从环境变量读取)')
    .option(
      '--open-viking-corpus <name>',
      'OpenViking corpus',
      process.env.FRONTAGENT_OPENVIKING_CORPUS,
    )
    .option(
      '--open-viking-namespace <name>',
      'OpenViking namespace',
      process.env.FRONTAGENT_OPENVIKING_NAMESPACE,
    )
    .option(
      '--open-viking-l1-entry <path>',
      'OpenViking L1 导航入口',
      process.env.FRONTAGENT_OPENVIKING_L1_ENTRY || 'docs/openviking/frontagent-l1.md',
    )
    .option(
      '--open-viking-timeout-ms <n>',
      'OpenViking 查询超时毫秒',
      process.env.FRONTAGENT_OPENVIKING_TIMEOUT_MS,
    )
    .option('--disable-open-viking-fallback', 'OpenViking 查询失败时不回退 Git RAG', false)
    .option(
      '--filesense-enabled <enabled>',
      '启用 Filesense 轻量目录导航 (true/false)',
      process.env.FRONTAGENT_FILESENSE_ENABLED,
    )
    .option(
      '--filesense-output <mode>',
      'Filesense 输出模式 (summary/candidates/verbose)',
      process.env.FRONTAGENT_FILESENSE_OUTPUT || 'summary',
    )
    .option(
      '--filesense-write-mode <mode>',
      'Filesense 写入模式 (cache/workspace/none)',
      process.env.FRONTAGENT_FILESENSE_WRITE_MODE || 'cache',
    )
    .option(
      '--filesense-max-entries <n>',
      'Filesense 默认扫描条目预算',
      process.env.FRONTAGENT_FILESENSE_MAX_ENTRIES,
    )
    .option(
      '--filesense-max-bytes <n>',
      'Filesense 默认返回字节预算',
      process.env.FRONTAGENT_FILESENSE_MAX_BYTES,
    )
    .option(
      '--filesense-timeout-ms <n>',
      'Filesense 默认导航超时毫秒',
      process.env.FRONTAGENT_FILESENSE_TIMEOUT_MS,
    )
    .option('--rag-sync-on-query', '每次 RAG 查询前同步远程仓库（默认只在缺少本地缓存时 clone）')
    .option(
      '--rag-repo <url>',
      '远程知识库 Git 仓库地址',
      process.env.FRONTAGENT_RAG_REPO || 'https://github.com/ceilf6/Lab.git',
    )
    .option('--rag-branch <branch>', '远程知识库分支', process.env.FRONTAGENT_RAG_BRANCH || 'main')
    .option(
      '--rag-max-results <n>',
      '规划前 RAG 返回条数',
      process.env.FRONTAGENT_RAG_MAX_RESULTS || '5',
    )
    .option(
      '--rag-keyword-candidates <n>',
      'BM25 候选文档数',
      process.env.FRONTAGENT_RAG_KEYWORD_CANDIDATES || '40',
    )
    .option(
      '--rag-semantic-candidates <n>',
      '语义检索候选文档数',
      process.env.FRONTAGENT_RAG_SEMANTIC_CANDIDATES || '40',
    )
    .option(
      '--rag-keyword-weight <n>',
      'BM25 权重',
      process.env.FRONTAGENT_RAG_KEYWORD_WEIGHT || '0.45',
    )
    .option(
      '--rag-semantic-weight <n>',
      '语义检索权重',
      process.env.FRONTAGENT_RAG_SEMANTIC_WEIGHT || '0.55',
    )
    .option(
      '--rag-chunk-size <n>',
      '索引分块大小（字符）',
      process.env.FRONTAGENT_RAG_CHUNK_SIZE || '1200',
    )
    .option(
      '--rag-chunk-overlap <n>',
      '索引分块重叠（字符）',
      process.env.FRONTAGENT_RAG_CHUNK_OVERLAP || '200',
    )
    .option(
      '--rag-max-file-size-kb <n>',
      '单文件最大索引大小（KB）',
      process.env.FRONTAGENT_RAG_MAX_FILE_SIZE_KB || '256',
    )
    .option('--rag-exclude-path <prefixes...>', '额外排除的仓库路径前缀（子模块会自动排除）')
    .option('--disable-rag-query-rewrite', '禁用检索前的 LLM 查询优化', false)
    .option(
      '--rag-query-rewrite-max-tokens <n>',
      '检索前查询优化最大输出 token',
      process.env.FRONTAGENT_RAG_QUERY_REWRITE_MAX_TOKENS || '160',
    )
    .option(
      '--rag-query-rewrite-temperature <n>',
      '检索前查询优化温度',
      process.env.FRONTAGENT_RAG_QUERY_REWRITE_TEMPERATURE || '0.1',
    )
    .option('--disable-rag-reranker', '禁用交叉编码器重排序', false)
    .option(
      '--rag-reranker-model <model>',
      '重排序模型（Jina/Cohere 兼容 /rerank）',
      process.env.FRONTAGENT_RAG_RERANKER_MODEL,
    )
    .option(
      '--rag-reranker-base-url <url>',
      '重排序 API Base URL',
      process.env.FRONTAGENT_RAG_RERANKER_BASE_URL ||
        process.env.OPENAI_BASE_URL ||
        process.env.BASE_URL,
    )
    .option('--rag-reranker-api-key <key>', '重排序 API Key (默认从环境变量读取)')
    .option(
      '--rag-reranker-candidate-count <n>',
      '送入重排序器的候选文档数',
      process.env.FRONTAGENT_RAG_RERANKER_CANDIDATE_COUNT || '20',
    )
    .option(
      '--rag-reranker-max-document-chars <n>',
      '单个候选文档送入重排序器的最大字符数',
      process.env.FRONTAGENT_RAG_RERANKER_MAX_DOCUMENT_CHARS || '1800',
    )
    .option(
      '--rag-reranker-timeout-ms <n>',
      '重排序请求超时毫秒',
      process.env.FRONTAGENT_RAG_RERANKER_TIMEOUT_MS,
    )
    .option('--disable-rag-semantic', '禁用 embedding 语义检索，仅保留 BM25', false)
    .option(
      '--rag-embedding-model <model>',
      'Embedding 模型',
      process.env.FRONTAGENT_RAG_EMBEDDING_MODEL,
    )
    .option(
      '--rag-embedding-base-url <url>',
      'Embedding API Base URL',
      process.env.FRONTAGENT_RAG_EMBEDDING_BASE_URL ||
        process.env.OPENAI_BASE_URL ||
        process.env.BASE_URL,
    )
    .option('--rag-embedding-api-key <key>', 'Embedding API Key (默认从环境变量读取)')
    .option(
      '--rag-embedding-dimensions <n>',
      'Embedding 维度',
      process.env.FRONTAGENT_RAG_EMBEDDING_DIMENSIONS,
    )
    .option(
      '--rag-embedding-batch-size <n>',
      'Embedding 批量大小',
      process.env.FRONTAGENT_RAG_EMBEDDING_BATCH_SIZE,
    )
    .option(
      '--rag-embedding-timeout-ms <n>',
      'Embedding 请求超时毫秒',
      process.env.FRONTAGENT_RAG_EMBEDDING_TIMEOUT_MS,
    )
    .option(
      '--rag-vector-store-provider <provider>',
      '向量存储提供方 (local/weaviate)',
      process.env.FRONTAGENT_RAG_VECTOR_STORE_PROVIDER,
    )
    .option(
      '--rag-weaviate-url <url>',
      'Weaviate REST Base URL',
      process.env.FRONTAGENT_RAG_WEAVIATE_URL,
    )
    .option('--rag-weaviate-api-key <key>', 'Weaviate API Key (默认从环境变量读取)')
    .option(
      '--rag-weaviate-collection-prefix <prefix>',
      'Weaviate Collection 前缀',
      process.env.FRONTAGENT_RAG_WEAVIATE_COLLECTION_PREFIX,
    )
    .option(
      '--rag-weaviate-batch-size <n>',
      'Weaviate 批量写入大小',
      process.env.FRONTAGENT_RAG_WEAVIATE_BATCH_SIZE,
    )
    .option(
      '--rag-weaviate-timeout-ms <n>',
      'Weaviate 请求超时毫秒',
      process.env.FRONTAGENT_RAG_WEAVIATE_TIMEOUT_MS,
    )
    .option(
      '--log-file <path>',
      '运行日志输出路径（默认：.frontagent/runs/<timestamp>-<runId>.log）',
    )
    .option('--no-run-log', '关闭默认运行日志')
    .option('--debug', '启用调试模式', false)
    .action(async (task, options) => {
      if (!task && !options.resume) {
        throw new Error('缺少任务描述：请提供 <task> 参数，或使用 --resume 恢复会话。');
      }
      await handlers.run(task ?? '', options);
    });

  // ── mcp serve ──────────────────────────────────────────────────────
  const mcpCommand = program.command('mcp').description('启动 FrontAgent MCP 服务');

  mcpCommand
    .command('serve')
    .description('通过 stdio 启动 FrontAgent MCP Server')
    .option('--project-root <path>', '绑定的项目根目录（可选；默认使用 Host roots 或当前工作目录）')
    .option('--provider <provider>', 'Direct LLM 提供商 (openai/anthropic)')
    .option('--model <model>', 'Direct LLM 模型')
    .option('--base-url <url>', 'Direct LLM API 基础 URL')
    .option('--api-key <key>', 'Direct LLM API Key')
    .option('--max-tokens <tokens>', '最大 token 数', '4096')
    .option('--temperature <temp>', '温度参数', '0.2')
    .option('--top-p <n>', 'Nucleus sampling (top_p)', process.env.TOP_P)
    .option('--top-k <n>', 'Top-k sampling（仅部分 provider 支持）', process.env.TOP_K)
    .option(
      '--engine <engine>',
      '执行引擎 (native/langgraph)',
      process.env.EXECUTION_ENGINE || 'native',
    )
    .option(
      '--security-mode <mode>',
      '安全模式 (balanced/strict/developer)',
      process.env.FRONTAGENT_SECURITY_MODE || 'balanced',
    )
    .option('--disable-rag', '禁用远程知识库 RAG', false)
    .option(
      '--rag-source <source>',
      'RAG 知识源 (git/openviking/composite)',
      process.env.FRONTAGENT_RAG_SOURCE,
    )
    .option(
      '--open-viking-endpoint <url>',
      'OpenViking 知识库查询接口',
      process.env.FRONTAGENT_OPENVIKING_ENDPOINT,
    )
    .option('--open-viking-api-key <key>', 'OpenViking API Key')
    .option(
      '--open-viking-corpus <name>',
      'OpenViking corpus',
      process.env.FRONTAGENT_OPENVIKING_CORPUS,
    )
    .option(
      '--open-viking-namespace <name>',
      'OpenViking namespace',
      process.env.FRONTAGENT_OPENVIKING_NAMESPACE,
    )
    .option(
      '--open-viking-l1-entry <path>',
      'OpenViking L1 导航入口',
      process.env.FRONTAGENT_OPENVIKING_L1_ENTRY || 'docs/openviking/frontagent-l1.md',
    )
    .option(
      '--open-viking-timeout-ms <n>',
      'OpenViking 查询超时毫秒',
      process.env.FRONTAGENT_OPENVIKING_TIMEOUT_MS,
    )
    .option('--disable-open-viking-fallback', 'OpenViking 查询失败时不回退 Git RAG', false)
    .option(
      '--filesense-enabled <enabled>',
      '启用 Filesense 轻量目录导航 (true/false)',
      process.env.FRONTAGENT_FILESENSE_ENABLED,
    )
    .option(
      '--filesense-output <mode>',
      'Filesense 输出模式 (summary/candidates/verbose)',
      process.env.FRONTAGENT_FILESENSE_OUTPUT || 'summary',
    )
    .option(
      '--filesense-write-mode <mode>',
      'Filesense 写入模式 (cache/workspace/none)',
      process.env.FRONTAGENT_FILESENSE_WRITE_MODE || 'cache',
    )
    .option(
      '--filesense-max-entries <n>',
      'Filesense 默认扫描条目预算',
      process.env.FRONTAGENT_FILESENSE_MAX_ENTRIES,
    )
    .option(
      '--filesense-max-bytes <n>',
      'Filesense 默认返回字节预算',
      process.env.FRONTAGENT_FILESENSE_MAX_BYTES,
    )
    .option(
      '--filesense-timeout-ms <n>',
      'Filesense 默认导航超时毫秒',
      process.env.FRONTAGENT_FILESENSE_TIMEOUT_MS,
    )
    .option('--rag-sync-on-query', '每次 RAG 查询前同步远程仓库')
    .option(
      '--rag-repo <url>',
      '远程知识库 Git 仓库地址',
      process.env.FRONTAGENT_RAG_REPO || 'https://github.com/ceilf6/Lab.git',
    )
    .option('--rag-branch <branch>', '远程知识库分支', process.env.FRONTAGENT_RAG_BRANCH || 'main')
    .option(
      '--rag-max-results <n>',
      '规划前 RAG 返回条数',
      process.env.FRONTAGENT_RAG_MAX_RESULTS || '5',
    )
    .option(
      '--rag-keyword-candidates <n>',
      'BM25 候选文档数',
      process.env.FRONTAGENT_RAG_KEYWORD_CANDIDATES || '40',
    )
    .option(
      '--rag-semantic-candidates <n>',
      '语义检索候选文档数',
      process.env.FRONTAGENT_RAG_SEMANTIC_CANDIDATES || '40',
    )
    .option(
      '--rag-keyword-weight <n>',
      'BM25 权重',
      process.env.FRONTAGENT_RAG_KEYWORD_WEIGHT || '0.45',
    )
    .option(
      '--rag-semantic-weight <n>',
      '语义检索权重',
      process.env.FRONTAGENT_RAG_SEMANTIC_WEIGHT || '0.55',
    )
    .option(
      '--rag-chunk-size <n>',
      '索引分块大小（字符）',
      process.env.FRONTAGENT_RAG_CHUNK_SIZE || '1200',
    )
    .option(
      '--rag-chunk-overlap <n>',
      '索引分块重叠（字符）',
      process.env.FRONTAGENT_RAG_CHUNK_OVERLAP || '200',
    )
    .option(
      '--rag-max-file-size-kb <n>',
      '单文件最大索引大小（KB）',
      process.env.FRONTAGENT_RAG_MAX_FILE_SIZE_KB || '256',
    )
    .option('--rag-exclude-path <prefixes...>', '额外排除的仓库路径前缀')
    .option('--disable-rag-query-rewrite', '禁用检索前的 LLM 查询优化', false)
    .option(
      '--rag-query-rewrite-max-tokens <n>',
      '检索前查询优化最大输出 token',
      process.env.FRONTAGENT_RAG_QUERY_REWRITE_MAX_TOKENS || '160',
    )
    .option(
      '--rag-query-rewrite-temperature <n>',
      '检索前查询优化温度',
      process.env.FRONTAGENT_RAG_QUERY_REWRITE_TEMPERATURE || '0.1',
    )
    .option('--disable-rag-reranker', '禁用交叉编码器重排序', false)
    .option(
      '--rag-reranker-model <model>',
      '重排序模型（Jina/Cohere 兼容 /rerank）',
      process.env.FRONTAGENT_RAG_RERANKER_MODEL,
    )
    .option(
      '--rag-reranker-base-url <url>',
      '重排序 API Base URL',
      process.env.FRONTAGENT_RAG_RERANKER_BASE_URL ||
        process.env.OPENAI_BASE_URL ||
        process.env.BASE_URL,
    )
    .option('--rag-reranker-api-key <key>', '重排序 API Key')
    .option(
      '--rag-reranker-candidate-count <n>',
      '送入重排序器的候选文档数',
      process.env.FRONTAGENT_RAG_RERANKER_CANDIDATE_COUNT || '20',
    )
    .option(
      '--rag-reranker-max-document-chars <n>',
      '单个候选文档送入重排序器的最大字符数',
      process.env.FRONTAGENT_RAG_RERANKER_MAX_DOCUMENT_CHARS || '1800',
    )
    .option(
      '--rag-reranker-timeout-ms <n>',
      '重排序请求超时毫秒',
      process.env.FRONTAGENT_RAG_RERANKER_TIMEOUT_MS,
    )
    .option('--disable-rag-semantic', '禁用 embedding 语义检索，仅保留 BM25', false)
    .option(
      '--rag-embedding-model <model>',
      'Embedding 模型',
      process.env.FRONTAGENT_RAG_EMBEDDING_MODEL,
    )
    .option(
      '--rag-embedding-base-url <url>',
      'Embedding API Base URL',
      process.env.FRONTAGENT_RAG_EMBEDDING_BASE_URL ||
        process.env.OPENAI_BASE_URL ||
        process.env.BASE_URL,
    )
    .option('--rag-embedding-api-key <key>', 'Embedding API Key')
    .option(
      '--rag-embedding-dimensions <n>',
      'Embedding 维度',
      process.env.FRONTAGENT_RAG_EMBEDDING_DIMENSIONS,
    )
    .option(
      '--rag-embedding-batch-size <n>',
      'Embedding 批量大小',
      process.env.FRONTAGENT_RAG_EMBEDDING_BATCH_SIZE,
    )
    .option(
      '--rag-embedding-timeout-ms <n>',
      'Embedding 请求超时毫秒',
      process.env.FRONTAGENT_RAG_EMBEDDING_TIMEOUT_MS,
    )
    .option(
      '--rag-vector-store-provider <provider>',
      '向量存储提供方 (local/weaviate)',
      process.env.FRONTAGENT_RAG_VECTOR_STORE_PROVIDER,
    )
    .option(
      '--rag-weaviate-url <url>',
      'Weaviate REST Base URL',
      process.env.FRONTAGENT_RAG_WEAVIATE_URL,
    )
    .option('--rag-weaviate-api-key <key>', 'Weaviate API Key')
    .option(
      '--rag-weaviate-collection-prefix <prefix>',
      'Weaviate Collection 前缀',
      process.env.FRONTAGENT_RAG_WEAVIATE_COLLECTION_PREFIX,
    )
    .option(
      '--rag-weaviate-batch-size <n>',
      'Weaviate 批量写入大小',
      process.env.FRONTAGENT_RAG_WEAVIATE_BATCH_SIZE,
    )
    .option(
      '--rag-weaviate-timeout-ms <n>',
      'Weaviate 请求超时毫秒',
      process.env.FRONTAGENT_RAG_WEAVIATE_TIMEOUT_MS,
    )
    .option('--log-file <path>', '运行日志输出路径')
    .option('--debug', '启用调试模式', false)
    .action(async (options) => {
      await handlers.mcpServe(options);
    });

  // ── optional extension commands ─────────────────────────────────────
  for (const registerCommand of options.registerCommands ?? []) {
    registerCommand(program);
  }

  // ── info ────────────────────────────────────────────────────────────
  program
    .command('info')
    .description('显示系统信息')
    .action(async () => {
      await handlers.info();
    });

  return program;
}

export async function createProductionCliProgram(options: CreateCliProgramOptions = {}) {
  const [{ registerRagCommand }, { registerSkillCommand }] = await Promise.all([
    import('./commands/rag.js'),
    import('./commands/skill.js'),
  ]);

  return createCliProgram({
    ...options,
    registerCommands: [
      ...(options.registerCommands ?? []),
      registerRagCommand,
      registerSkillCommand,
    ],
  });
}

export function isDirectCliEntry(moduleUrl: string, argvPath = process.argv[1]) {
  return argvPath ? moduleUrl === pathToFileURL(argvPath).href : false;
}

if (isDirectCliEntry(import.meta.url)) {
  void createProductionCliProgram().then((program) => {
    program.parse();
  });
}
