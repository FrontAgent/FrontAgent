import chalk from 'chalk';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export default async function infoCommand() {
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
}
