/**
 * SDD Schema 定义
 * 定义 SDD 配置文件的 JSON Schema，用于验证 SDD 文件格式
 */

import type { SDDConfig } from '@frontagent/shared';

/**
 * SDD 配置文件的 JSON Schema
 * 用于 Ajv 验证
 */
export const SDDSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    version: { type: 'string' },
    project: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        type: { type: 'string' },
        description: { type: 'string', nullable: true }
      },
      required: ['name', 'type'],
      additionalProperties: false
    },
    techStack: {
      type: 'object',
      properties: {
        framework: { type: 'string' },
        version: { type: 'string' },
        language: { type: 'string' },
        styling: { type: 'string', nullable: true },
        stateManagement: { type: 'string', nullable: true },
        forbiddenPackages: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      required: ['framework', 'version', 'language', 'forbiddenPackages'],
      additionalProperties: false
    },
    directoryStructure: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          pattern: { type: 'string', nullable: true },
          maxLines: { type: 'number', nullable: true },
          requiredExports: {
            type: 'array',
            items: { type: 'string' },
            nullable: true
          },
          forbidden: {
            type: 'array',
            items: { type: 'string' },
            nullable: true
          },
          mustBePure: { type: 'boolean', nullable: true }
        },
        additionalProperties: false
      }
    },
    moduleBoundaries: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          canImport: {
            type: 'array',
            items: { type: 'string' }
          },
          cannotImport: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['from', 'canImport', 'cannotImport'],
        additionalProperties: false
      }
    },
    namingConventions: {
      type: 'object',
      properties: {
        components: { type: 'string' },
        hooks: { type: 'string' },
        utils: { type: 'string' },
        constants: { type: 'string' },
        types: { type: 'string' }
      },
      required: ['components', 'hooks', 'utils', 'constants', 'types'],
      additionalProperties: false
    },
    codeQuality: {
      type: 'object',
      properties: {
        maxFunctionLines: { type: 'number' },
        maxFileLines: { type: 'number' },
        maxParameters: { type: 'number' },
        requireJsdoc: { type: 'boolean' },
        forbiddenPatterns: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      required: ['maxFunctionLines', 'maxFileLines', 'maxParameters', 'requireJsdoc', 'forbiddenPatterns'],
      additionalProperties: false
    },
    modificationRules: {
      type: 'object',
      properties: {
        protectedFiles: {
          type: 'array',
          items: { type: 'string' }
        },
        protectedDirectories: {
          type: 'array',
          items: { type: 'string' }
        },
        requireApproval: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              pattern: { type: 'string' },
              reason: { type: 'string' }
            },
            required: ['pattern', 'reason'],
            additionalProperties: false
          }
        }
      },
      required: ['protectedFiles', 'protectedDirectories', 'requireApproval'],
      additionalProperties: false
    }
  },
  required: [
    'version',
    'project',
    'techStack',
    'directoryStructure',
    'moduleBoundaries',
    'namingConventions',
    'codeQuality',
    'modificationRules'
  ],
  additionalProperties: false
};

/**
 * 默认 SDD 配置
 */
export const defaultSDDConfig: SDDConfig = {
  version: '1.0',
  project: {
    name: 'unnamed-project',
    type: 'generic'
  },
  techStack: {
    framework: 'react',
    version: '^18.0.0',
    language: 'typescript',
    forbiddenPackages: []
  },
  directoryStructure: {},
  moduleBoundaries: [],
  namingConventions: {
    components: 'PascalCase',
    hooks: 'camelCase with use prefix',
    utils: 'camelCase',
    constants: 'SCREAMING_SNAKE_CASE',
    types: 'PascalCase'
  },
  codeQuality: {
    maxFunctionLines: 50,
    maxFileLines: 300,
    maxParameters: 4,
    requireJsdoc: false,
    forbiddenPatterns: []
  },
  modificationRules: {
    protectedFiles: [],
    protectedDirectories: ['node_modules', '.git'],
    requireApproval: []
  }
};

