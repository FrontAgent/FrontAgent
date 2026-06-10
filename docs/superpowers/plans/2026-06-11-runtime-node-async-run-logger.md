# Async Run Logger (Issue #276) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop `FileRunLogger` from blocking the Node event loop by replacing per-entry `appendFileSync` calls with a single append-mode `fs.createWriteStream` per run.

**Architecture:** `packages/runtime-node/src/run-logger.ts` keeps the exact same public `RunLogger` interface (`path`, `console`, `event`, `result`, `error`, `close` — all synchronous signatures). Internally, `FileRunLogger` opens one `WriteStream` with `flags: 'a'` in its constructor, pushes every entry through `stream.write()` (non-blocking; the stream buffers and flushes on the libuv thread pool), and `close()` ends the stream with the final `closed` marker so all buffered entries flush in order. Stream `error` events disable further logging instead of crashing the agent run. Callers (`runFrontAgentTask`, `planFrontAgentTask` in `run.ts`) are untouched.

**Tech Stack:** Node `fs.createWriteStream`, TypeScript, Vitest.

**GitNexus blast radius (recorded before editing):** `gitnexus_impact` on `FileRunLogger` and `createRunLogger` returns **HIGH** risk — direct callers `runFrontAgentTask` and `planFrontAgentTask` (`packages/runtime-node/src/run.ts`), re-export via `packages/runtime-node/src/index.ts`, indirect impact on `createFrontAgentMcpServer` / `startFrontAgentMcpServer` flows. Mitigation: the `RunLogger` interface and entry format are preserved byte-for-byte; only the write mechanism changes. Pending stream writes hold the event loop open, so the CLI's natural exit still flushes the log (no `process.exit` calls exist in `apps/cli/src`).

**Out of scope:** `apps/cli/src/run-logger.ts` is a legacy copy imported only by its own test file (no production import). Issue #276 targets `packages/runtime-node` only; do not touch the CLI copy.

---

### Task 1: Behavior tests for FileRunLogger file output

**Files:**
- Modify: `packages/runtime-node/src/run-logger.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/runtime-node/src/run-logger.test.ts`. Update the imports at the top of the file:

```ts
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { AgentEvent } from '@frontagent/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRunLogger, redactForLog, resolveRunLogPath } from './run-logger.js';
```

Append this suite at the end of the file:

```ts
describe('createRunLogger (file logger)', () => {
  const tempDirs: string[] = [];

  function makeLogger() {
    const dir = mkdtempSync(join(tmpdir(), 'frontagent-runlog-'));
    tempDirs.push(dir);
    const logger = createRunLogger({
      projectRoot: dir,
      enabled: true,
      logFile: 'run.log',
      task: 'test task',
      provider: 'test-provider',
      model: 'test-model',
      options: {},
    });
    if (!logger) throw new Error('expected logger');
    return logger;
  }

  async function readWhenClosed(path: string): Promise<string> {
    await vi.waitFor(() => {
      expect(readFileSync(path, 'utf8')).toContain('closed');
    });
    return readFileSync(path, 'utf8');
  }

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns null when disabled', () => {
    expect(
      createRunLogger({
        projectRoot: '/tmp',
        enabled: false,
        task: 't',
        provider: 'p',
        model: 'm',
        options: {},
      }),
    ).toBeNull();
  });

  it('flushes header, entries, and close marker to the log file in order', async () => {
    const logger = makeLogger();
    logger.event({ type: 'stream_token', stepId: 's1', token: 'hello' } as AgentEvent);
    logger.console('warn', ['warned', { apiKey: 'sk-secret' }]);
    logger.result({ success: true } as never);
    logger.error(new Error('boom'));
    logger.close();

    const content = await readWhenClosed(logger.path);
    expect(content).toContain('# FrontAgent Run Log');
    expect(content).toContain('event.stream_token');
    expect(content).toContain('"tokenLength": 5');
    expect(content).toContain('console.warn');
    expect(content).toContain('[REDACTED]');
    expect(content).not.toContain('sk-secret');
    expect(content).toContain('result');
    expect(content).toContain('boom');
    expect(content.indexOf('# FrontAgent Run Log')).toBeLessThan(content.indexOf('event.stream_token'));
    expect(content.indexOf('event.stream_token')).toBeLessThan(content.indexOf('console.warn'));
    expect(content.trimEnd().endsWith('closed')).toBe(true);
  });

  it('ignores writes after close and is idempotent on close', async () => {
    const logger = makeLogger();
    logger.event({ type: 'status_update', label: 'before' } as AgentEvent);
    logger.close();
    logger.close();
    logger.event({ type: 'status_update', label: 'after-close' } as AgentEvent);
    logger.console('log', ['after-close-console']);

    const content = await readWhenClosed(logger.path);
    expect(content).toContain('before');
    expect(content).not.toContain('after-close');
    expect(content.match(/closed/g)).toHaveLength(1);
  });

  it('appends to an existing file instead of truncating', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'frontagent-runlog-'));
    tempDirs.push(dir);
    const path = resolve(dir, 'run.log');
    const first = createRunLogger({
      projectRoot: dir,
      enabled: true,
      logFile: 'run.log',
      task: 'first',
      provider: 'p',
      model: 'm',
      options: {},
    });
    if (!first) throw new Error('expected logger');
    first.close();
    await vi.waitFor(() => {
      expect(readFileSync(path, 'utf8')).toContain('closed');
    });

    const second = createRunLogger({
      projectRoot: dir,
      enabled: true,
      logFile: 'run.log',
      task: 'second',
      provider: 'p',
      model: 'm',
      options: {},
    });
    if (!second) throw new Error('expected logger');
    second.close();
    await vi.waitFor(() => {
      expect((readFileSync(path, 'utf8').match(/closed/g) ?? []).length).toBe(2);
    });

    const content = readFileSync(path, 'utf8');
    expect(content).toContain('task: first');
    expect(content).toContain('task: second');
  });
});
```

Note on `task: first` / `task: second`: the header is `stringify(header)` of an object containing `task`, which JSON-stringifies as `"task": "first"`. Use these assertions instead:

```ts
    expect(content).toContain('"task": "first"');
    expect(content).toContain('"task": "second"');
```

- [ ] **Step 2: Run tests — new ordering/append tests must pass against current sync implementation too (they assert behavior, not mechanism), so verify they pass, then proceed; the refactor in Task 2 must keep them green**

Run: `pnpm vitest run packages/runtime-node/src/run-logger.test.ts`
Expected: PASS (these tests pin the existing observable contract before the internal change).

- [ ] **Step 3: Commit**

```bash
git add packages/runtime-node/src/run-logger.test.ts
git commit -m "test(runtime-node): pin FileRunLogger file output contract before async refactor"
```

### Task 2: Replace appendFileSync with a single append-mode WriteStream

**Files:**
- Modify: `packages/runtime-node/src/run-logger.ts`

- [ ] **Step 1: Update imports**

Replace line 2:

```ts
import { appendFileSync, mkdirSync } from 'node:fs';
```

with:

```ts
import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs';
```

- [ ] **Step 2: Rewrite FileRunLogger to write through one stream**

Replace the whole `FileRunLogger` class (lines 119–162) with:

```ts
class FileRunLogger implements RunLogger {
  private closed = false;
  private readonly stream: WriteStream;

  constructor(
    readonly path: string,
    header: Record<string, unknown>,
  ) {
    mkdirSync(dirname(path), { recursive: true });
    this.stream = createWriteStream(path, { flags: 'a', encoding: 'utf8' });
    // Disk failures (ENOSPC, EACCES, ...) must not crash the agent run; an
    // unhandled 'error' event on the stream would. Disable further logging instead.
    this.stream.on('error', () => {
      this.closed = true;
    });
    this.stream.write(
      ['# FrontAgent Run Log', `startedAt: ${timestampForLine()}`, stringify(header), ''].join(
        '\n',
      ),
    );
  }

  private write(kind: string, payload: unknown): void {
    if (this.closed) return;
    this.stream.write(`[${timestampForLine()}] ${kind}\n${stringify(payload)}\n\n`);
  }

  console(level: 'log' | 'warn' | 'error', args: unknown[]): void {
    this.write(`console.${level}`, formatConsoleArgs(args));
  }

  event(event: AgentEvent): void {
    this.write(`event.${event.type}`, summarizeEvent(event));
  }

  result(result: AgentExecutionResult): void {
    this.write('result', result);
  }

  error(error: unknown): void {
    this.write('error', error);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    // end() writes the final marker after all buffered entries, preserving
    // order, then closes the fd. Pending writes keep the event loop alive,
    // so a normal CLI exit still flushes the full log.
    this.stream.end(`[${timestampForLine()}] closed\n`);
  }
}
```

- [ ] **Step 3: Run the focused tests**

Run: `pnpm vitest run packages/runtime-node/src/run-logger.test.ts`
Expected: PASS (all redaction, path, and new file-logger tests).

- [ ] **Step 4: Run the package tests and type check**

Run: `pnpm vitest run packages/runtime-node && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/runtime-node/src/run-logger.ts
git commit -m "perf(runtime-node): write run log through async WriteStream instead of appendFileSync"
```

### Task 3: Optional benchmark evidence for the PR (not committed)

- [ ] **Step 1: Run an ad-hoc latency comparison**

Write `/tmp/runlog-bench.mjs` (do NOT commit):

```js
import { appendFileSync, createWriteStream, rmSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

const N = 5000;
const entry = `[2026-06-11T00:00:00.000Z] event.stream_token\n${JSON.stringify({ type: 'stream_token', stepId: 's1', tokenLength: 4 }, null, 2)}\n\n`;

function pctl(samples, p) {
  const s = [...samples].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

// sync
{
  const path = '/tmp/bench-sync.log';
  rmSync(path, { force: true });
  const samples = [];
  const t0 = performance.now();
  for (let i = 0; i < N; i++) {
    const a = performance.now();
    appendFileSync(path, entry, 'utf8');
    samples.push(performance.now() - a);
  }
  const total = performance.now() - t0;
  console.log(`appendFileSync: total=${total.toFixed(1)}ms p50=${pctl(samples, 50).toFixed(3)}ms p99=${pctl(samples, 99).toFixed(3)}ms max=${Math.max(...samples).toFixed(3)}ms (per-call event-loop block)`);
}

// stream
{
  const path = '/tmp/bench-stream.log';
  rmSync(path, { force: true });
  const stream = createWriteStream(path, { flags: 'a', encoding: 'utf8' });
  const samples = [];
  const t0 = performance.now();
  for (let i = 0; i < N; i++) {
    const a = performance.now();
    stream.write(entry);
    samples.push(performance.now() - a);
  }
  const submitted = performance.now() - t0;
  await new Promise((r) => stream.end(r));
  const total = performance.now() - t0;
  console.log(`WriteStream: submit=${submitted.toFixed(1)}ms flushTotal=${total.toFixed(1)}ms p50=${pctl(samples, 50).toFixed(3)}ms p99=${pctl(samples, 99).toFixed(3)}ms max=${Math.max(...samples).toFixed(3)}ms (per-call event-loop block)`);
}
```

Run: `node /tmp/runlog-bench.mjs`
Record the output for the PR description.

### Task 4: Gates and PR

- [ ] **Step 1: Run precommit gate**

Run: `pnpm quality:precommit`
Expected: PASS.

- [ ] **Step 2: GitNexus detect_changes**

Run `gitnexus_detect_changes()` and confirm only `run-logger.ts` symbols (`FileRunLogger`, its methods) and the test file are affected; affected flows limited to `runFrontAgentTask` / `planFrontAgentTask` logging paths.

- [ ] **Step 3: Open PR to develop**

Use the repo PR template, reference `Closes #276`, include the GitNexus impact summary (HIGH risk, interface preserved) and the benchmark numbers from Task 3.
