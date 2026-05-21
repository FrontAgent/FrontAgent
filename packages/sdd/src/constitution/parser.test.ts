import { describe, expect, it } from 'vitest';
import { createConstitutionParser } from './parser.js';

describe('ConstitutionParser', () => {
  describe('parseContent', () => {
    it('parses valid YAML with principles and behaviors', () => {
      const yaml = `
version: "2.0"
principles:
  - name: Safety First
    description: Never execute destructive commands without confirmation
    priority: critical
    examples:
      - Always confirm before rm -rf
behaviors:
  - trigger: user requests file deletion
    action: Ask for confirmation before proceeding
    rationale: Prevent accidental data loss
`;
      const parser = createConstitutionParser();
      const result = parser.parseContent(yaml);
      expect(result.success).toBe(true);
      expect(result.constitution!.version).toBe('2.0');
      expect(result.constitution!.principles).toHaveLength(1);
      expect(result.constitution!.principles[0].name).toBe('Safety First');
      expect(result.constitution!.principles[0].priority).toBe('critical');
      expect(result.constitution!.principles[0].examples).toEqual(['Always confirm before rm -rf']);
      expect(result.constitution!.behaviors).toHaveLength(1);
      expect(result.constitution!.behaviors[0].trigger).toBe('user requests file deletion');
      expect(result.constitution!.behaviors[0].rationale).toBe('Prevent accidental data loss');
    });

    it('parses valid JSON', () => {
      const json = JSON.stringify({
        version: '1.0',
        principles: [{ name: 'DRY', description: 'Do not repeat yourself', priority: 'high' }],
        behaviors: [{ trigger: 'duplicate code detected', action: 'suggest extraction' }],
      });
      const parser = createConstitutionParser();
      const result = parser.parseContent(json);
      expect(result.success).toBe(true);
      expect(result.constitution!.principles[0].priority).toBe('high');
    });

    it('fails on invalid YAML/JSON', () => {
      const parser = createConstitutionParser();
      const result = parser.parseContent('{{{{not valid');
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid YAML/JSON format');
    });

    it('fails when content is not an object', () => {
      const parser = createConstitutionParser();
      const result = parser.parseContent('"just a string"');
      expect(result.success).toBe(false);
      expect(result.errors![0]).toContain('must be an object');
    });

    it('fails when no principles or behaviors defined', () => {
      const parser = createConstitutionParser();
      const result = parser.parseContent('version: "1.0"');
      expect(result.success).toBe(false);
      expect(result.errors![0]).toContain('at least one principle or behavior');
    });

    it('assigns default IDs when not provided', () => {
      const yaml = `
principles:
  - name: Test
    description: A test principle
behaviors:
  - trigger: something
    action: do something
`;
      const parser = createConstitutionParser();
      const result = parser.parseContent(yaml);
      expect(result.success).toBe(true);
      expect(result.constitution!.principles[0].id).toBe('principle-0');
      expect(result.constitution!.behaviors[0].id).toBe('behavior-0');
    });

    it('defaults priority to medium for unknown values', () => {
      const yaml = `
principles:
  - name: Test
    description: desc
    priority: unknown_value
behaviors:
  - trigger: x
    action: y
`;
      const parser = createConstitutionParser();
      const result = parser.parseContent(yaml);
      expect(result.success).toBe(true);
      expect(result.constitution!.principles[0].priority).toBe('medium');
    });

    it('reports errors for malformed principles', () => {
      const yaml = `
principles:
  - name: Missing Description
behaviors:
  - trigger: x
    action: y
`;
      const parser = createConstitutionParser();
      const result = parser.parseContent(yaml);
      expect(result.success).toBe(false);
      expect(result.errors!.some((e) => e.includes('missing required field "description"'))).toBe(
        true,
      );
    });

    it('reports errors for malformed behaviors', () => {
      const yaml = `
principles:
  - name: P
    description: D
behaviors:
  - trigger: only trigger no action
`;
      const parser = createConstitutionParser();
      const result = parser.parseContent(yaml);
      expect(result.success).toBe(false);
      expect(result.errors!.some((e) => e.includes('missing required field "action"'))).toBe(true);
    });

    it('parses review criteria with snake_case keys', () => {
      const yaml = `
principles:
  - name: P
    description: D
behaviors:
  - trigger: t
    action: a
review_criteria:
  - question: Is the code safe?
    fail_action: block
`;
      const parser = createConstitutionParser();
      const result = parser.parseContent(yaml);
      expect(result.success).toBe(true);
      expect(result.constitution!.reviewCriteria).toHaveLength(1);
      expect(result.constitution!.reviewCriteria![0].failAction).toBe('block');
    });

    it('defaults version to 1.0 when not specified', () => {
      const yaml = `
principles:
  - name: P
    description: D
`;
      const parser = createConstitutionParser();
      const result = parser.parseContent(yaml);
      expect(result.success).toBe(true);
      expect(result.constitution!.version).toBe('1.0');
    });
  });
});
