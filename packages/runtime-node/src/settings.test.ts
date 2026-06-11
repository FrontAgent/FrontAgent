import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  appendAllowRuleToSettings,
  getProjectSettingsPath,
  loadProjectSettings,
} from './settings.js';

describe('project settings', () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'fa-settings-'));
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  function writeSettings(content: string) {
    const path = getProjectSettingsPath(projectRoot);
    mkdirSync(join(projectRoot, '.frontagent'), { recursive: true });
    writeFileSync(path, content);
  }

  it('returns empty settings when the file is missing or corrupt', () => {
    expect(loadProjectSettings(projectRoot)).toEqual({});
    writeSettings('{ not json');
    expect(loadProjectSettings(projectRoot)).toEqual({});
    writeSettings('[1, 2]');
    expect(loadProjectSettings(projectRoot)).toEqual({});
  });

  it('loads and sanitizes permission rules', () => {
    writeSettings(
      JSON.stringify({
        permissions: {
          allow: ['run_command(pnpm test:*)', '', 42],
          deny: ['run_command(rm *)'],
        },
        otherField: true,
      }),
    );

    const settings = loadProjectSettings(projectRoot);
    expect(settings.permissions).toEqual({
      allow: ['run_command(pnpm test:*)'],
      deny: ['run_command(rm *)'],
    });
    expect(settings.otherField).toBe(true);
  });

  it('appends allow rules with dedupe and preserves other settings', () => {
    writeSettings(JSON.stringify({ permissions: { deny: ['run_command(rm *)'] }, keep: 'me' }));

    appendAllowRuleToSettings(projectRoot, 'run_command(pnpm lint)');
    appendAllowRuleToSettings(projectRoot, 'run_command(pnpm lint)');

    const raw = JSON.parse(readFileSync(getProjectSettingsPath(projectRoot), 'utf-8'));
    expect(raw.permissions.allow).toEqual(['run_command(pnpm lint)']);
    expect(raw.permissions.deny).toEqual(['run_command(rm *)']);
    expect(raw.keep).toBe('me');
  });

  it('creates the settings file from scratch when persisting the first rule', () => {
    appendAllowRuleToSettings(projectRoot, 'browser_navigate(http://localhost:*)');

    const settings = loadProjectSettings(projectRoot);
    expect(settings.permissions?.allow).toEqual(['browser_navigate(http://localhost:*)']);
  });
});
