#!/usr/bin/env node
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

const program = new Command();

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
# 软件设计文档 - Agent 行为约束

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
  .argument('[sdd-path]', 'SDD 配置文件路径', 'sdd.yaml')
  .action(async (sddPath) => {
    const spinner = ora('正在验证 SDD 配置...').start();

    const fullPath = resolve(process.cwd(), sddPath);
    
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
  .option('--provider <provider>', 'LLM 提供商 (openai/anthropic)', 'anthropic')
  .option('--model <model>', 'LLM 模型', 'claude-3-5-sonnet-20241022')
  .option('--base-url <url>', 'LLM API 基础 URL (用于代理或兼容 API)')
  .option('--api-key <key>', 'LLM API Key (默认从环境变量读取)')
  .option('--max-tokens <tokens>', '最大 token 数', '4096')
  .option('--temperature <temp>', '温度参数', '0.7')
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

    const spinner = ora('正在初始化 Agent...').start();

    const config: AgentConfig = {
      projectRoot,
      sddPath: existsSync(sddPath) ? sddPath : undefined,
      llm: {
        provider: options.provider as 'openai' | 'anthropic',
        model: options.model,
        baseURL: options.baseUrl,
        apiKey: options.apiKey,
        maxTokens: parseInt(options.maxTokens, 10),
        temperature: parseFloat(options.temperature),
      },
      debug: options.debug
    };

    const agent = createAgent(config);

    // 注册工具
    agent.registerFileTools();
    if (options.url) {
      agent.registerWebTools();
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
        case 'planning_completed':
          spinner.succeed(`计划生成完成 (${event.plan.steps.length} 步骤)`);
          console.log(chalk.gray(`\n📋 ${event.plan.summary}\n`));
          spinner.start('正在执行...');
          break;
        case 'step_started':
          spinner.text = `执行: ${event.step.description}`;
          break;
        case 'step_completed':
          console.log(chalk.green(`   ✅ ${event.step.description}`));
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
        console.log(chalk.green(`\n✅ ${result.output}`));
      } else {
        spinner.fail('任务失败');
        console.log(chalk.red(`\n❌ ${result.error}`));
      }

      console.log(chalk.gray(`\n⏱️ 耗时: ${result.duration}ms`));

    } catch (error) {
      spinner.fail('执行错误');
      console.log(chalk.red(`\n❌ ${error instanceof Error ? error.message : String(error)}`));
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

    console.log(chalk.cyan('\n📦 模块:'));
    console.log(chalk.gray('  - @frontagent/core'));
    console.log(chalk.gray('  - @frontagent/sdd'));
    console.log(chalk.gray('  - @frontagent/mcp-file'));
    console.log(chalk.gray('  - @frontagent/mcp-web'));
    console.log(chalk.gray('  - @frontagent/hallucination-guard'));
  });

program.parse();

