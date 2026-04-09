import chalk from 'chalk';
import ora from 'ora';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export default async function initCommand(options: { output: string }) {
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

  writeFileSync(outputPath, sddTemplate, 'utf-8');

  spinner.succeed(`SDD 配置文件已创建: ${outputPath}`);
  console.log(chalk.gray('\n请根据项目实际情况修改配置文件'));
}
