import { describe, expect, it } from 'vitest';
import { SDDParser } from './parser.js';
import { SDDPromptGenerator } from './prompt-generator.js';
import { SDDValidator } from './validator.js';
import { defaultSDDConfig } from './schema.js';

const VALID_YAML = `
version: "1.0"
project:
  name: test-app
  type: spa
techStack:
  framework: react
  version: "^18.0.0"
  language: typescript
  forbiddenPackages:
    - jquery
    - lodash
directoryStructure:
  components:
    maxLines: 200
moduleBoundaries:
  - from: "src/utils/**"
    canImport:
      - "src/utils/**"
    cannotImport:
      - "src/components/**"
namingConventions:
  components: PascalCase
  hooks: "camelCase with use prefix"
  utils: camelCase
  constants: SCREAMING_SNAKE_CASE
  types: PascalCase
codeQuality:
  maxFunctionLines: 50
  maxFileLines: 300
  maxParameters: 4
  requireJsdoc: false
  forbiddenPatterns:
    - "console\\\\.log"
modificationRules:
  protectedFiles:
    - "package-lock.json"
  protectedDirectories:
    - node_modules
    - .git
  requireApproval:
    - pattern: "src/core/**"
      reason: "Core module changes require review"
`;

describe('SDDParser', () => {
  const parser = new SDDParser();

  it('parses valid YAML config', () => {
    const result = parser.parseContent(VALID_YAML);
    expect(result.success).toBe(true);
    expect(result.config).toBeDefined();
    expect(result.config!.project.name).toBe('test-app');
    expect(result.config!.techStack.framework).toBe('react');
    expect(result.config!.techStack.forbiddenPackages).toContain('jquery');
  });

  it('parses valid JSON config', () => {
    const json = JSON.stringify({
      version: '1.0',
      project: { name: 'json-app', type: 'spa' },
      techStack: {
        framework: 'vue',
        version: '^3.0.0',
        language: 'typescript',
        forbiddenPackages: [],
      },
      directoryStructure: {},
      moduleBoundaries: [],
      namingConventions: {
        components: 'PascalCase',
        hooks: 'camelCase with use prefix',
        utils: 'camelCase',
        constants: 'SCREAMING_SNAKE_CASE',
        types: 'PascalCase',
      },
      codeQuality: {
        maxFunctionLines: 50,
        maxFileLines: 300,
        maxParameters: 4,
        requireJsdoc: false,
        forbiddenPatterns: [],
      },
      modificationRules: {
        protectedFiles: [],
        protectedDirectories: [],
        requireApproval: [],
      },
    });
    const result = parser.parseContent(json);
    expect(result.success).toBe(true);
    expect(result.config!.project.name).toBe('json-app');
  });

  it('returns errors for invalid content', () => {
    const result = parser.parseContent('not: valid: yaml: [[[');
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it('returns error for non-existent file', () => {
    const result = parser.parseFile('/nonexistent/path/sdd.yaml');
    expect(result.success).toBe(false);
    expect(result.errors![0]).toContain('not found');
  });

  it('merges with default config for partial input', () => {
    const result = parser.parseContent(VALID_YAML);
    expect(result.success).toBe(true);
    expect(result.config!.codeQuality.maxParameters).toBe(4);
  });
});

describe('SDDValidator', () => {
  it('passes valid action with no violations', () => {
    const validator = new SDDValidator(defaultSDDConfig);
    const result = validator.validate({
      type: 'create_file',
      targetPath: 'src/components/Button.tsx',
      content: 'export function Button() { return <button />; }',
    });
    expect(result.valid).toBe(true);
    expect(result.violations.filter((v) => v.type === 'error')).toHaveLength(0);
  });

  it('blocks modification of protected directories', () => {
    const validator = new SDDValidator(defaultSDDConfig);
    const result = validator.validate({
      type: 'create_file',
      targetPath: 'node_modules/foo/index.js',
      content: 'module.exports = {};',
    });
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.rule === 'protected_directory')).toBe(true);
  });

  it('detects forbidden packages', () => {
    const config = {
      ...defaultSDDConfig,
      techStack: { ...defaultSDDConfig.techStack, forbiddenPackages: ['jquery', 'moment'] },
    };
    const validator = new SDDValidator(config);
    const result = validator.validate({
      type: 'create_file',
      targetPath: 'src/index.ts',
      dependencies: ['jquery'],
    });
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.rule === 'forbidden_package')).toBe(true);
  });

  it('detects module boundary violations', () => {
    const config = {
      ...defaultSDDConfig,
      moduleBoundaries: [
        { from: 'src/utils/**', canImport: ['src/utils/**'], cannotImport: ['src/components/**'] },
      ],
    };
    const validator = new SDDValidator(config);
    const result = validator.validate({
      type: 'create_file',
      targetPath: 'src/utils/helper.ts',
      imports: ['src/components/Button'],
    });
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.rule === 'module_boundary')).toBe(true);
  });

  it('warns on file exceeding maxFileLines', () => {
    const config = { ...defaultSDDConfig, codeQuality: { ...defaultSDDConfig.codeQuality, maxFileLines: 10 } };
    const validator = new SDDValidator(config);
    const result = validator.validate({
      type: 'create_file',
      targetPath: 'src/big.ts',
      content: Array(20).fill('const x = 1;').join('\n'),
    });
    expect(result.violations.some((v) => v.rule === 'max_file_lines')).toBe(true);
  });

  it('detects forbidden patterns in code', () => {
    const config = {
      ...defaultSDDConfig,
      codeQuality: { ...defaultSDDConfig.codeQuality, forbiddenPatterns: ['console\\.log'] },
    };
    const validator = new SDDValidator(config);
    const result = validator.validate({
      type: 'create_file',
      targetPath: 'src/index.ts',
      content: 'console.log("debug");',
    });
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.rule === 'forbidden_pattern')).toBe(true);
  });

  it('flags protected files for approval', () => {
    const config = {
      ...defaultSDDConfig,
      modificationRules: {
        ...defaultSDDConfig.modificationRules,
        protectedFiles: ['package-lock.json'],
        requireApproval: [{ pattern: 'src/core/**', reason: 'Core changes need review' }],
      },
    };
    const validator = new SDDValidator(config);
    const result = validator.validate({
      type: 'apply_patch',
      targetPath: 'src/core/engine.ts',
    });
    expect(result.requiresApproval).toBe(true);
    expect(result.approvalReasons.length).toBeGreaterThan(0);
  });

  it('warns on non-PascalCase component names', () => {
    const validator = new SDDValidator(defaultSDDConfig);
    const result = validator.validate({
      type: 'create_file',
      targetPath: 'src/components/my-button.tsx',
      content: 'export function MyButton() {}',
    });
    expect(result.violations.some((v) => v.rule === 'naming_convention')).toBe(true);
  });
});

describe('SDDPromptGenerator', () => {
  it('generates a non-empty prompt from config', () => {
    const generator = new SDDPromptGenerator(defaultSDDConfig);
    const prompt = generator.generate();
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt).toContain('SDD');
  });

  it('includes project name in prompt', () => {
    const config = { ...defaultSDDConfig, project: { name: 'my-app', type: 'spa' } };
    const generator = new SDDPromptGenerator(config);
    const prompt = generator.generate();
    expect(prompt).toContain('my-app');
  });

  it('includes forbidden packages in prompt', () => {
    const config = {
      ...defaultSDDConfig,
      techStack: { ...defaultSDDConfig.techStack, forbiddenPackages: ['jquery'] },
    };
    const generator = new SDDPromptGenerator(config);
    const prompt = generator.generate();
    expect(prompt).toContain('jquery');
  });

  it('respects language option', () => {
    const generator = new SDDPromptGenerator(defaultSDDConfig, { language: 'en' });
    const prompt = generator.generate();
    expect(prompt).toContain('Project Constraints');
  });
});
