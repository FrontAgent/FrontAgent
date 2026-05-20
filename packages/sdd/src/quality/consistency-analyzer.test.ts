import { describe, expect, it } from 'vitest';
import { ConsistencyAnalyzer } from './consistency-analyzer.js';

describe('ConsistencyAnalyzer', () => {
  const analyzer = new ConsistencyAnalyzer();

  describe('missing artifact detection', () => {
    it('warns when plan exists without spec', () => {
      const result = analyzer.analyze({ planContent: '## Step 1\n- Do something' });
      expect(result.issues.some((i) => i.type === 'missing_artifact' && i.source === 'spec')).toBe(
        true,
      );
    });

    it('warns when tasks exist without spec', () => {
      const result = analyzer.analyze({ tasksContent: '- [ ] Task 1' });
      expect(result.issues.some((i) => i.type === 'missing_artifact' && i.source === 'spec')).toBe(
        true,
      );
    });

    it('warns when tasks exist without plan but with spec', () => {
      const result = analyzer.analyze({
        specContent: '- MUST: support authentication',
        tasksContent: '- [ ] Implement auth',
      });
      expect(result.issues.some((i) => i.type === 'missing_artifact' && i.source === 'plan')).toBe(
        true,
      );
    });

    it('no missing artifact warning when all present', () => {
      const result = analyzer.analyze({
        specContent: '- MUST: support auth',
        planContent: '## Auth\n- Implement login',
        tasksContent: '- [ ] Login page',
      });
      expect(result.issues.filter((i) => i.type === 'missing_artifact')).toHaveLength(0);
    });

    it('no issues when only spec is provided', () => {
      const result = analyzer.analyze({ specContent: '- MUST: do something' });
      expect(result.issues.filter((i) => i.type === 'missing_artifact')).toHaveLength(0);
    });
  });

  describe('requirement extraction', () => {
    it('extracts checkbox items as requirements', () => {
      const result = analyzer.analyze({
        specContent: '- [ ] User can login\n- [x] User can logout',
        planContent: '## Login\n- Implement login flow\n## Logout\n- Implement logout flow',
      });
      expect(result.coverage.specRequirements).toBe(2);
    });

    it('extracts MUST/SHALL/SHOULD items', () => {
      const result = analyzer.analyze({
        specContent: '- MUST: validate input\n- SHOULD: log errors',
        planContent: '## Validation\n- Add input validation and error logging',
      });
      expect(result.coverage.specRequirements).toBe(2);
    });

    it('extracts AC/REQ numbered items', () => {
      const result = analyzer.analyze({
        specContent: 'AC-1 Login works\nREQ-2 Logout works',
        planContent: '## Auth\n- Login and logout implementation',
      });
      expect(result.coverage.specRequirements).toBe(2);
    });
  });

  describe('coverage matching', () => {
    it('detects covered requirements', () => {
      const result = analyzer.analyze({
        specContent: '- MUST: implement user authentication',
        planContent: '## Authentication\n- Implement user authentication flow',
      });
      expect(result.coverage.coveredByPlan).toBeGreaterThan(0);
      expect(result.coverage.ratio).toBeGreaterThan(0);
    });

    it('detects uncovered requirements', () => {
      const result = analyzer.analyze({
        specContent: '- MUST: implement payment processing\n- MUST: implement user login',
        planContent: '## Login\n- Implement user login flow',
      });
      const uncovered = result.issues.filter((i) => i.type === 'uncovered_requirement');
      expect(uncovered.length).toBeGreaterThan(0);
      expect(uncovered[0].message).toContain('payment');
    });

    it('returns ratio 1 when no requirements exist', () => {
      const result = analyzer.analyze({
        specContent: 'Just some notes without formal requirements',
        planContent: '## Notes\n- Some plan items',
      });
      expect(result.coverage.ratio).toBe(1);
    });

    it('counts task coverage separately from plan coverage', () => {
      const result = analyzer.analyze({
        specContent: '- MUST: implement caching',
        planContent: '## Unrelated\n- Something else',
        tasksContent: '- Implement caching layer with Redis',
      });
      expect(result.coverage.coveredByTasks).toBeGreaterThanOrEqual(result.coverage.coveredByPlan);
    });
  });

  describe('overall consistency', () => {
    it('returns consistent true when no errors', () => {
      const result = analyzer.analyze({
        specContent: '- MUST: implement login',
        planContent: '## Login\n- Implement login flow',
        tasksContent: '- [ ] Build login page',
      });
      expect(result.consistent).toBe(true);
    });

    it('returns consistent true even with warnings', () => {
      const result = analyzer.analyze({
        planContent: '## Something\n- A plan without spec',
      });
      expect(result.consistent).toBe(true);
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });
});
