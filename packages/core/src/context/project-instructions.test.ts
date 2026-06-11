import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  discoverProjectInstructionSources,
  loadProjectInstructions,
} from './project-instructions.js';

describe('project-instructions', () => {
  let root: string;
  let globalDir: string;
  let projectRoot: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'fa-instructions-'));
    globalDir = join(root, 'global');
    projectRoot = join(root, 'repo');
    mkdirSync(globalDir, { recursive: true });
    mkdirSync(projectRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('discovers files in global → project → cwd order', () => {
    const cwd = join(projectRoot, 'apps', 'web');
    mkdirSync(cwd, { recursive: true });
    writeFileSync(join(globalDir, 'AGENTS.md'), 'global rules');
    writeFileSync(join(projectRoot, 'AGENTS.md'), 'repo rules');
    writeFileSync(join(cwd, 'AGENTS.md'), 'app rules');

    const sources = discoverProjectInstructionSources({
      projectRoot,
      cwd,
      globalConfigDir: globalDir,
    });

    expect(sources.map((s) => s.level)).toEqual(['global', 'project', 'cwd']);
    expect(sources.map((s) => s.content)).toEqual(['global rules', 'repo rules', 'app rules']);
  });

  it('falls back to CLAUDE.md when AGENTS.md is absent at a level', () => {
    writeFileSync(join(projectRoot, 'CLAUDE.md'), 'claude rules');

    const sources = discoverProjectInstructionSources({
      projectRoot,
      globalConfigDir: globalDir,
    });

    expect(sources).toHaveLength(1);
    expect(sources[0].path).toBe(join(projectRoot, 'CLAUDE.md'));
  });

  it('prefers AGENTS.md over CLAUDE.md at the same level', () => {
    writeFileSync(join(projectRoot, 'AGENTS.md'), 'agents rules');
    writeFileSync(join(projectRoot, 'CLAUDE.md'), 'claude rules');

    const sources = discoverProjectInstructionSources({
      projectRoot,
      globalConfigDir: globalDir,
    });

    expect(sources).toHaveLength(1);
    expect(sources[0].content).toBe('agents rules');
  });

  it('skips missing files, empty files, and cwd outside the project root', () => {
    const outsideCwd = join(root, 'elsewhere');
    mkdirSync(outsideCwd, { recursive: true });
    writeFileSync(join(outsideCwd, 'AGENTS.md'), 'outside rules');
    writeFileSync(join(projectRoot, 'AGENTS.md'), '   \n  ');

    const sources = discoverProjectInstructionSources({
      projectRoot,
      cwd: outsideCwd,
      globalConfigDir: globalDir,
    });

    expect(sources).toHaveLength(0);
    expect(loadProjectInstructions({ projectRoot, globalConfigDir: globalDir })).toBeUndefined();
  });

  it('treats non-normalized cwd paths inside the project as the cwd level', () => {
    const cwd = join(projectRoot, 'apps', 'web');
    mkdirSync(cwd, { recursive: true });
    writeFileSync(join(cwd, 'AGENTS.md'), 'app rules');

    // 含 ..、重复分隔符、尾随分隔符的 cwd 输入都应归一化后判定为项目内
    for (const messyCwd of [
      join(projectRoot, 'apps', '..', 'apps', 'web'),
      `${projectRoot}//apps//web`,
      `${join(projectRoot, 'apps', 'web')}/`,
    ]) {
      const sources = discoverProjectInstructionSources({
        projectRoot,
        cwd: messyCwd,
        globalConfigDir: globalDir,
      });
      expect(sources.map((s) => s.level)).toContain('cwd');
    }

    // 项目根的兄弟目录（共享前缀但不在项目内）必须被排除
    const sibling = `${projectRoot}-sibling`;
    mkdirSync(sibling, { recursive: true });
    writeFileSync(join(sibling, 'AGENTS.md'), 'sibling rules');
    const siblingSources = discoverProjectInstructionSources({
      projectRoot,
      cwd: sibling,
      globalConfigDir: globalDir,
    });
    expect(siblingSources.map((s) => s.level)).not.toContain('cwd');
    rmSync(sibling, { recursive: true, force: true });
  });

  it('truncates oversized files with an explicit marker', () => {
    writeFileSync(join(projectRoot, 'AGENTS.md'), 'x'.repeat(200));

    const sources = discoverProjectInstructionSources({
      projectRoot,
      globalConfigDir: globalDir,
      maxBytesPerFile: 100,
    });

    expect(sources).toHaveLength(1);
    expect(sources[0].truncated).toBe(true);
    expect(sources[0].content).toContain('[已截断');
    expect(sources[0].content.startsWith('x'.repeat(100))).toBe(true);
  });

  it('reads only the byte cap from very large files', () => {
    // 4MB 文件、64 字节上限：截断结果只含上限范围内的内容
    writeFileSync(join(projectRoot, 'AGENTS.md'), 'y'.repeat(4 * 1024 * 1024));

    const sources = discoverProjectInstructionSources({
      projectRoot,
      globalConfigDir: globalDir,
      maxBytesPerFile: 64,
    });

    expect(sources).toHaveLength(1);
    expect(sources[0].truncated).toBe(true);
    expect(sources[0].content.startsWith('y'.repeat(64))).toBe(true);
    expect(sources[0].content).not.toContain('y'.repeat(65));
  });

  it('drops a multibyte character split by the byte cap instead of emitting garbage', () => {
    // 每个 '指' 占 3 字节；上限 8 字节会把第三个字符切成半个
    writeFileSync(join(projectRoot, 'AGENTS.md'), '指指指指');

    const sources = discoverProjectInstructionSources({
      projectRoot,
      globalConfigDir: globalDir,
      maxBytesPerFile: 8,
    });

    expect(sources).toHaveLength(1);
    expect(sources[0].truncated).toBe(true);
    expect(sources[0].content.startsWith('指指')).toBe(true);
    expect(sources[0].content).not.toContain('�');
  });

  it('formats a prompt zone with SDD-precedence note and source paths', () => {
    writeFileSync(join(globalDir, 'AGENTS.md'), 'global rules');
    writeFileSync(join(projectRoot, 'AGENTS.md'), 'repo rules');

    const zone = loadProjectInstructions({ projectRoot, globalConfigDir: globalDir });

    expect(zone).toBeDefined();
    expect(zone).toContain('## 项目指令 (Project Instructions)');
    expect(zone).toContain('以 SDD 约束为准');
    expect(zone).toContain(join(globalDir, 'AGENTS.md'));
    expect(zone).toContain(join(projectRoot, 'AGENTS.md'));
    expect(zone?.indexOf('global rules')).toBeLessThan(zone?.indexOf('repo rules') ?? -1);
  });
});
