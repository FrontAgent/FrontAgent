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
          stream.pause();
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
