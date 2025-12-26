/**
 * SDD 解析器
 * 负责解析和验证 SDD 配置文件
 */

import { readFileSync, existsSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import Ajv from 'ajv';
import { SDDSchema, defaultSDDConfig } from './schema.js';
import { deepMerge, type SDDConfig } from '@frontagent/shared';

export interface ParseResult {
  success: boolean;
  config?: SDDConfig;
  errors?: string[];
}

/**
 * SDD 解析器类
 */
export class SDDParser {
  private ajv: Ajv;
  private validateFn: ReturnType<Ajv['compile']>;

  constructor() {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    this.validateFn = this.ajv.compile(SDDSchema);
  }

  /**
   * 从文件路径解析 SDD 配置
   */
  parseFile(filePath: string): ParseResult {
    if (!existsSync(filePath)) {
      return {
        success: false,
        errors: [`SDD file not found: ${filePath}`]
      };
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      return this.parseContent(content, filePath);
    } catch (error) {
      return {
        success: false,
        errors: [`Failed to read SDD file: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  /**
   * 解析 SDD 内容字符串
   */
  parseContent(content: string, source: string = 'inline'): ParseResult {
    let rawConfig: unknown;

    // 尝试解析 YAML
    try {
      rawConfig = parseYaml(content);
    } catch (yamlError) {
      // 尝试解析 JSON
      try {
        rawConfig = JSON.parse(content);
      } catch (jsonError) {
        return {
          success: false,
          errors: [`Failed to parse SDD content from ${source}: Invalid YAML/JSON format`]
        };
      }
    }

    // 转换 YAML 风格的 key 到 camelCase
    const normalizedConfig = this.normalizeConfig(rawConfig as Record<string, unknown>);

    // 与默认配置合并
    const mergedConfig = deepMerge(defaultSDDConfig, normalizedConfig);

    // 验证配置
    const isValid = this.validateFn(mergedConfig);
    if (!isValid) {
      const errors = this.validateFn.errors?.map(err => {
        return `${err.instancePath || 'root'}: ${err.message}`;
      }) ?? ['Unknown validation error'];
      
      return {
        success: false,
        errors
      };
    }

    return {
      success: true,
      config: mergedConfig as SDDConfig
    };
  }

  /**
   * 将 snake_case / kebab-case 键转换为 camelCase
   */
  private normalizeConfig(obj: Record<string, unknown>): Record<string, unknown> {
    const keyMap: Record<string, string> = {
      'tech_stack': 'techStack',
      'directory_structure': 'directoryStructure',
      'module_boundaries': 'moduleBoundaries',
      'naming_conventions': 'namingConventions',
      'code_quality': 'codeQuality',
      'modification_rules': 'modificationRules',
      'forbidden_packages': 'forbiddenPackages',
      'state_management': 'stateManagement',
      'max_lines': 'maxLines',
      'required_exports': 'requiredExports',
      'must_be_pure': 'mustBePure',
      'can_import': 'canImport',
      'cannot_import': 'cannotImport',
      'max_function_lines': 'maxFunctionLines',
      'max_file_lines': 'maxFileLines',
      'max_parameters': 'maxParameters',
      'require_jsdoc': 'requireJsdoc',
      'forbidden_patterns': 'forbiddenPatterns',
      'protected_files': 'protectedFiles',
      'protected_directories': 'protectedDirectories',
      'require_approval': 'requireApproval'
    };

    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const normalizedKey = keyMap[key] ?? key;
      
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        result[normalizedKey] = this.normalizeConfig(value as Record<string, unknown>);
      } else if (Array.isArray(value)) {
        result[normalizedKey] = value.map(item => {
          if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
            return this.normalizeConfig(item as Record<string, unknown>);
          }
          return item;
        });
      } else {
        result[normalizedKey] = value;
      }
    }

    return result;
  }

  /**
   * 获取默认配置
   */
  getDefaultConfig(): SDDConfig {
    return { ...defaultSDDConfig };
  }
}

/**
 * 创建 SDD 解析器实例
 */
export function createSDDParser(): SDDParser {
  return new SDDParser();
}

