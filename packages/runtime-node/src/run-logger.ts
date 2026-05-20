import { randomUUID } from 'node:crypto';
import { appendFileSync, mkdirSync } from 'node:fs';
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
}

export interface RunLogger {
  path: string;
  console(level: 'log' | 'warn' | 'error', args: unknown[]): void;
  event(event: AgentEvent): void;
  result(result: AgentExecutionResult): void;
  error(error: unknown): void;
  close(): void;
}

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

  constructor(
    readonly path: string,
    header: Record<string, unknown>,
  ) {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(
      this.path,
      ['# FrontAgent Run Log', `startedAt: ${timestampForLine()}`, stringify(header), ''].join(
        '\n',
      ),
      'utf8',
    );
  }

  private write(kind: string, payload: unknown): void {
    if (this.closed) return;
    appendFileSync(this.path, `[${timestampForLine()}] ${kind}\n${stringify(payload)}\n\n`, 'utf8');
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
    appendFileSync(this.path, `[${timestampForLine()}] closed\n`, 'utf8');
    this.closed = true;
  }
}

export function createRunLogger(options: RunLoggerOptions): RunLogger | null {
  if (!options.enabled) return null;

  const path = resolveRunLogPath(options.projectRoot, options.logFile);
  return new FileRunLogger(path, {
    task: options.task,
    projectRoot: options.projectRoot,
    provider: options.provider,
    model: options.model,
    baseURL: options.baseURL ?? '(default)',
    options: options.options,
  });
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
