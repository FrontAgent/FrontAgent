/**
 * 幻觉防控器
 * 整合所有检查，验证 Agent 输出
 */

import type {
  SDDConfig,
  HallucinationCheckResult,
  ValidationResult,
  ActionType
} from '@frontagent/shared';
import type { AgentAction } from '@frontagent/sdd';
import { checkFileExistence } from './checks/file-existence.js';
import { checkAllImports, extractImports } from './checks/import-validity.js';
import { checkSyntaxValidity } from './checks/syntax-validity.js';
import { checkSDDCompliance } from './checks/sdd-compliance.js';

/**
 * Agent 输出描述
 */
export interface AgentOutput {
  /** 操作类型 */
  action: ActionType;
  /** 目标文件路径 */
  targetPath?: string;
  /** 源文件路径（用于移动/复制） */
  sourcePath?: string;
  /** 代码内容 */
  content?: string;
  /** 代码语言 */
  language?: 'typescript' | 'javascript' | 'json' | 'yaml';
  /** 提取的导入（如果有） */
  imports?: string[];
  /** 提取的依赖（npm 包） */
  dependencies?: string[];
}

/**
 * 检查配置
 */
export interface GuardConfig {
  /** 项目根目录 */
  projectRoot: string;
  /** SDD 配置 */
  sddConfig?: SDDConfig;
  /** 启用的检查 */
  enabledChecks?: {
    fileExistence?: boolean;
    importValidity?: boolean;
    syntaxValidity?: boolean;
    sddCompliance?: boolean;
  };
}

/**
 * 幻觉防控器类
 */
export class HallucinationGuard {
  private config: GuardConfig;
  private enabledChecks: Required<NonNullable<GuardConfig['enabledChecks']>>;

  constructor(config: GuardConfig) {
    this.config = config;
    this.enabledChecks = {
      fileExistence: config.enabledChecks?.fileExistence ?? true,
      importValidity: config.enabledChecks?.importValidity ?? true,
      syntaxValidity: config.enabledChecks?.syntaxValidity ?? true,
      sddCompliance: config.enabledChecks?.sddCompliance ?? true
    };
  }

  /**
   * 验证 Agent 输出
   */
  async validate(output: AgentOutput): Promise<ValidationResult> {
    const results: HallucinationCheckResult[] = [];

    // 1. 文件存在性检查
    if (this.enabledChecks.fileExistence && output.targetPath) {
      const shouldExist = ['read_file', 'apply_patch', 'delete_file'].includes(output.action);
      const fileCheck = await checkFileExistence({
        path: output.targetPath,
        projectRoot: this.config.projectRoot,
        shouldExist
      });
      results.push(fileCheck);
    }

    // 2. 导入有效性检查
    if (this.enabledChecks.importValidity && output.content && output.targetPath) {
      const imports = output.imports ?? extractImports(output.content);
      if (imports.length > 0) {
        const importChecks = await checkAllImports(
          output.content,
          output.targetPath,
          this.config.projectRoot
        );
        results.push(...importChecks);
      }
    }

    // 3. 语法有效性检查
    if (this.enabledChecks.syntaxValidity && output.content && output.language) {
      const syntaxCheck = await checkSyntaxValidity({
        code: output.content,
        language: output.language,
        filePath: output.targetPath
      });
      results.push(syntaxCheck);
    }

    // 4. SDD 合规性检查
    if (this.enabledChecks.sddCompliance && this.config.sddConfig) {
      const agentAction: AgentAction = {
        type: output.action,
        targetPath: output.targetPath,
        sourcePath: output.sourcePath,
        content: output.content,
        imports: output.imports,
        dependencies: output.dependencies
      };

      const sddCheck = await checkSDDCompliance({
        action: agentAction,
        sddConfig: this.config.sddConfig
      });
      results.push(sddCheck);
    }

    // 汇总结果
    const blockedBy = results
      .filter(r => !r.pass && r.severity === 'block')
      .map(r => r.message ?? r.type);

    const warnings = results
      .filter(r => r.severity === 'warn')
      .map(r => r.message ?? r.type);

    return {
      pass: blockedBy.length === 0,
      results,
      blockedBy: blockedBy.length > 0 ? blockedBy : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * 快速验证文件路径
   */
  async validateFilePath(path: string, shouldExist: boolean = true): Promise<HallucinationCheckResult> {
    return checkFileExistence({
      path,
      projectRoot: this.config.projectRoot,
      shouldExist
    });
  }

  /**
   * 快速验证代码
   */
  async validateCode(
    code: string,
    language: 'typescript' | 'javascript' | 'json' | 'yaml',
    filePath?: string
  ): Promise<ValidationResult> {
    const results: HallucinationCheckResult[] = [];

    // 语法检查
    const syntaxCheck = await checkSyntaxValidity({ code, language, filePath });
    results.push(syntaxCheck);

    // 导入检查（仅 TS/JS）
    if ((language === 'typescript' || language === 'javascript') && filePath) {
      const importChecks = await checkAllImports(code, filePath, this.config.projectRoot);
      results.push(...importChecks);
    }

    const blockedBy = results
      .filter(r => !r.pass && r.severity === 'block')
      .map(r => r.message ?? r.type);

    return {
      pass: blockedBy.length === 0,
      results,
      blockedBy: blockedBy.length > 0 ? blockedBy : undefined
    };
  }

  /**
   * 更新 SDD 配置
   */
  updateSDDConfig(sddConfig: SDDConfig): void {
    this.config.sddConfig = sddConfig;
  }

  /**
   * 启用/禁用检查
   */
  setCheckEnabled(check: keyof NonNullable<GuardConfig['enabledChecks']>, enabled: boolean): void {
    this.enabledChecks[check] = enabled;
  }
}

/**
 * 创建幻觉防控器实例
 */
export function createHallucinationGuard(config: GuardConfig): HallucinationGuard {
  return new HallucinationGuard(config);
}

