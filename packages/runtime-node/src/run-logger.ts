import { randomUUID } from 'node:crypto';
import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { inspect } from 'node:util';
import type { AgentEvent, AgentExecutionResult } from '@frontagent/core';

const SECRET_KEY_PATTERN = /(api[-_]?key|token|authorization|password|secret|credential)/i;

export interface RunLoggerOptions {
  projectRoot: string;
  enabled: boolean;
  logFile?: string;
  task: string;
  provider: string;
  model: string;
  baseURL?: string;
  options: Record<string, unknown>;
  /** Cap on bytes queued in the write stream before entries are dropped (default 4 MB). */
  maxBufferedBytes?: number;
}

export interface RunLogger {
  path: string;
  console(level: 'log' | 'warn' | 'error', args: unknown[]): void;
  event(event: AgentEvent): void;
  result(result: AgentExecutionResult): void;
  error(error: unknown): void;
  /** Resolves once all buffered entries and the final marker are flushed to disk. */
  close(): Promise<void>;
}

/** Default cap on bytes queued in the run-log write stream. */
const DEFAULT_MAX_BUFFERED_LOG_BYTES = 4 * 1024 * 1024;

function timestampForPath(date = new Date()): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function timestampForLine(date = new Date()): string {
  return date.toISOString();
}

export function resolveRunLogPath(projectRoot: string, logFile?: string): string {
  if (logFile) {
    return resolve(projectRoot, logFile);
  }

  const runId = randomUUID().slice(0, 8);
  return resolve(projectRoot, '.frontagent', 'runs', `${timestampForPath()}-${runId}.log`);
}

function redactString(input: string): string {
  return input
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[REDACTED]')
    .replace(/(--(?:api-key|token|password|secret)(?:=|\s+))\S+/gi, '$1[REDACTED]')
    .replace(
      /((?:api[-_]?key|token|authorization|password|secret)\s*[:=]\s*)["']?[^"',\s}]+["']?/gi,
      '$1[REDACTED]',
    );
}

function redactValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') {
    return redactString(value);
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      stack: value.stack ? redactString(value.stack) : undefined,
    };
  }

  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, seen));
  }

  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    output[key] = SECRET_KEY_PATTERN.test(key) ? '[REDACTED]' : redactValue(child, seen);
  }
  return output;
}

export function redactForLog(value: unknown): unknown {
  return redactValue(value);
}

function stringify(value: unknown): string {
  const redacted = redactValue(value);
  if (typeof redacted === 'string') return redacted;

  try {
    return JSON.stringify(redacted, null, 2);
  } catch {
    return inspect(redacted, { depth: 6, colors: false, breakLength: 120 });
  }
}

function formatConsoleArgs(args: unknown[]): string {
  return args.map((arg) => stringify(arg)).join(' ');
}

function summarizeEvent(event: AgentEvent): unknown {
  if (event.type === 'stream_token') {
    return { type: event.type, stepId: event.stepId, tokenLength: event.token.length };
  }

  return event;
}

class FileRunLogger implements RunLogger {
  private closed = false;
  private droppedEntries = 0;
  private closePromise?: Promise<void>;
  private readonly stream: WriteStream;

  constructor(
    readonly path: string,
    header: Record<string, unknown>,
    private readonly maxBufferedBytes: number = DEFAULT_MAX_BUFFERED_LOG_BYTES,
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

  /**
   * Droppable entries are discarded instead of queued once the stream buffers
   * more than maxBufferedBytes, so a producer that outruns the disk (e.g.
   * high-frequency stream_token events on a slow mount) cannot grow memory
   * without bound. Only low-value high-frequency entries are droppable —
   * terminal diagnostics (result, error, console.error, non-stream events)
   * are always written. Dropped entries are surfaced as a summary line once
   * the buffer recovers or the logger closes.
   */
  private write(kind: string, payload: unknown, droppable = false): void {
    if (this.closed) return;
    if (droppable && this.stream.writableLength > this.maxBufferedBytes) {
      this.droppedEntries += 1;
      return;
    }
    this.writeDroppedSummary();
    this.stream.write(`[${timestampForLine()}] ${kind}\n${stringify(payload)}\n\n`);
  }

  private writeDroppedSummary(): void {
    if (this.droppedEntries === 0) return;
    this.stream.write(
      `[${timestampForLine()}] dropped ${this.droppedEntries} log entries while the write buffer was saturated\n\n`,
    );
    this.droppedEntries = 0;
  }

  console(level: 'log' | 'warn' | 'error', args: unknown[]): void {
    this.write(`console.${level}`, formatConsoleArgs(args), level !== 'error');
  }

  event(event: AgentEvent): void {
    this.write(`event.${event.type}`, summarizeEvent(event), event.type === 'stream_token');
  }

  result(result: AgentExecutionResult): void {
    this.write('result', result);
  }

  error(error: unknown): void {
    this.write('error', error);
  }

  close(): Promise<void> {
    // Every close() call must resolve only once the log is flushed, so
    // repeated calls during the flush share the first call's promise.
    if (this.closePromise) return this.closePromise;
    // closed without a closePromise means the stream errored and was
    // auto-destroyed; there is nothing left to flush.
    if (this.closed) return Promise.resolve();
    this.closed = true;
    this.writeDroppedSummary();
    // end() writes the final marker after all buffered entries, preserving
    // order, then closes the fd. The promise resolves on 'close' (also
    // emitted when the stream is destroyed by an error), so callers can
    // await the flush before reading or publishing the log file.
    this.closePromise = new Promise((resolve) => {
      this.stream.once('close', () => resolve());
      this.stream.end(`[${timestampForLine()}] closed\n`);
    });
    return this.closePromise;
  }
}

export function createRunLogger(options: RunLoggerOptions): RunLogger | null {
  if (!options.enabled) return null;

  const path = resolveRunLogPath(options.projectRoot, options.logFile);
  return new FileRunLogger(
    path,
    {
      task: options.task,
      projectRoot: options.projectRoot,
      provider: options.provider,
      model: options.model,
      baseURL: options.baseURL ?? '(default)',
      options: options.options,
    },
    options.maxBufferedBytes,
  );
}

export function installRunConsoleFilter(debug: boolean, logger: RunLogger | null): () => void {
  const original = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };
  const hiddenPrefixes = [
    '[Agent]',
    '[Executor]',
    '[LLM]',
    '[LLMService]',
    '[MemoryStore]',
    'LLM plan generation failed',
  ];

  const shouldHide = (args: unknown[]) => {
    const first = args[0];
    return typeof first === 'string' && hiddenPrefixes.some((prefix) => first.startsWith(prefix));
  };

  console.log = (...args: unknown[]) => {
    logger?.console('log', args);
    if (debug || !shouldHide(args)) original.log(...args);
  };
  console.warn = (...args: unknown[]) => {
    logger?.console('warn', args);
    if (debug || !shouldHide(args)) original.warn(...args);
  };
  console.error = (...args: unknown[]) => {
    logger?.console('error', args);
    if (debug || !shouldHide(args)) original.error(...args);
  };

  return () => {
    console.log = original.log;
    console.warn = original.warn;
    console.error = original.error;
  };
}
