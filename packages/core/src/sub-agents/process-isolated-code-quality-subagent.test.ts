import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { A2ARequest } from '../a2a.js';
import { A2A_PROTOCOL_NAME, A2A_PROTOCOL_VERSION } from '../a2a.js';
import type { LLMConfig } from '../types.js';
import type { CodeQualityReviewRequest } from './code-quality-subagent.js';
import { ProcessIsolatedCodeQualitySubAgent } from './process-isolated-code-quality-subagent.js';

const tempDir = mkdtempSync(join(tmpdir(), 'fa-quality-worker-'));

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function writeFakeWorker(name: string, script: string): string {
  const workerPath = join(tempDir, name);
  writeFileSync(workerPath, script, 'utf-8');
  return workerPath;
}

function buildRequest(): A2ARequest<CodeQualityReviewRequest> {
  return {
    protocol: A2A_PROTOCOL_NAME,
    version: A2A_PROTOCOL_VERSION,
    kind: 'request',
    messageId: 'a2a-req-test',
    timestamp: Date.now(),
    from: 'frontagent.main',
    to: 'subagent.code-quality',
    intent: 'code_quality.review_generated_files',
    payload: { taskId: 'task-1', phase: 'implementation', files: [] },
  };
}

const llmConfig: LLMConfig = {
  provider: 'openai',
  apiKey: 'test-key',
  model: 'test-model',
};

function buildAgent(workerPath: string, maxOutputBytes: number) {
  return new ProcessIsolatedCodeQualitySubAgent({
    llmConfig,
    workerPath,
    maxOutputBytes,
    timeoutMs: 10_000,
  });
}

describe('ProcessIsolatedCodeQualitySubAgent output capping', () => {
  it('kills the worker and fails when stdout exceeds the cap', async () => {
    const workerPath = writeFakeWorker(
      'stdout-flood.cjs',
      `const chunk = 'x'.repeat(1024);
       setInterval(() => process.stdout.write(chunk), 1);`,
    );
    const agent = buildAgent(workerPath, 4096);

    const response = await agent.handleRequest(buildRequest());

    expect(response.success).toBe(false);
    expect(response.error).toMatch(/stdout exceeded 4096 bytes/);
    expect(response.error).toMatch(/Output tail:/);
  }, 15_000);

  it('kills the worker and fails when stderr exceeds the cap', async () => {
    const workerPath = writeFakeWorker(
      'stderr-flood.cjs',
      `const chunk = 'y'.repeat(1024);
       setInterval(() => process.stderr.write(chunk), 1);`,
    );
    const agent = buildAgent(workerPath, 4096);

    const response = await agent.handleRequest(buildRequest());

    expect(response.success).toBe(false);
    expect(response.error).toMatch(/stderr exceeded 4096 bytes/);
    expect(response.error).toMatch(/Output tail:/);
  }, 15_000);

  it('still parses a valid worker response under the cap', async () => {
    const workerPath = writeFakeWorker(
      'ok-worker.cjs',
      `let raw = '';
       process.stdin.setEncoding('utf-8');
       process.stdin.on('data', (c) => { raw += c; });
       process.stdin.on('end', () => {
         const input = JSON.parse(raw);
         process.stdout.write(JSON.stringify({
           protocol: input.request.protocol,
           version: input.request.version,
           kind: 'response',
           messageId: 'a2a-res-test',
           inReplyTo: input.request.messageId,
           timestamp: Date.now(),
           from: 'subagent.code-quality',
           to: input.request.from,
           intent: input.request.intent,
           success: true,
           payload: { passed: true, score: 100, issues: [], summary: 'ok' },
         }));
       });`,
    );
    const agent = buildAgent(workerPath, 64 * 1024);

    const response = await agent.handleRequest(buildRequest());

    expect(response.success).toBe(true);
  }, 15_000);
});
