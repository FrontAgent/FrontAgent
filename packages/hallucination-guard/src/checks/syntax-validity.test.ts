import { describe, expect, it } from 'vitest';
import { checkSyntaxValidity } from './syntax-validity.js';

describe('checkSyntaxValidity', () => {
  describe('typescript/javascript', () => {
    it('passes for valid code', async () => {
      const code = `function hello() {\n  return "world";\n}`;
      const result = await checkSyntaxValidity({ code, language: 'typescript' });
      expect(result.pass).toBe(true);
    });

    it('detects unclosed brackets', async () => {
      const code = `function hello() {\n  return "world";\n`;
      const result = await checkSyntaxValidity({ code, language: 'typescript' });
      expect(result.pass).toBe(false);
      expect(result.message).toMatch(/syntax errors/i);
    });

    it('detects mismatched brackets', async () => {
      const code = 'const arr = [1, 2, 3);';
      const result = await checkSyntaxValidity({ code, language: 'javascript' });
      expect(result.pass).toBe(false);
    });

    it('ignores brackets in strings', async () => {
      const code = `const s = "hello { world }";`;
      const result = await checkSyntaxValidity({ code, language: 'typescript' });
      expect(result.pass).toBe(true);
    });

    it('ignores brackets in comments', async () => {
      const code = '// this has { unclosed\nconst x = 1;';
      const result = await checkSyntaxValidity({ code, language: 'typescript' });
      expect(result.pass).toBe(true);
    });

    it('ignores brackets in multi-line comments', async () => {
      const code = '/* { unclosed */\nconst x = 1;';
      const result = await checkSyntaxValidity({ code, language: 'typescript' });
      expect(result.pass).toBe(true);
    });
  });

  describe('json', () => {
    it('passes for valid JSON', async () => {
      const code = `{"name": "test", "version": "1.0.0"}`;
      const result = await checkSyntaxValidity({ code, language: 'json' });
      expect(result.pass).toBe(true);
    });

    it('detects invalid JSON', async () => {
      const code = `{name: "test"}`;
      const result = await checkSyntaxValidity({ code, language: 'json' });
      expect(result.pass).toBe(false);
      expect(result.type).toBe('syntax_validity');
    });

    it('detects trailing commas in JSON', async () => {
      const code = `{"a": 1,}`;
      const result = await checkSyntaxValidity({ code, language: 'json' });
      expect(result.pass).toBe(false);
    });
  });

  describe('yaml', () => {
    it('passes for any YAML (simplified check)', async () => {
      const code = 'key: value\nnested:\n  child: true';
      const result = await checkSyntaxValidity({ code, language: 'yaml' });
      expect(result.pass).toBe(true);
    });
  });

  it('includes filePath in error message when provided', async () => {
    const code = '{invalid';
    const result = await checkSyntaxValidity({
      code,
      language: 'typescript',
      filePath: 'src/broken.ts',
    });
    expect(result.pass).toBe(false);
    expect(result.message).toContain('src/broken.ts');
  });
});
