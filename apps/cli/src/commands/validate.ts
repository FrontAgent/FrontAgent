import chalk from 'chalk';
import ora from 'ora';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSDDParser } from '@frontagent/sdd';

export default async function validateCommand(sddPath?: string) {
  const spinner = ora('正在验证 SDD 配置...').start();

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
}
