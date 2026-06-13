/**
 * File-backed {@link SettingsIO} for the Electron main process. Kept separate
 * from `main.ts` (which is Electron assembly) so the read/write/parent-dir
 * behaviour stays unit-testable against a real temp directory. `main.ts` points
 * it at `app.getPath('userData')`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { SettingsIO } from './settingsStore.js';

export function createFileSettingsIO(filePath: string): SettingsIO {
  return {
    read: () => (existsSync(filePath) ? readFileSync(filePath, 'utf8') : null),
    write: (contents) => {
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, contents, 'utf8');
    },
  };
}
