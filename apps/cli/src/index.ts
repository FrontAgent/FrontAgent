/**
 * FrontAgent CLI
 * 命令行工具入口
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { createAgent, type AgentConfig } from '@frontagent/core';
import { createSDDParser, createPromptGenerator } from '@frontagent/sdd';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { FileMCPClient, MemoryMCPClient, WebMCPClient } from './mcp-client.js';
import { createShellMCPClient } from '@frontagent/mcp-shell';

const program = new Command();

function parseOptionalInt(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalFloat(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parsePathList(values: string[] | undefined, fallback?: string): string[] | undefined {
  if (values && values.length > 0) {
    return values.map((value) => value.trim()).filter(Boolean);
  }
  if (!fallback?.trim()) {
    return undefined;
  }
  return fallback
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function resolveProviderApiKey(
  provider: 'openai' | 'anthropic',
  cliValue?: string,
): string | undefined {
  return cliValue ?? process.env[`${provider.toUpperCase()}_API_KEY`] ?? process.env.API_KEY;
}

function resolveProviderBaseURL(
  provider: 'openai' | 'anthropic',
  cliValue?: string,
): string | undefined {
  return cliValue ?? process.env[`${provider.toUpperCase()}_BASE_URL`] ?? process.env.BASE_URL;
}

program
  .name('frontagent')
  .description('FrontAgent - 工程级 AI Agent 系统')
  .version('0.1.0');

/**
 * init 命令 - 初始化项目 SDD 配置
 */
program
  .command('init')
  .description('初始化项目 SDD 配置')
  .option('-o, --output <path>', 'SDD 配置文件输出路径', 'sdd.yaml')
  .action(async (options) => {
    const spinner = ora('正在生成 SDD 配置模板...').start();

    const sddTemplate = `# FrontAgent SDD 配置文件
# 规格驱动开发 - Agent 行为约束

version: "1.0"

project:
  name: "my-project"
  type: "react-spa"
  description: "项目描述"

# 技术栈约束
tech_stack:
  framework: "react"
  version: "^18.0.0"
  language: "typescript"
  styling: "tailwindcss"
  state_management: "zustand"
  forbidden_packages:
    - "jquery"
    - "moment"  # 使用 date-fns 替代

# 目录结构约束
directory_structure:
  src/components:
    pattern: "PascalCase"
    max_lines: 300
    required_exports:
      - "default"
  src/hooks:
    pattern: "use*.ts"
  src/utils:
    pattern: "camelCase"
    must_be_pure: true

# 模块边界约束
module_boundaries:
  - from: "src/components/*"
    can_import:
      - "src/hooks/*"
      - "src/utils/*"
      - "src/types/*"
    cannot_import:
      - "src/pages/*"
      - "src/api/*"

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
    - "any"
    - "// @ts-ignore"
    - "console.log"

# 修改安全边界
modification_rules:
  protected_files:
    - "package.json"
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
`;

    const outputPath = resolve(process.cwd(), options.output);
    
    if (existsSync(outputPath)) {
      spinner.fail(`文件已存在: ${outputPath}`);
      return;
    }

    const { writeFileSync } = await import('node:fs');
    writeFileSync(outputPath, sddTemplate, 'utf-8');

    spinner.succeed(`SDD 配置文件已创建: ${outputPath}`);
    console.log(chalk.gray('\n请根据项目实际情况修改配置文件'));
  });

/**
 * validate 命令 - 验证 SDD 配置
 */
program
  .command('validate')
  .description('验证 SDD 配置文件')
  .argument('[sdd-path]', 'SDD 配置文件路径（默认：当前目录的 sdd.yaml）')
  .action(async (sddPath) => {
    const spinner = ora('正在验证 SDD 配置...').start();

    // 默认检查当前目录的 sdd.yaml
    const targetPath = sddPath || 'sdd.yaml';
    const fullPath = resolve(process.cwd(), targetPath);
    
    if (!existsSync(fullPath)) {
      spinner.fail(`文件不存在: ${fullPath}`);
      return;
    }

    const parser = createSDDParser();
    const result = parser.parseFile(fullPath);

    if (result.success) {
      spinner.succeed('SDD 配置验证通过');
      console.log(chalk.green('\n✅ 配置有效'));
      console.log(chalk.gray(`   项目: ${result.config?.project.name}`));
      console.log(chalk.gray(`   技术栈: ${result.config?.techStack.framework} ${result.config?.techStack.version}`));
    } else {
      spinner.fail('SDD 配置验证失败');
      console.log(chalk.red('\n❌ 配置错误:'));
      for (const error of result.errors ?? []) {
        console.log(chalk.red(`   - ${error}`));
      }
    }
  });

/**
 * prompt 命令 - 生成 SDD 约束提示词
 */
program
  .command('prompt')
  .description('生成 SDD 约束提示词')
  .argument('[sdd-path]', 'SDD 配置文件路径', 'sdd.yaml')
  .option('-c, --compact', '生成简洁版本', false)
  .option('-l, --language <lang>', '语言 (zh/en)', 'zh')
  .action(async (sddPath, options) => {
    const fullPath = resolve(process.cwd(), sddPath);
    
    if (!existsSync(fullPath)) {
      console.log(chalk.red(`文件不存在: ${fullPath}`));
      return;
    }

    const parser = createSDDParser();
    const result = parser.parseFile(fullPath);

    if (!result.success || !result.config) {
      console.log(chalk.red('SDD 配置解析失败'));
      return;
    }

    const generator = createPromptGenerator(result.config, {
      language: options.language as 'zh' | 'en'
    });

    const prompt = options.compact ? generator.generateCompact() : generator.generate();
    console.log(prompt);
  });

/**
 * run 命令 - 运行 Agent 任务
 */
program
  .command('run')
  .description('运行 Agent 任务')
  .argument('<task>', '任务描述')
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
  .option('--engine <engine>', '执行引擎 (native/langgraph)', process.env.EXECUTION_ENGINE || 'native')
  .option('--langgraph-checkpoint', '启用 LangGraph checkpoint', false)
  .option('--max-recovery-attempts <n>', '阶段恢复最大重试次数', process.env.MAX_RECOVERY_ATTEMPTS || '3')
  .option('--disable-rag', '禁用远程知识库 RAG', false)
  .option('--rag-repo <url>', '远程知识库 Git 仓库地址', process.env.FRONTAGENT_RAG_REPO || 'https://github.com/ceilf6/Lab.git')
  .option('--rag-branch <branch>', '远程知识库分支', process.env.FRONTAGENT_RAG_BRANCH || 'main')
  .option('--rag-max-results <n>', '规划前 RAG 返回条数', process.env.FRONTAGENT_RAG_MAX_RESULTS || '5')
  .option('--rag-keyword-candidates <n>', 'BM25 候选文档数', process.env.FRONTAGENT_RAG_KEYWORD_CANDIDATES || '40')
  .option('--rag-semantic-candidates <n>', '语义检索候选文档数', process.env.FRONTAGENT_RAG_SEMANTIC_CANDIDATES || '40')
  .option('--rag-keyword-weight <n>', 'BM25 权重', process.env.FRONTAGENT_RAG_KEYWORD_WEIGHT || '0.45')
  .option('--rag-semantic-weight <n>', '语义检索权重', process.env.FRONTAGENT_RAG_SEMANTIC_WEIGHT || '0.55')
  .option('--rag-chunk-size <n>', '索引分块大小（字符）', process.env.FRONTAGENT_RAG_CHUNK_SIZE || '1200')
  .option('--rag-chunk-overlap <n>', '索引分块重叠（字符）', process.env.FRONTAGENT_RAG_CHUNK_OVERLAP || '200')
  .option('--rag-max-file-size-kb <n>', '单文件最大索引大小（KB）', process.env.FRONTAGENT_RAG_MAX_FILE_SIZE_KB || '256')
  .option('--rag-exclude-path <prefixes...>', '额外排除的仓库路径前缀（子模块会自动排除）')
  .option('--disable-rag-semantic', '禁用 embedding 语义检索，仅保留 BM25', false)
  .option('--rag-embedding-model <model>', 'Embedding 模型', process.env.FRONTAGENT_RAG_EMBEDDING_MODEL)
  .option('--rag-embedding-base-url <url>', 'Embedding API Base URL', process.env.FRONTAGENT_RAG_EMBEDDING_BASE_URL || process.env.OPENAI_BASE_URL || process.env.BASE_URL)
  .option('--rag-embedding-api-key <key>', 'Embedding API Key (默认从环境变量读取)')
  .option('--rag-embedding-dimensions <n>', 'Embedding 维度', process.env.FRONTAGENT_RAG_EMBEDDING_DIMENSIONS)
  .option('--rag-embedding-batch-size <n>', 'Embedding 批量大小', process.env.FRONTAGENT_RAG_EMBEDDING_BATCH_SIZE)
  .option('--rag-embedding-timeout-ms <n>', 'Embedding 请求超时毫秒', process.env.FRONTAGENT_RAG_EMBEDDING_TIMEOUT_MS)
  .option('--debug', '启用调试模式', false)
  .action(async (task, options) => {
    const projectRoot = process.cwd();
    const sddPath = resolve(projectRoot, options.sdd);

    // 检查 SDD 配置
    if (!existsSync(sddPath)) {
      console.log(chalk.yellow(`⚠️ SDD 配置文件不存在: ${sddPath}`));
      console.log(chalk.gray('   运行 frontagent init 创建配置文件'));
      console.log(chalk.gray('   将在无约束模式下运行\n'));
    }

    // 根据环境变量和 CLI 参数确定 provider
    const provider = (options.provider || process.env.PROVIDER || 'anthropic').toLowerCase() as 'openai' | 'anthropic';

    // 根据 provider 确定默认模型
    const getDefaultModel = (provider: string): string => {
      switch (provider) {
        case 'openai':
          return 'gpt-4-turbo';
        case 'anthropic':
          return 'claude-3-5-sonnet-20241022';
        default:
          return 'claude-3-5-sonnet-20241022';
      }
    };

    const model = options.model || process.env.MODEL || getDefaultModel(provider);
    const resolvedLlmApiKey = resolveProviderApiKey(provider, options.apiKey);
    const resolvedLlmBaseURL = resolveProviderBaseURL(provider, options.baseUrl);
    const executionEngineRaw = (options.engine || process.env.EXECUTION_ENGINE || 'native').toLowerCase();
    const executionEngine = executionEngineRaw === 'langgraph' ? 'langgraph' : 'native';
    const useLangGraphCheckpoint = Boolean(
      options.langgraphCheckpoint ||
      process.env.LANGGRAPH_CHECKPOINT === '1' ||
      process.env.LANGGRAPH_CHECKPOINT === 'true'
    );
    const maxRecoveryAttempts = Number.parseInt(options.maxRecoveryAttempts, 10) || 3;
    const ragEnabled = !options.disableRag;
    const ragCacheDir = resolve(projectRoot, '.frontagent', 'rag-cache');
    const ragExcludedPathPrefixes = parsePathList(
      options.ragExcludePath,
      process.env.FRONTAGENT_RAG_EXCLUDE_PATHS,
    );
    const ragConfig = {
      enabled: ragEnabled,
      repoUrl: options.ragRepo,
      branch: options.ragBranch,
      maxResults: parseOptionalInt(options.ragMaxResults) || 5,
      cacheDir: ragCacheDir,
      syncOnQuery: true,
      excludedPathPrefixes: ragExcludedPathPrefixes,
      keywordCandidateCount: parseOptionalInt(options.ragKeywordCandidates),
      semanticCandidateCount: parseOptionalInt(options.ragSemanticCandidates),
      keywordWeight: parseOptionalFloat(options.ragKeywordWeight),
      semanticWeight: parseOptionalFloat(options.ragSemanticWeight),
      chunkSize: parseOptionalInt(options.ragChunkSize),
      chunkOverlap: parseOptionalInt(options.ragChunkOverlap),
      maxFileSizeBytes: (() => {
        const sizeKb = parseOptionalInt(options.ragMaxFileSizeKb);
        return sizeKb ? sizeKb * 1024 : undefined;
      })(),
      embedding: {
        enabled: !options.disableRagSemantic,
        model: options.ragEmbeddingModel,
        baseURL:
          options.ragEmbeddingBaseUrl ??
          process.env.FRONTAGENT_RAG_EMBEDDING_BASE_URL ??
          (provider === 'openai' ? resolvedLlmBaseURL : undefined),
        apiKey:
          options.ragEmbeddingApiKey ??
          process.env.FRONTAGENT_RAG_EMBEDDING_API_KEY ??
          (provider === 'openai' ? resolvedLlmApiKey : undefined),
        dimensions: parseOptionalInt(options.ragEmbeddingDimensions),
        batchSize: parseOptionalInt(options.ragEmbeddingBatchSize),
        requestTimeoutMs: parseOptionalInt(options.ragEmbeddingTimeoutMs),
      },
    } satisfies NonNullable<AgentConfig['rag']>;

    // 显示 LLM 配置信息
    if (options.debug) {
      console.log(chalk.gray(`\n🔧 LLM 配置:`));
      console.log(chalk.gray(`   Provider: ${provider}`));
      console.log(chalk.gray(`   Model: ${model}`));
      console.log(chalk.gray(`   Base URL: ${resolvedLlmBaseURL || '(default)'}\n`));
      console.log(chalk.gray(`   Execution Engine: ${executionEngine}`));
      if (executionEngine === 'langgraph') {
        console.log(chalk.gray(`   LangGraph Checkpoint: ${useLangGraphCheckpoint}`));
        console.log(chalk.gray(`   Max Recovery Attempts: ${maxRecoveryAttempts}\n`));
      }
      console.log(chalk.gray(`   RAG Enabled: ${ragEnabled}`));
      if (ragEnabled) {
        console.log(chalk.gray(`   RAG Repo: ${ragConfig.repoUrl}`));
        console.log(chalk.gray(`   RAG Branch: ${ragConfig.branch}`));
        console.log(chalk.gray(`   RAG Search: BM25 + ${ragConfig.embedding?.enabled ? 'Embedding' : 'disabled semantic'}`));
        console.log(chalk.gray(`   RAG Candidates: keyword=${ragConfig.keywordCandidateCount ?? 40}, semantic=${ragConfig.semanticCandidateCount ?? 40}`));
        console.log(chalk.gray(`   RAG Weights: keyword=${ragConfig.keywordWeight ?? 0.45}, semantic=${ragConfig.semanticWeight ?? 0.55}`));
        if (ragConfig.embedding?.enabled) {
          console.log(chalk.gray(`   RAG Embedding Base URL: ${ragConfig.embedding.baseURL || '(default)'}`));
          if (
            !options.ragEmbeddingBaseUrl &&
            !process.env.FRONTAGENT_RAG_EMBEDDING_BASE_URL &&
            !options.ragEmbeddingApiKey &&
            !process.env.FRONTAGENT_RAG_EMBEDDING_API_KEY &&
            provider === 'openai' &&
            ragConfig.embedding.baseURL === resolvedLlmBaseURL
          ) {
            console.log(chalk.gray('   RAG Embedding Source: inherited from LLM base-url/api-key'));
          }
        }
        if (ragConfig.excludedPathPrefixes?.length) {
          console.log(chalk.gray(`   RAG Exclude Paths: ${ragConfig.excludedPathPrefixes.join(', ')}`));
        }
        console.log(chalk.gray(`   RAG Cache: ${ragCacheDir}\n`));
      }
    }

    const spinner = ora('正在初始化 Agent...').start();

    const config: AgentConfig = {
      projectRoot,
      sddPath: existsSync(sddPath) ? sddPath : undefined,
      llm: {
        provider,
        model,
        baseURL: resolvedLlmBaseURL,
        apiKey: resolvedLlmApiKey,
        maxTokens: parseInt(options.maxTokens, 10),
        temperature: parseFloat(options.temperature),
      },
      execution: {
        engine: executionEngine,
        langGraph: {
          useCheckpoint: useLangGraphCheckpoint,
          maxRecoveryAttempts,
          threadIdPrefix: 'frontagent'
        }
      },
      rag: ragConfig,
      debug: options.debug
    };

    const agent = createAgent(config);

    // 创建并注册 MCP 客户端
    const fileClient = new FileMCPClient(projectRoot);
    agent.registerMCPClient('file', fileClient);
    agent.registerFileTools();

    if (ragEnabled) {
      const memoryClient = new MemoryMCPClient({
        repoUrl: ragConfig.repoUrl,
        branch: ragConfig.branch ?? 'main',
        cacheDir: ragConfig.cacheDir ?? ragCacheDir,
        syncOnQuery: ragConfig.syncOnQuery,
        maxResults: ragConfig.maxResults,
        excludedPathPrefixes: ragConfig.excludedPathPrefixes,
        keywordCandidateCount: ragConfig.keywordCandidateCount,
        semanticCandidateCount: ragConfig.semanticCandidateCount,
        keywordWeight: ragConfig.keywordWeight,
        semanticWeight: ragConfig.semanticWeight,
        chunkSize: ragConfig.chunkSize,
        chunkOverlap: ragConfig.chunkOverlap,
        maxFileSizeBytes: ragConfig.maxFileSizeBytes,
        embedding: ragConfig.embedding,
      });
      agent.registerMCPClient('memory', memoryClient);
      agent.registerMemoryTools();
    }

    // 注册 Shell 客户端（带命令批准）
    const shellClient = createShellMCPClient(
      projectRoot,
      async (command: string) => {
        // 暂停 spinner 以便显示提示
        spinner.stop();

        console.log(chalk.yellow('\n⚠️  Agent 请求执行终端命令:'));
        console.log(chalk.cyan(`   ${command}\n`));

        const rl = createInterface({
          input: process.stdin,
          output: process.stdout
        });

        const answer = await new Promise<string>((resolve) => {
          rl.question(chalk.white('是否允许执行此命令? (y/N): '), resolve);
        });

        rl.close();

        const approved = answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';

        if (approved) {
          console.log(chalk.green('✓ 命令已批准\n'));
        } else {
          console.log(chalk.red('✗ 命令已拒绝\n'));
        }

        // 重启 spinner
        spinner.start('正在执行...');

        return approved;
      }
    );
    agent.registerMCPClient('shell', shellClient);
    agent.registerShellTools();

    // 注册 Web 客户端（用于项目验证和浏览器操作）
    const webClient = new WebMCPClient();
    agent.registerMCPClient('web', webClient);
    agent.registerWebTools();

    // 如果提供了初始URL，则导航到该URL
    if (options.url) {
      // 初始导航将在任务执行时由Agent处理
    }

    // 添加事件监听
    agent.addEventListener((event) => {
      switch (event.type) {
        case 'task_started':
          spinner.text = `任务开始: ${event.task.description}`;
          break;
        case 'planning_started':
          spinner.text = '正在规划...';
          break;
        case 'rag_retrieved':
          spinner.stop();
          console.log(chalk.cyan(`\n📚 RAG 检索 (${event.searchMode || 'no_results'})`));
          if (event.warnings && event.warnings.length > 0) {
            for (const warning of event.warnings) {
              console.log(chalk.yellow(`   ⚠️ ${warning}`));
            }
          }
          if (event.matches.length === 0) {
            console.log(chalk.gray('   未命中知识库条目'));
          } else {
            for (const match of event.matches.slice(0, 5)) {
              const location = match.path ? ` (${match.path})` : '';
              console.log(chalk.gray(`   - ${match.title}${location}`));
            }
          }
          spinner.start('正在规划...');
          break;
        case 'planning_completed':
          spinner.succeed(`计划生成完成 (${event.plan.steps.length} 步骤)`);
          console.log(chalk.gray(`\n📋 ${event.plan.summary}\n`));

          // Debug: 显示完整步骤和参数
          if (options.debug) {
            console.log(chalk.gray('步骤详情:'));
            for (const step of event.plan.steps) {
              console.log(chalk.gray(`  ${step.stepId}: ${step.description}`));
              console.log(chalk.gray(`    Tool: ${step.tool}`));
              console.log(chalk.gray(`    Params: ${JSON.stringify(step.params, null, 2)}`));
            }
            console.log('');
          }

          spinner.start('正在执行...');
          break;
        case 'step_started':
          spinner.text = `执行: ${event.step.description}`;
          break;
        case 'step_completed':
          // 检查是否是跳过的步骤
          if (event.result && typeof event.result.output === 'object' && (event.result.output as any).skipped) {
            console.log(chalk.yellow(`   ⏭️  ${event.step.description} (已跳过)`));
          } else {
            console.log(chalk.green(`   ✅ ${event.step.description}`));
          }
          break;
        case 'step_failed':
          console.log(chalk.red(`   ❌ ${event.step.description}: ${event.error}`));
          break;
        case 'validation_failed':
          console.log(chalk.yellow(`   ⚠️ 验证失败: ${event.result.blockedBy?.join(', ')}`));
          break;
      }
    });

    try {
      const result = await agent.execute(task, {
        type: options.type,
        relevantFiles: options.files,
        browserUrl: options.url
      });

      if (result.success) {
        spinner.succeed('任务完成');
        if (options.type === 'query') {
          console.log(chalk.green('\n✅ 回答已生成\n'));
          if (result.output) {
            console.log(result.output);
          }
        } else {
          console.log(chalk.green(`\n✅ ${result.output}`));
        }
      } else {
        spinner.fail('任务失败');
        console.log(chalk.red(`\n❌ ${result.error}`));
      }

      console.log(chalk.gray(`\n⏱️ 耗时: ${result.duration}ms`));

    } catch (error) {
      spinner.fail('执行错误');
      console.log(chalk.red(`\n❌ ${error instanceof Error ? error.message : String(error)}`));
    } finally {
      // 关闭浏览器
      await webClient.close();
    }
  });

/**
 * info 命令 - 显示系统信息
 */
program
  .command('info')
  .description('显示系统信息')
  .action(async () => {
    console.log(chalk.cyan('\n🤖 FrontAgent 系统信息\n'));
    console.log(chalk.gray('版本: 0.1.0'));
    console.log(chalk.gray('运行时: Node.js ' + process.version));
    console.log(chalk.gray('工作目录: ' + process.cwd()));

    const sddPath = resolve(process.cwd(), 'sdd.yaml');
    if (existsSync(sddPath)) {
      console.log(chalk.green('✅ SDD 配置: 已找到'));
    } else {
      console.log(chalk.yellow('⚠️ SDD 配置: 未找到'));
    }

    console.log(chalk.cyan('\n🤖 LLM 配置:'));
    const provider = process.env.PROVIDER || 'anthropic';
    const model = process.env.MODEL || (provider === 'openai' ? 'gpt-4-turbo' : 'claude-3-5-sonnet-20241022');
    const baseUrl = process.env[`${provider.toUpperCase()}_BASE_URL`] || process.env.BASE_URL || '(使用默认)';
    const apiKey = process.env[`${provider.toUpperCase()}_API_KEY`] || process.env.API_KEY;

    console.log(chalk.gray(`  Provider: ${provider}`));
    console.log(chalk.gray(`  Model: ${model}`));
    console.log(chalk.gray(`  Base URL: ${baseUrl}`));
    console.log(apiKey ? chalk.green('  API Key: 已配置 ✓') : chalk.red('  API Key: 未配置 ✗'));

    console.log(chalk.cyan('\n📦 模块:'));
    console.log(chalk.gray('  - @frontagent/core'));
    console.log(chalk.gray('  - @frontagent/sdd'));
    console.log(chalk.gray('  - @frontagent/mcp-file'));
    console.log(chalk.gray('  - @frontagent/mcp-web'));
    console.log(chalk.gray('  - @frontagent/hallucination-guard'));
  });

program.parse();
