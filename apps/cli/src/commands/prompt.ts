import chalk from 'chalk';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSDDParser, createPromptGenerator } from '@frontagent/sdd';

export default async function promptCommand(
  sddPath: string,
  options: { compact: boolean; language: string },
) {
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
    language: options.language as 'zh' | 'en',
  });

  const prompt = options.compact ? generator.generateCompact() : generator.generate();
  console.log(prompt);
}
