import { describe, expect, it } from 'vitest';
import { defaultSettings, loadSettings, type SettingsIO, saveSettings } from './settingsStore.js';

function memoryIO(initial: string | null = null): SettingsIO & { contents: string | null } {
  return {
    contents: initial,
    read() {
      return this.contents;
    },
    write(contents) {
      this.contents = contents;
    },
  };
}

describe('settingsStore', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadSettings(memoryIO(null))).toEqual(defaultSettings);
  });

  it('returns defaults when the stored blob is corrupt JSON', () => {
    expect(loadSettings(memoryIO('{not json'))).toEqual(defaultSettings);
  });

  it('returns defaults when reading throws', () => {
    const io: SettingsIO = {
      read() {
        throw new Error('EACCES');
      },
      write() {},
    };
    expect(loadSettings(io)).toEqual(defaultSettings);
  });

  it('round-trips settings through save and load', () => {
    const io = memoryIO();
    const settings = {
      provider: 'openai',
      model: 'gpt-x',
      baseUrl: 'https://api.example.com',
      defaultWorkspacePath: '/home/me/proj',
    };
    expect(saveSettings(io, settings)).toBe(true);
    expect(loadSettings(io)).toEqual(settings);
  });

  it('ignores unknown and non-string fields in the stored blob', () => {
    const io = memoryIO(
      JSON.stringify({ provider: 'openai', model: 123, secret: 'x', defaultWorkspacePath: '/p' }),
    );
    const loaded = loadSettings(io);
    expect(loaded.provider).toBe('openai');
    expect(loaded.model).toBe(defaultSettings.model); // non-string model ignored
    expect(loaded.defaultWorkspacePath).toBe('/p');
    expect((loaded as unknown as Record<string, unknown>).secret).toBeUndefined();
  });

  it('returns false when writing fails instead of throwing', () => {
    const io: SettingsIO = {
      read: () => null,
      write() {
        throw new Error('ENOSPC');
      },
    };
    expect(saveSettings(io, defaultSettings)).toBe(false);
  });
});
