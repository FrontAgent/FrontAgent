/**
 * Desktop settings persistence. Pure logic over an injected {@link SettingsIO}
 * (PR4 backs it with a JSON file under `app.getPath('userData')`), so it is
 * unit-testable and degrades safely on missing/corrupt/unwritable storage.
 */
import type { DesktopSettings } from '../ipc/contract.js';

export const defaultSettings: DesktopSettings = {
  provider: 'anthropic',
  model: 'claude-opus-4-8',
  baseUrl: '',
  defaultWorkspacePath: '',
};

export interface SettingsIO {
  /** Returns the stored contents, or null when nothing is stored yet. */
  read(): string | null;
  write(contents: string): void;
}

const STRING_KEYS: (keyof DesktopSettings)[] = [
  'provider',
  'model',
  'baseUrl',
  'defaultWorkspacePath',
];

/** Keep only known string fields; ignore anything else in the stored blob. */
function sanitize(value: unknown): Partial<DesktopSettings> {
  if (!value || typeof value !== 'object') return {};
  const record = value as Record<string, unknown>;
  const out: Partial<DesktopSettings> = {};
  for (const key of STRING_KEYS) {
    if (typeof record[key] === 'string') out[key] = record[key] as string;
  }
  return out;
}

export function loadSettings(io: SettingsIO): DesktopSettings {
  let raw: string | null;
  try {
    raw = io.read();
  } catch {
    return { ...defaultSettings }; // unreadable storage → defaults
  }
  if (!raw) return { ...defaultSettings };
  try {
    return { ...defaultSettings, ...sanitize(JSON.parse(raw)) };
  } catch {
    return { ...defaultSettings }; // corrupt JSON → defaults
  }
}

/** Persist settings. Returns true on success; never throws on write failure. */
export function saveSettings(io: SettingsIO, settings: DesktopSettings): boolean {
  try {
    io.write(JSON.stringify({ ...defaultSettings, ...sanitize(settings) }, null, 2));
    return true;
  } catch {
    return false;
  }
}
