import { existsSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { createPromptGenerator, createSDDParser } from '@frontagent/sdd';

export interface SddInitResult {
  created: boolean;
  path: string;
  message: string;
}

export interface SddValidationResult {
  success: boolean;
  path: string;
  projectName?: string;
  framework?: string;
  frameworkVersion?: string;
  errors?: string[];
}

export function createSddTemplate(): string {
  return `# FrontAgent SDD 配置文件
# 规格驱动开发 - Agent 行为约束

version: "1.0"

project:
  name: "my-project"
  type: "react-spa"
  description: "项目描述"

tech_stack:
  framework: "react"
  version: "^18.0.0"
  language: "typescript"
  styling: "tailwindcss"
  state_management: "zustand"
  forbidden_packages:
    - "jquery"
    - "moment"

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

module_boundaries:
  - from: "src/components/*"
    can_import:
      - "src/hooks/*"
      - "src/utils/*"
      - "src/types/*"
    cannot_import:
      - "src/pages/*"
      - "src/api/*"

naming_conventions:
  components: "PascalCase"
  hooks: "camelCase with 'use' prefix"
  utils: "camelCase"
  constants: "SCREAMING_SNAKE_CASE"
  types: "PascalCase with 'I' or 'T' prefix"

code_quality:
  max_function_lines: 50
  max_file_lines: 300
  max_parameters: 4
  require_jsdoc: true
  forbidden_patterns:
    - "any"
    - "// @ts-ignore"
    - "console.log"

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
}

function isInsidePath(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

export function initSddConfig(
  projectRoot: string,
  output = 'sdd.yaml',
  options: { force?: boolean } = {},
): SddInitResult {
  const outputPath = resolve(projectRoot, output);
  const root = resolve(projectRoot);
  if (!isInsidePath(outputPath, root)) {
    return {
      created: false,
      path: outputPath,
      message: `拒绝写入项目根目录之外的 SDD 文件: ${outputPath}`,
    };
  }

  if (existsSync(outputPath) && !options.force) {
    return {
      created: false,
      path: outputPath,
      message: `文件已存在: ${outputPath}`,
    };
  }

  writeFileSync(outputPath, createSddTemplate(), 'utf-8');
  return {
    created: true,
    path: outputPath,
    message: `SDD 配置文件已创建: ${outputPath}`,
  };
}

export function validateSddConfig(projectRoot: string, sddPath = 'sdd.yaml'): SddValidationResult {
  const fullPath = resolve(projectRoot, sddPath);
  if (!existsSync(fullPath)) {
    return {
      success: false,
      path: fullPath,
      errors: [`文件不存在: ${fullPath}`],
    };
  }

  const parser = createSDDParser();
  const result = parser.parseFile(fullPath);
  if (!result.success || !result.config) {
    return {
      success: false,
      path: fullPath,
      errors: result.errors ?? ['SDD 配置解析失败'],
    };
  }

  return {
    success: true,
    path: fullPath,
    projectName: result.config.project.name,
    framework: result.config.techStack.framework,
    frameworkVersion: result.config.techStack.version,
  };
}

export function generateSddPrompt(
  projectRoot: string,
  sddPath = 'sdd.yaml',
  options: { compact?: boolean; language?: 'zh' | 'en' } = {},
): string {
  const fullPath = resolve(projectRoot, sddPath);
  const parser = createSDDParser();
  const result = parser.parseFile(fullPath);

  if (!result.success || !result.config) {
    throw new Error(result.errors?.join('\n') || 'SDD 配置解析失败');
  }

  const generator = createPromptGenerator(result.config, {
    language: options.language ?? 'zh',
  });
  return options.compact ? generator.generateCompact() : generator.generate();
}
