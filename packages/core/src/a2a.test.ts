import { describe, expect, it } from 'vitest';
import {
  A2A_PROTOCOL_NAME,
  A2A_PROTOCOL_VERSION,
  type A2AAgent,
  type A2ARequest,
  type A2AResponse,
  InMemoryA2ABus,
} from './a2a.js';

function createMockAgent(
  agentId: string,
  capabilities: string[],
  handler?: (req: A2ARequest) => Promise<A2AResponse>,
): A2AAgent {
  return {
    agentId,
    capabilities,
    handleRequest:
      handler ??
      (async (req) => ({
        protocol: A2A_PROTOCOL_NAME,
        version: A2A_PROTOCOL_VERSION,
        kind: 'response' as const,
        messageId: 'mock-res-1',
        inReplyTo: req.messageId,
        timestamp: Date.now(),
        from: agentId,
        to: req.from,
        intent: req.intent,
        success: true,
        payload: { echo: req.payload },
      })),
  };
}

describe('InMemoryA2ABus', () => {
  describe('registerAgent', () => {
    it('registers an agent', () => {
      const bus = new InMemoryA2ABus();
      const agent = createMockAgent('worker-1', ['analyze']);
      bus.registerAgent(agent);
      expect(bus.hasAgent('worker-1')).toBe(true);
    });

    it('throws on duplicate registration', () => {
      const bus = new InMemoryA2ABus();
      const agent = createMockAgent('worker-1', ['analyze']);
      bus.registerAgent(agent);
      expect(() => bus.registerAgent(agent)).toThrow('already registered');
    });
  });

  describe('hasAgent', () => {
    it('returns false for unregistered agent', () => {
      const bus = new InMemoryA2ABus();
      expect(bus.hasAgent('nonexistent')).toBe(false);
    });
  });

  describe('request', () => {
    it('routes request to target agent and returns response', async () => {
      const bus = new InMemoryA2ABus();
      bus.registerAgent(createMockAgent('worker', ['analyze']));

      const response = await bus.request({
        from: 'main',
        to: 'worker',
        intent: 'analyze',
        payload: { file: 'index.ts' },
      });

      expect(response.success).toBe(true);
      expect(response.inReplyTo).toBeTruthy();
      expect(response.intent).toBe('analyze');
      expect(response.payload).toEqual({ echo: { file: 'index.ts' } });
    });

    it('returns error when target agent not found', async () => {
      const bus = new InMemoryA2ABus();

      const response = await bus.request({
        from: 'main',
        to: 'missing',
        intent: 'analyze',
        payload: {},
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('target not found');
    });

    it('returns error when intent is not supported', async () => {
      const bus = new InMemoryA2ABus();
      bus.registerAgent(createMockAgent('worker', ['analyze']));

      const response = await bus.request({
        from: 'main',
        to: 'worker',
        intent: 'unsupported_action',
        payload: {},
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('does not support intent');
    });

    it('returns error when handler throws', async () => {
      const bus = new InMemoryA2ABus();
      bus.registerAgent(
        createMockAgent('crasher', ['boom'], async () => {
          throw new Error('handler exploded');
        }),
      );

      const response = await bus.request({
        from: 'main',
        to: 'crasher',
        intent: 'boom',
        payload: {},
      });

      expect(response.success).toBe(false);
      expect(response.error).toBe('handler exploded');
    });

    it('sets correct protocol fields on response', async () => {
      const bus = new InMemoryA2ABus();
      bus.registerAgent(createMockAgent('worker', ['ping']));

      const response = await bus.request({
        from: 'main',
        to: 'worker',
        intent: 'ping',
        payload: null,
      });

      expect(response.protocol).toBe(A2A_PROTOCOL_NAME);
      expect(response.version).toBe(A2A_PROTOCOL_VERSION);
      expect(response.kind).toBe('response');
      expect(response.from).toBe('worker');
      expect(response.to).toBe('main');
    });
  });
});
