/**
 * SDD 约束验证器
 * 根据 SDD 配置验证 Agent 的操作是否符合约束
 */

import { minimatch } from 'minimatch';
import {
  type SDDConfig,
  type ConstraintViolation,
  type ActionType,
  normalizePath,
} from '@frontagent/shared';

/**
 * Agent 操作描述
 */
export interface AgentAction {
  type: ActionType;
  targetPath?: string;
  sourcePath?: string;
  content?: string;
  imports?: string[];
  exports?: string[];
  dependencies?: string[];
}

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  violations: ConstraintViolation[];
  requiresApproval: boolean;
  approvalReasons: string[];
}

/**
 * SDD 约束验证器
 */
export class SDDValidator {
  private config: SDDConfig;

  constructor(config: SDDConfig) {
    this.config = config;
  }

  /**
   * 验证 Agent 操作
   */
  validate(action: AgentAction): ValidationResult {
    const violations: ConstraintViolation[] = [];
    const approvalReasons: string[] = [];

    // 1. 检查文件保护规则
    if (action.targetPath) {
      const protectionResult = this.checkFileProtection(action.targetPath);
      violations.push(...protectionResult.violations);
      approvalReasons.push(...protectionResult.approvalReasons);
    }

    // 2. 检查模块边界
    if (action.targetPath && action.imports) {
      const boundaryViolations = this.checkModuleBoundaries(action.targetPath, action.imports);
      violations.push(...boundaryViolations);
    }

    // 3. 检查禁止的包
    if (action.dependencies) {
      const packageViolations = this.checkForbiddenPackages(action.dependencies);
      violations.push(...packageViolations);
    }

    // 4. 检查代码质量（如果有内容）
    if (action.content) {
      const qualityViolations = this.checkCodeQuality(action.content, action.targetPath);
      violations.push(...qualityViolations);
    }

    // 5. 检查命名规范
    if (action.targetPath) {
      const namingViolations = this.checkNamingConventions(action.targetPath);
      violations.push(...namingViolations);
    }

    // 6. 检查目录结构规则
    if (action.targetPath && action.type === 'create_file') {
      const directoryViolations = this.checkDirectoryRules(action.targetPath, action.content);
      violations.push(...directoryViolations);
    }

    const hasErrors = violations.some(v => v.type === 'error');

    return {
      valid: !hasErrors,
      violations,
      requiresApproval: approvalReasons.length > 0,
      approvalReasons
    };
  }

  /**
   * 检查文件保护规则
   */
  private checkFileProtection(targetPath: string): {
    violations: ConstraintViolation[];
    approvalReasons: string[];
  } {
    const violations: ConstraintViolation[] = [];
    const approvalReasons: string[] = [];
    const normalizedPath = normalizePath(targetPath);

    // 检查是否在保护目录中
    for (const dir of this.config.modificationRules.protectedDirectories) {
      if (normalizedPath.startsWith(normalizePath(dir))) {
        violations.push({
          type: 'error',
          rule: 'protected_directory',
          message: `Cannot modify files in protected directory: ${dir}`,
          location: targetPath,
          suggestion: 'This directory is protected by SDD configuration'
        });
      }
    }

    // 检查是否是保护文件
    for (const file of this.config.modificationRules.protectedFiles) {
      if (minimatch(normalizedPath, file) || normalizedPath.endsWith(file)) {
        violations.push({
          type: 'error',
          rule: 'protected_file',
          message: `Cannot modify protected file: ${file}`,
          location: targetPath,
          suggestion: 'This file is protected and requires manual modification'
        });
      }
    }

    // 检查是否需要审批
    for (const rule of this.config.modificationRules.requireApproval) {
      if (minimatch(normalizedPath, rule.pattern)) {
        approvalReasons.push(`${rule.reason} (pattern: ${rule.pattern})`);
      }
    }

    return { violations, approvalReasons };
  }

  /**
   * 检查模块边界
   */
  private checkModuleBoundaries(sourcePath: string, imports: string[]): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const normalizedSource = normalizePath(sourcePath);

    for (const boundary of this.config.moduleBoundaries) {
      if (minimatch(normalizedSource, boundary.from)) {
        for (const importPath of imports) {
          const normalizedImport = normalizePath(importPath);
          
          // 检查是否在禁止导入列表中
          for (const forbidden of boundary.cannotImport) {
            if (minimatch(normalizedImport, forbidden)) {
              violations.push({
                type: 'error',
                rule: 'module_boundary',
                message: `Module ${sourcePath} cannot import from ${importPath}`,
                location: sourcePath,
                suggestion: `According to SDD, files in ${boundary.from} cannot import from ${forbidden}`
              });
            }
          }

          // 如果定义了允许列表，检查是否在其中
          if (boundary.canImport.length > 0) {
            const isAllowed = boundary.canImport.some(allowed => 
              minimatch(normalizedImport, allowed) || 
              normalizedImport.startsWith('node:') ||
              !normalizedImport.startsWith('.')  // 外部包
            );
            
            if (!isAllowed && normalizedImport.startsWith('.')) {
              violations.push({
                type: 'warning',
                rule: 'module_boundary',
                message: `Import ${importPath} is not in allowed list for ${sourcePath}`,
                location: sourcePath,
                suggestion: `Allowed imports: ${boundary.canImport.join(', ')}`
              });
            }
          }
        }
      }
    }

    return violations;
  }

  /**
   * 检查禁止的包
   */
  private checkForbiddenPackages(dependencies: string[]): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    for (const dep of dependencies) {
      if (this.config.techStack.forbiddenPackages.includes(dep)) {
        violations.push({
          type: 'error',
          rule: 'forbidden_package',
          message: `Package "${dep}" is forbidden by SDD configuration`,
          suggestion: 'Please use an alternative package allowed by the project'
        });
      }
    }

    return violations;
  }

  /**
   * 检查代码质量
   */
  private checkCodeQuality(content: string, targetPath?: string): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const lines = content.split('\n');

    // 检查文件行数
    if (lines.length > this.config.codeQuality.maxFileLines) {
      violations.push({
        type: 'warning',
        rule: 'max_file_lines',
        message: `File exceeds maximum lines (${lines.length} > ${this.config.codeQuality.maxFileLines})`,
        location: targetPath,
        suggestion: 'Consider splitting this file into smaller modules'
      });
    }

    // 检查禁止的模式
    for (const pattern of this.config.codeQuality.forbiddenPatterns) {
      const regex = new RegExp(pattern, 'g');
      let match;
      let lineNum = 1;
      
      for (const line of lines) {
        if ((match = regex.exec(line)) !== null) {
          violations.push({
            type: 'error',
            rule: 'forbidden_pattern',
            message: `Forbidden pattern "${pattern}" found`,
            location: targetPath ? `${targetPath}:${lineNum}` : `line ${lineNum}`,
            suggestion: `Remove or replace the forbidden pattern: ${match[0]}`
          });
        }
        lineNum++;
        regex.lastIndex = 0; // Reset regex
      }
    }

    return violations;
  }

  /**
   * 检查命名规范
   */
  private checkNamingConventions(targetPath: string): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const normalizedPath = normalizePath(targetPath);
    const fileName = normalizedPath.split('/').pop() ?? '';
    const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, '');

    // 检查组件命名
    if (normalizedPath.includes('/components/')) {
      if (!this.isPascalCase(fileNameWithoutExt)) {
        violations.push({
          type: 'warning',
          rule: 'naming_convention',
          message: `Component file "${fileName}" should be PascalCase`,
          location: targetPath,
          suggestion: `Rename to ${this.toPascalCase(fileNameWithoutExt)}`
        });
      }
    }

    // 检查 hooks 命名
    if (normalizedPath.includes('/hooks/')) {
      if (!fileNameWithoutExt.startsWith('use')) {
        violations.push({
          type: 'warning',
          rule: 'naming_convention',
          message: `Hook file "${fileName}" should start with "use"`,
          location: targetPath,
          suggestion: `Rename to use${this.toPascalCase(fileNameWithoutExt)}`
        });
      }
    }

    // 检查 utils 命名
    if (normalizedPath.includes('/utils/')) {
      if (!this.isCamelCase(fileNameWithoutExt)) {
        violations.push({
          type: 'warning',
          rule: 'naming_convention',
          message: `Utility file "${fileName}" should be camelCase`,
          location: targetPath,
          suggestion: `Rename to ${this.toCamelCase(fileNameWithoutExt)}`
        });
      }
    }

    return violations;
  }

  /**
   * 检查目录结构规则
   */
  private checkDirectoryRules(targetPath: string, content?: string): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const normalizedPath = normalizePath(targetPath);

    for (const [dirPath, rules] of Object.entries(this.config.directoryStructure)) {
      if (normalizedPath.includes(`/${dirPath}/`) || normalizedPath.startsWith(`${dirPath}/`)) {
        // 检查行数限制
        if (rules.maxLines && content) {
          const lines = content.split('\n').length;
          if (lines > rules.maxLines) {
            violations.push({
              type: 'warning',
              rule: 'directory_max_lines',
              message: `File in ${dirPath}/ exceeds max lines (${lines} > ${rules.maxLines})`,
              location: targetPath
            });
          }
        }

        // 检查禁止的内容
        if (rules.forbidden && content) {
          for (const forbidden of rules.forbidden) {
            if (content.includes(forbidden)) {
              violations.push({
                type: 'warning',
                rule: 'directory_forbidden',
                message: `Files in ${dirPath}/ should not contain: ${forbidden}`,
                location: targetPath
              });
            }
          }
        }
      }
    }

    return violations;
  }

  // 辅助方法
  private isPascalCase(str: string): boolean {
    return /^[A-Z][a-zA-Z0-9]*$/.test(str);
  }

  private isCamelCase(str: string): boolean {
    return /^[a-z][a-zA-Z0-9]*$/.test(str);
  }

  private toPascalCase(str: string): string {
    return str
      .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
      .replace(/^(.)/, (_, c) => c.toUpperCase());
  }

  private toCamelCase(str: string): string {
    return str
      .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
      .replace(/^(.)/, (_, c) => c.toLowerCase());
  }

  /**
   * 获取当前 SDD 配置
   */
  getConfig(): SDDConfig {
    return this.config;
  }

  /**
   * 更新配置
   */
  updateConfig(config: SDDConfig): void {
    this.config = config;
  }
}

/**
 * 创建 SDD 验证器实例
 */
export function createSDDValidator(config: SDDConfig): SDDValidator {
  return new SDDValidator(config);
}

