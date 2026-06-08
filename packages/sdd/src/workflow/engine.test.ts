import { describe, expect, it, vi } from 'vitest';
import { createWorkflowEngine } from './engine.js';

describe('WorkflowEngine', () => {
  describe('startWorkflow', () => {
    it('initializes state with idle phase', () => {
      const engine = createWorkflowEngine();
      const state = engine.startWorkflow('change-1');
      expect(state.changeId).toBe('change-1');
      expect(state.phase).toBe('idle');
      expect(state.artifacts).toEqual([]);
      expect(state.verificationEvidence).toEqual([]);
      expect(state.clarifyRounds).toBe(0);
    });

    it('sets timestamps', () => {
      const engine = createWorkflowEngine();
      const state = engine.startWorkflow('change-2');
      expect(state.createdAt).toBeTruthy();
      expect(state.updatedAt).toBeTruthy();
    });
  });

  describe('getState / loadState', () => {
    it('returns null before workflow starts', () => {
      const engine = createWorkflowEngine();
      expect(engine.getState()).toBeNull();
    });

    it('loads external state', () => {
      const engine = createWorkflowEngine();
      const state = engine.startWorkflow('x');
      state.phase = 'plan';

      const engine2 = createWorkflowEngine();
      engine2.loadState(state);
      expect(engine2.getCurrentPhase()).toBe('plan');
    });
  });

  describe('getCurrentPhase', () => {
    it('returns idle when no workflow', () => {
      const engine = createWorkflowEngine();
      expect(engine.getCurrentPhase()).toBe('idle');
    });
  });

  describe('canTransition', () => {
    it('fails when no active workflow', () => {
      const engine = createWorkflowEngine();
      const result = engine.canTransition('specify', '');
      expect(result.pass).toBe(false);
      expect(result.failures).toContain('No active workflow');
    });

    it('fails for invalid transition path', () => {
      const engine = createWorkflowEngine();
      engine.startWorkflow('c1');
      const result = engine.canTransition('complete', '');
      expect(result.pass).toBe(false);
      expect(result.failures[0]).toContain('No valid transition');
    });

    it('allows idle -> specify (custom guard always passes)', () => {
      const engine = createWorkflowEngine();
      engine.startWorkflow('c1');
      const result = engine.canTransition('specify', '');
      expect(result.pass).toBe(true);
    });
  });

  describe('transition', () => {
    it('transitions from idle to specify', () => {
      const engine = createWorkflowEngine();
      engine.startWorkflow('c1');
      const { success } = engine.transition('specify', '');
      expect(success).toBe(true);
      expect(engine.getCurrentPhase()).toBe('specify');
    });

    it('calls onPhaseChange callback', () => {
      const cb = vi.fn();
      const engine = createWorkflowEngine({ onPhaseChange: cb });
      engine.startWorkflow('c1');
      engine.transition('specify', '');
      expect(cb).toHaveBeenCalledWith('idle', 'specify', expect.any(Object));
    });

    it('in advisory mode, transitions even when guard fails', () => {
      const engine = createWorkflowEngine({ config: { gateMode: 'advisory' } });
      engine.startWorkflow('c1');
      engine.transition('specify', '');
      const { success } = engine.transition('clarify', '');
      expect(success).toBe(true);
    });

    it('in strict mode, blocks transition when guard fails', () => {
      const engine = createWorkflowEngine({ config: { gateMode: 'strict' } });
      engine.startWorkflow('c1');
      engine.transition('specify', '');
      const { success, result } = engine.transition('clarify', '');
      expect(success).toBe(false);
      expect(result.pass).toBe(false);
    });
  });

  describe('clarify rounds', () => {
    it('increments clarify round count', () => {
      const engine = createWorkflowEngine();
      engine.startWorkflow('c1');
      expect(engine.incrementClarifyRound()).toBe(1);
      expect(engine.incrementClarifyRound()).toBe(2);
    });

    it('detects exhausted clarify rounds', () => {
      const engine = createWorkflowEngine({ config: { maxClarifyRounds: 2 } });
      engine.startWorkflow('c1');
      expect(engine.isClarifyExhausted()).toBe(false);
      engine.incrementClarifyRound();
      engine.incrementClarifyRound();
      expect(engine.isClarifyExhausted()).toBe(true);
    });
  });

  describe('verification evidence', () => {
    it('adds evidence to state', () => {
      const engine = createWorkflowEngine();
      engine.startWorkflow('c1');
      engine.addVerificationEvidence({
        type: 'test_pass',
        source: 'vitest',
        timestamp: new Date().toISOString(),
        fresh: true,
        details: '10 tests passed',
        relatedRequirements: ['req-1'],
      });
      expect(engine.getState()!.verificationEvidence).toHaveLength(1);
    });
  });

  describe('getNextPhase', () => {
    it('returns null when no workflow', () => {
      const engine = createWorkflowEngine();
      expect(engine.getNextPhase()).toBeNull();
    });

    it('returns specify from idle', () => {
      const engine = createWorkflowEngine();
      engine.startWorkflow('c1');
      expect(engine.getNextPhase()).toBe('specify');
    });

    it('skips disabled phases', () => {
      const engine = createWorkflowEngine({
        config: { enabledPhases: ['idle', 'plan', 'tasks', 'implement', 'verify', 'complete'] },
      });
      engine.startWorkflow('c1');
      expect(engine.getNextPhase()).toBe('plan');
    });
  });

  describe('runChecklist', () => {
    it('returns null for unknown checklist', () => {
      const engine = createWorkflowEngine();
      engine.startWorkflow('c1');
      expect(engine.runChecklist('nonexistent', '')).toBeNull();
    });

    it('evaluates built-in checklist and stores result', () => {
      const engine = createWorkflowEngine();
      engine.startWorkflow('c1');
      const result = engine.runChecklist('spec-completeness', '# Requirements\nThe user wants...');
      expect(result).not.toBeNull();
      expect(result!.checklistId).toBe('spec-completeness');
      expect(engine.getState()!.checklistResults['spec-completeness']).toBeDefined();
    });
  });
});
