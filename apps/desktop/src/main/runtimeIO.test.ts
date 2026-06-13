import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFileSettingsIO } from './runtimeIO.js';

describe('createFileSettingsIO', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'fa-settings-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns null when the file does not exist', () => {
    const io = createFileSettingsIO(join(dir, 'missing', 'settings.json'));
    expect(io.read()).toBeNull();
  });

  it('round-trips contents and creates the parent directory', () => {
    const path = join(dir, 'nested', 'settings.json');
    const io = createFileSettingsIO(path);
    io.write('{"provider":"anthropic"}');
    expect(io.read()).toBe('{"provider":"anthropic"}');
    // The parent dir was created on write.
    expect(readFileSync(path, 'utf8')).toContain('anthropic');
  });

  it('reads contents written out of band', () => {
    const path = join(dir, 'settings.json');
    writeFileSync(path, 'raw', 'utf8');
    expect(createFileSettingsIO(path).read()).toBe('raw');
  });
});
