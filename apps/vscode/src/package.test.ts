import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('VS Code extension manifest', () => {
  it('points to a CommonJS extension entry and an existing Activity Bar icon', () => {
    const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      main: string;
      contributes: {
        viewsContainers: {
          activitybar: Array<{ icon: string }>;
        };
      };
    };

    expect(manifest.main).toBe('./dist/extension.cjs');
    const icon = manifest.contributes.viewsContainers.activitybar[0].icon;
    expect(icon).toBe('media/activitybar.svg');
    expect(existsSync(resolve(root, icon))).toBe(true);
  });

  it('contributes all commands used by the sidebar and editor context menus', () => {
    const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      contributes: {
        commands: Array<{ command: string }>;
      };
    };
    const commands = new Set(manifest.contributes.commands.map((command) => command.command));

    for (const command of [
      'frontagent.run',
      'frontagent.configure',
      'frontagent.runCurrentFile',
      'frontagent.runSelection',
      'frontagent.initSdd',
      'frontagent.validateSdd',
      'frontagent.openRunLog',
    ]) {
      expect(commands.has(command)).toBe(true);
    }
  });
});
