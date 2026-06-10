# Core Quality Worker Output Cap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cap buffered stdout/stderr in `ProcessIsolatedCodeQualitySubAgent` and stdin accumulation in the code-quality worker so a runaway child process cannot grow parent memory without bound (Issue #278).

**Architecture:** Add a small shared module `worker-io-limits.ts` in `packages/core/src/sub-agents/` exposing a `BoundedStreamBuffer` (byte-capped accumulator that keeps a truncated tail when the cap is exceeded) and a `readStreamWithLimit` helper (byte-capped stream-to-string reader). The parent bridge uses `BoundedStreamBuffer` for the child's stdout/stderr and kills the child with a structured error on overflow; the worker uses `readStreamWithLimit` for stdin so an oversized payload produces a structured JSON error response instead of unbounded growth.

**Tech Stack:** TypeScript, Node.js `child_process`/streams, Vitest.

**Test coverage requirement (repo-guard):** Tests must cover all three overflow directions: parent stdout, parent stderr, and worker stdin.

---

### Task 1: `worker-io-limits.ts` — BoundedStreamBuffer + readStreamWithLimit

**Files:**
- Create: `packages/core/src/sub-agents/worker-io-limits.ts`
- Test: `packages/core/src/sub-agents/worker-io-limits.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// packages/core/src/sub-agents/worker-io-limits.test.ts
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import {
  BoundedStreamBuffer,
  DEFAULT_MAX_WORKER_IO_BYTES,
  readStreamWithLimit,
} from './worker-io-limits.js';

describe('BoundedStreamBuffer', () => {
  it('accumulates chunks below the limit', () => {
    const buffer = new BoundedStreamBuffer(1024);
    expect(buffer.append('hello ')).toBe(true);
    expect(buffer.append(Buffer.from('world'))).toBe(true);
    expect(buffer.text).toBe('hello world');
    expect(buffer.exceeded).toBe(false);
  });

  it('marks exceeded and keeps only the tail once the byte limit is crossed', () => {
    const buffer = new BoundedStreamBuffer(16, 8);
    expect(buffer.append('a'.repeat(12))).toBe(true);
    expect(buffer.append('b'.repeat(12))).toBe(false);
    expect(buffer.exceeded).toBe(true);
    // Tail keeps only the last `tailChars` characters.
    expect(buffer.text).toBe('bbbbbbbb');
  });

  it('ignores appends after the limit was exceeded', () => {
    const buffer = new BoundedStreamBuffer(4, 4);
    expect(buffer.append('abcdef')).toBe(false);
    expect(buffer.append('ghij')).toBe(false);
    expect(buffer.text).toBe('cdef');
  });

  it('counts multi-byte characters by byte length, not string length', () => {
    const buffer = new BoundedStreamBuffer(5, 8);
    // '你好' is 6 bytes in UTF-8 but 2 chars.
    expect(buffer.append('你好')).toBe(false);
    expect(buffer.exceeded).toBe(true);
  });

  it('exposes a default 4 MB limit constant', () => {
    expect(DEFAULT_MAX_WORKER_IO_BYTES).toBe(4 * 1024 * 1024);
  });
});

describe('readStreamWithLimit', () => {
  it('resolves with the full text when under the limit', async () => {
    const stream = new PassThrough();
    const promise = readStreamWithLimit(stream, 1024);
    stream.write('{"ok":');
    stream.write('true}');
    stream.end();
    await expect(promise).resolves.toBe('{"ok":true}');
  });

  it('rejects when input exceeds the byte limit (worker stdin direction)', async () => {
    const stream = new PassThrough();
    const promise = readStreamWithLimit(stream, 16);
    stream.write('x'.repeat(32));
    await expect(promise).rejects.toThrow(/exceeded 16 bytes/);
  });

  it('rejects on stream error', async () => {
    const stream = new PassThrough();
    const promise = readStreamWithLimit(stream, 1024);
    stream.destroy(new Error('boom'));
    await expect(promise).rejects.toThrow('boom');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run packages/core/src/sub-agents/worker-io-limits.test.ts`
Expected: FAIL (module `./worker-io-limits.js` not found)

- [ ] **Step 3: Write the implementation**

```ts
// packages/core/src/sub-agents/worker-io-limits.ts
/**
 * Byte-capped buffering helpers shared by the process-isolated
 * code-quality bridge (child stdout/stderr) and its worker (stdin).
 * Prevents a noisy or runaway peer from growing memory without bound.
 */

/** Default cap (4 MB) for buffered worker I/O in either direction. */
export const DEFAULT_MAX_WORKER_IO_BYTES = 4 * 1024 * 1024;

/** How many characters of output tail to keep for error reporting. */
export const DEFAULT_TAIL_CHARS = 2048;

/**
 * Accumulates stream chunks up to a byte limit. Once the limit is
 * exceeded, only the last `tailChars` characters are retained (for
 * diagnostics) and further appends are ignored.
 */
export class BoundedStreamBuffer {
  private buffered = '';
  private bytes = 0;
  private limitExceeded = false;

  constructor(
    private readonly maxBytes: number = DEFAULT_MAX_WORKER_IO_BYTES,
    private readonly tailChars: number = DEFAULT_TAIL_CHARS,
  ) {}

  /** Appends a chunk. Returns false once the byte limit is exceeded. */
  append(chunk: Buffer | string): boolean {
    if (this.limitExceeded) return false;

    const text = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
    this.bytes += Buffer.byteLength(text, 'utf-8');
    this.buffered += text;

    if (this.bytes > this.maxBytes) {
      this.limitExceeded = true;
      this.buffered = this.buffered.slice(-this.tailChars);
      return false;
    }
    return true;
  }

  get exceeded(): boolean {
    return this.limitExceeded;
  }

  get text(): string {
    return this.buffered;
  }

  /** Last `chars` characters of the buffered text (for error messages). */
  tail(chars: number = this.tailChars): string {
    return this.buffered.slice(-chars);
  }
}

/**
 * Reads a stream to string, rejecting once more than `maxBytes` bytes
 * arrive. Used by the worker to cap stdin accumulation.
 */
export async function readStreamWithLimit(
  stream: NodeJS.ReadableStream,
  maxBytes: number = DEFAULT_MAX_WORKER_IO_BYTES,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let raw = '';
    let bytes = 0;
    let settled = false;

    const settle = (action: () => void) => {
      if (settled) return;
      settled = true;
      stream.removeListener('data', onData);
      stream.removeListener('end', onEnd);
      stream.removeListener('error', onError);
      action();
    };

    const onData = (chunk: Buffer | string) => {
      const text = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
      bytes += Buffer.byteLength(text, 'utf-8');
      if (bytes > maxBytes) {
        settle(() => {
          if (typeof (stream as { pause?: () => void }).pause === 'function') {
            (stream as unknown as { pause: () => void }).pause();
          }
          reject(new Error(`Worker stdin exceeded ${maxBytes} bytes; aborting read`));
        });
        return;
      }
      raw += text;
    };

    const onEnd = () => settle(() => resolve(raw));
    const onError = (error: Error) => settle(() => reject(error));

    stream.setEncoding('utf-8');
    stream.on('data', onData);
    stream.on('end', onEnd);
    stream.on('error', onError);
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run packages/core/src/sub-agents/worker-io-limits.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/sub-agents/worker-io-limits.ts packages/core/src/sub-agents/worker-io-limits.test.ts
git commit -m "feat(core): add byte-capped buffering helpers for worker I/O"
```

---

### Task 2: Cap stdout/stderr in `ProcessIsolatedCodeQualitySubAgent`

**Files:**
- Modify: `packages/core/src/sub-agents/process-isolated-code-quality-subagent.ts`
- Test: `packages/core/src/sub-agents/process-isolated-code-quality-subagent.test.ts` (create)

- [ ] **Step 1: Write the failing integration tests**

The bridge already supports `workerPath`, so tests spawn tiny fake worker scripts written to a temp dir. Use a small `maxOutputBytes` so tests stay fast.

```ts
// packages/core/src/sub-agents/process-isolated-code-quality-subagent.test.ts
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
           payload: { passed: true, issues: [], summary: 'ok' },
         }));
       });`,
    );
    const agent = buildAgent(workerPath, 64 * 1024);

    const response = await agent.handleRequest(buildRequest());

    expect(response.success).toBe(true);
  }, 15_000);
});
```

- [ ] **Step 2: Run tests to verify the overflow tests fail**

Run: `pnpm vitest run packages/core/src/sub-agents/process-isolated-code-quality-subagent.test.ts`
Expected: the two overflow tests FAIL (no cap yet — they hit the 10s timeout error instead of the cap error); the valid-response test PASSES.

- [ ] **Step 3: Implement the cap in the bridge**

In `packages/core/src/sub-agents/process-isolated-code-quality-subagent.ts`:

Add import:

```ts
import { BoundedStreamBuffer, DEFAULT_MAX_WORKER_IO_BYTES } from './worker-io-limits.js';
```

Add to `ProcessIsolatedCodeQualitySubAgentOptions`:

```ts
  /** Max bytes buffered from worker stdout/stderr each (default 4 MB). */
  maxOutputBytes?: number;
```

Add private field + constructor line:

```ts
  private readonly maxOutputBytes: number;
  // in constructor:
  this.maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_WORKER_IO_BYTES;
```

Replace the accumulation block (`let stdout = ''; let stderr = '';` and both `.on('data', ...)` handlers) with:

```ts
      const stdoutBuffer = new BoundedStreamBuffer(this.maxOutputBytes);
      const stderrBuffer = new BoundedStreamBuffer(this.maxOutputBytes);
```

```ts
      const failOnOutputOverflow = (streamName: 'stdout' | 'stderr', buffer: BoundedStreamBuffer) => {
        child.kill('SIGKILL');
        complete(
          this.errorResponse(
            request,
            `Code-quality worker ${streamName} exceeded ${this.maxOutputBytes} bytes; worker killed. Output tail: ${buffer.tail()}`,
          ),
        );
      };

      child.stdout.on('data', (chunk: Buffer) => {
        if (!stdoutBuffer.append(chunk)) {
          failOnOutputOverflow('stdout', stdoutBuffer);
        }
      });

      child.stderr.on('data', (chunk: Buffer) => {
        if (!stderrBuffer.append(chunk)) {
          failOnOutputOverflow('stderr', stderrBuffer);
        }
      });
```

In the `close` handler, replace `stdout` with `stdoutBuffer.text` and `stderr` with `stderrBuffer.text`:

```ts
      child.on('close', (code) => {
        if (settled) return;

        // Worker may still emit a structured error response even with non-zero exit code.
        const parsed = this.parseWorkerResponse(stdoutBuffer.text);
        if (parsed) {
          complete(parsed);
          return;
        }

        if (code !== 0) {
          const details = stderrBuffer.text.trim() || stdoutBuffer.text.trim() || 'Unknown worker error';
          complete(
            this.errorResponse(request, `Code-quality worker exited with code ${code}: ${details}`),
          );
          return;
        }

        const debugDetails = [stderrBuffer.text.trim(), stdoutBuffer.text.trim()]
          .filter(Boolean)
          .join('\n');
        complete(
          this.errorResponse(
            request,
            `Failed to parse code-quality worker response.${debugDetails ? ` Details: ${debugDetails}` : ''}`,
          ),
        );
      });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run packages/core/src/sub-agents/process-isolated-code-quality-subagent.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/sub-agents/process-isolated-code-quality-subagent.ts packages/core/src/sub-agents/process-isolated-code-quality-subagent.test.ts
git commit -m "fix(core): cap buffered worker stdout/stderr in process-isolated code-quality bridge"
```

---

### Task 3: Cap stdin accumulation in the worker

**Files:**
- Modify: `packages/core/src/sub-agents/code-quality-subagent-worker.ts`
- Test: covered by `readStreamWithLimit` unit tests in Task 1 (the worker delegates to it)

- [ ] **Step 1: Replace `readStdin` with the capped helper**

In `packages/core/src/sub-agents/code-quality-subagent-worker.ts`:

Add import:

```ts
import { DEFAULT_MAX_WORKER_IO_BYTES, readStreamWithLimit } from './worker-io-limits.js';
```

Delete the `readStdin` function (lines 36–46) and change the call in `main`:

```ts
    const raw = await readStreamWithLimit(process.stdin, DEFAULT_MAX_WORKER_IO_BYTES);
```

The existing `catch` in `main` already converts the rejection into a structured JSON error response on stdout with exit code 1, which the bridge parses — no further changes needed.

- [ ] **Step 2: Verify typecheck and full sub-agents tests**

Run: `pnpm vitest run packages/core/src/sub-agents/` and `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/sub-agents/code-quality-subagent-worker.ts
git commit -m "fix(core): cap stdin accumulation in code-quality worker"
```

---

### Task 4: Gates and PR

- [ ] **Step 1: Run precommit gate**

Run: `pnpm quality:precommit`
Expected: lint, typecheck, all tests, workflow tests PASS

- [ ] **Step 2: GitNexus detect_changes**

Run `gitnexus_detect_changes` and confirm affected symbols are confined to `packages/core/src/sub-agents/` (bridge, worker, new helpers module).

- [ ] **Step 3: Push and open PR**

PR to `develop`, title `fix(core): cap process-isolated code-quality worker I/O buffering`, body per repo PR template, `Closes #278`.
