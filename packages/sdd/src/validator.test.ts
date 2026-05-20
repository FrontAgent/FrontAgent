import type { SDDConfig } from '@frontagent/shared';
import { describe, expect, it } from 'vitest';
import { defaultSDDConfig } from './schema.js';
import { SDDValidator } from './validator.js';

function makeConfig(overrides: Partial<SDDConfig> = {}): SDDConfig {
  return { ...defaultSDDConfig, ...overrides } as SDDConfig;
}

describe('SDDValidator', () => {
  describe('file protection', () => {
    it('blocks modification of protected directories', () => {
      const validator = new SDDValidator(makeConfig());
      const result = validator.validate({
        type: 'write_file',
        targetPath: 'node_modules/pkg/index.js',
      });
      expect(result.valid).toBe(false);
      expect(result.violations[0].rule).toBe('protected_directory');
    });

    it('blocks modification of .git directory', () => {
      const validator = new SDDValidator(makeConfig());
      const result = validator.validate({
        type: 'write_file',
        targetPath: '.git/config',
      });
      expect(result.valid).toBe(false);
    });

    it('blocks modification of protected files', () => {
      const config = makeConfig({
        modificationRules: {
          ...defaultSDDConfig.modificationRules,
          protectedFiles: ['package-lock.json'],
        },
      });
      const validator = new SDDValidator(config);
      const result = validator.validate({
        type: 'write_file',
        targetPath: 'package-lock.json',
      });
      expect(result.valid).toBe(false);
      expect(result.violations[0].rule).toBe('protected_file');
    });

    it('flags files requiring approval', () => {
      const config = makeConfig({
        modificationRules: {
          ...defaultSDDConfig.modificationRules,
          requireApproval: [{ pattern: '*.config.*', reason: 'Config changes need review' }],
        },
      });
      const validator = new SDDValidator(config);
      const result = validator.validate({
        type: 'write_file',
        targetPath: 'vite.config.ts',
      });
      expect(result.valid).toBe(true);
      expect(result.requiresApproval).toBe(true);
      expect(result.approvalReasons[0]).toContain('Config changes need review');
    });

    it('allows modification of non-protected paths', () => {
      const validator = new SDDValidator(makeConfig());
      const result = validator.validate({
        type: 'write_file',
        targetPath: 'src/components/Button.tsx',
      });
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('module boundaries', () => {
    const config = makeConfig({
      moduleBoundaries: [
        {
          from: 'src/components/**',
          canImport: ['src/utils/**', 'src/hooks/**'],
          cannotImport: ['src/api/**'],
        },
      ],
    });

    it('blocks forbidden imports', () => {
      const validator = new SDDValidator(config);
      const result = validator.validate({
        type: 'write_file',
        targetPath: 'src/components/Button.tsx',
        imports: ['./../../api/client'],
      });
      expect(result.violations.some((v) => v.rule === 'module_boundary')).toBe(true);
    });

    it('allows imports from permitted modules', () => {
      const validator = new SDDValidator(config);
      const result = validator.validate({
        type: 'write_file',
        targetPath: 'src/components/Button.tsx',
        imports: ['src/utils/format'],
      });
      const boundaryViolations = result.violations.filter((v) => v.rule === 'module_boundary');
      expect(boundaryViolations).toHaveLength(0);
    });

    it('allows external package imports', () => {
      const validator = new SDDValidator(config);
      const result = validator.validate({
        type: 'write_file',
        targetPath: 'src/components/Button.tsx',
        imports: ['react', 'lodash'],
      });
      const boundaryViolations = result.violations.filter((v) => v.rule === 'module_boundary');
      expect(boundaryViolations).toHaveLength(0);
    });
  });

  describe('forbidden packages', () => {
    it('blocks forbidden dependencies', () => {
      const config = makeConfig({
        techStack: { ...defaultSDDConfig.techStack, forbiddenPackages: ['moment', 'lodash'] },
      });
      const validator = new SDDValidator(config);
      const result = validator.validate({
        type: 'write_file',
        dependencies: ['moment'],
      });
      expect(result.valid).toBe(false);
      expect(result.violations[0].rule).toBe('forbidden_package');
    });

    it('allows non-forbidden dependencies', () => {
      const config = makeConfig({
        techStack: { ...defaultSDDConfig.techStack, forbiddenPackages: ['moment'] },
      });
      const validator = new SDDValidator(config);
      const result = validator.validate({
        type: 'write_file',
        dependencies: ['date-fns'],
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('code quality', () => {
    it('warns when file exceeds max lines', () => {
      const config = makeConfig({
        codeQuality: { ...defaultSDDConfig.codeQuality, maxFileLines: 10 },
      });
      const validator = new SDDValidator(config);
      const content = Array(15).fill('const x = 1;').join('\n');
      const result = validator.validate({
        type: 'create_file',
        targetPath: 'src/big.ts',
        content,
      });
      expect(result.violations.some((v) => v.rule === 'max_file_lines')).toBe(true);
    });

    it('detects forbidden patterns', () => {
      const config = makeConfig({
        codeQuality: { ...defaultSDDConfig.codeQuality, forbiddenPatterns: ['console\\.log'] },
      });
      const validator = new SDDValidator(config);
      const result = validator.validate({
        type: 'create_file',
        targetPath: 'src/app.ts',
        content: 'console.log("debug");\n',
      });
      expect(result.violations.some((v) => v.rule === 'forbidden_pattern')).toBe(true);
    });

    it('passes clean code', () => {
      const validator = new SDDValidator(makeConfig());
      const result = validator.validate({
        type: 'create_file',
        targetPath: 'src/app.ts',
        content: 'export const x = 1;\n',
      });
      const qualityViolations = result.violations.filter(
        (v) => v.rule === 'max_file_lines' || v.rule === 'forbidden_pattern',
      );
      expect(qualityViolations).toHaveLength(0);
    });
  });

  describe('naming conventions', () => {
    it('warns on non-PascalCase component files', () => {
      const validator = new SDDValidator(makeConfig());
      const result = validator.validate({
        type: 'create_file',
        targetPath: 'src/components/my-button.tsx',
      });
      expect(result.violations.some((v) => v.rule === 'naming_convention')).toBe(true);
    });

    it('passes PascalCase component files', () => {
      const validator = new SDDValidator(makeConfig());
      const result = validator.validate({
        type: 'create_file',
        targetPath: 'src/components/MyButton.tsx',
      });
      const namingViolations = result.violations.filter((v) => v.rule === 'naming_convention');
      expect(namingViolations).toHaveLength(0);
    });

    it('warns on hooks not starting with use', () => {
      const validator = new SDDValidator(makeConfig());
      const result = validator.validate({
        type: 'create_file',
        targetPath: 'src/hooks/fetchData.ts',
      });
      expect(result.violations.some((v) => v.rule === 'naming_convention')).toBe(true);
    });

    it('passes hooks starting with use', () => {
      const validator = new SDDValidator(makeConfig());
      const result = validator.validate({
        type: 'create_file',
        targetPath: 'src/hooks/useFetchData.ts',
      });
      const namingViolations = result.violations.filter((v) => v.rule === 'naming_convention');
      expect(namingViolations).toHaveLength(0);
    });

    it('warns on non-camelCase utility files', () => {
      const validator = new SDDValidator(makeConfig());
      const result = validator.validate({
        type: 'create_file',
        targetPath: 'src/utils/FormatDate.ts',
      });
      expect(result.violations.some((v) => v.rule === 'naming_convention')).toBe(true);
    });
  });

  describe('directory structure rules', () => {
    it('warns when file exceeds directory maxLines', () => {
      const config = makeConfig({
        directoryStructure: {
          'src/hooks': { maxLines: 5 },
        },
      });
      const validator = new SDDValidator(config);
      const content = Array(10).fill('const x = 1;').join('\n');
      const result = validator.validate({
        type: 'create_file',
        targetPath: 'src/hooks/useAuth.ts',
        content,
      });
      expect(result.violations.some((v) => v.rule === 'directory_max_lines')).toBe(true);
    });

    it('warns on forbidden content in directory', () => {
      const config = makeConfig({
        directoryStructure: {
          'src/utils': { forbidden: ['fetch('] },
        },
      });
      const validator = new SDDValidator(config);
      const result = validator.validate({
        type: 'create_file',
        targetPath: 'src/utils/api.ts',
        content: 'export const get = () => fetch("/api");\n',
      });
      expect(result.violations.some((v) => v.rule === 'directory_forbidden')).toBe(true);
    });
  });

  describe('validate orchestration', () => {
    it('returns valid=true with no violations for clean action', () => {
      const validator = new SDDValidator(makeConfig());
      const result = validator.validate({
        type: 'create_file',
        targetPath: 'src/utils/format.ts',
        content: 'export function format(s: string) { return s; }\n',
      });
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.requiresApproval).toBe(false);
    });

    it('accumulates violations from multiple checks', () => {
      const config = makeConfig({
        codeQuality: {
          ...defaultSDDConfig.codeQuality,
          maxFileLines: 5,
          forbiddenPatterns: ['TODO'],
        },
      });
      const validator = new SDDValidator(config);
      const content = Array(10).fill('// TODO: fix').join('\n');
      const result = validator.validate({
        type: 'create_file',
        targetPath: 'src/app.ts',
        content,
      });
      expect(result.violations.length).toBeGreaterThan(1);
    });
  });
});
