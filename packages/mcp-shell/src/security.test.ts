import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createShellMCPClient } from './index.js';

let roots: string[] = [];

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'frontagent-shell-'));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
  roots = [];
});

describe('ShellMCPClient security boundary', () => {
  it('runs structurally trusted commands without shell mode', async () => {
    const root = makeRoot();
    const client = createShellMCPClient(root);

    const result = (await client.callTool('run_command', {
      command: 'node -e "process.exit(0)"',
    })) as { success: boolean; exitCode?: number };

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  it('fails closed for complex shell structure without approval marker', async () => {
    const root = makeRoot();
    const client = createShellMCPClient(root);

    const result = (await client.callTool('run_command', {
      command: 'echo hi >> output.txt',
    })) as { success: boolean; error?: string };

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/requires security approval/i);
    expect(existsSync(join(root, 'output.txt'))).toBe(false);
  });

  it('allows approved complex shell structure while preserving hard denies', async () => {
    const root = makeRoot();
    const client = createShellMCPClient(root);

    const approved = (await client.callTool('run_command', {
      command: 'echo hi >> output.txt',
      __frontagentSecurityApproved: true,
    })) as { success: boolean };
    const denied = (await client.callTool('run_command', {
      command: 'rm -rf output.txt',
      __frontagentSecurityApproved: true,
    })) as { success: boolean; error?: string };

    expect(approved.success).toBe(true);
    expect(readFileSync(join(root, 'output.txt'), 'utf-8').trim()).toBe('hi');
    expect(denied.success).toBe(false);
    expect(denied.error).toMatch(/blocked|deletion/i);
  });

  it('blocks working directories outside the project root', async () => {
    const root = makeRoot();
    const client = createShellMCPClient(root);

    const result = (await client.callTool('run_command', {
      command: 'pwd',
      workingDirectory: '..',
    })) as { success: boolean; error?: string };

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/outside project root/i);
  });
});
