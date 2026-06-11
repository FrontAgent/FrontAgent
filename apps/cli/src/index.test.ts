import type { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CliCommandHandlers } from './index.js';
import { createCliProgram, createProductionCliProgram } from './index.js';

const commandModuleMocks = vi.hoisted(() => ({
  registerRagCommand: vi.fn((program: Command) => {
    program.command('rag').description('mock rag command');
  }),
  registerSkillCommand: vi.fn((program: Command) => {
    program.command('skill').description('mock skill command');
  }),
}));

vi.mock('./commands/rag.js', () => ({
  registerRagCommand: commandModuleMocks.registerRagCommand,
}));

vi.mock('./commands/skill.js', () => ({
  registerSkillCommand: commandModuleMocks.registerSkillCommand,
}));

async function parseWithCapturedOutput(program: Command, argv: string[]) {
  let stdout = '';
  let stderr = '';

  program.configureOutput({
    writeOut: (value) => {
      stdout += value;
    },
    writeErr: (value) => {
      stderr += value;
    },
  });
  program.exitOverride();

  try {
    await program.parseAsync(['node', 'fa', ...argv], { from: 'node' });
  } catch (error) {
    const commanderError = error as { code?: string; exitCode?: number };
    if (commanderError.exitCode !== 0) {
      throw error;
    }
  }

  return { stdout, stderr };
}

function createHandlerSpies(overrides: Partial<CliCommandHandlers> = {}) {
  return {
    init: vi.fn(async () => {}),
    validate: vi.fn(async () => {}),
    prompt: vi.fn(async () => {}),
    run: vi.fn(async () => {}),
    mcpServe: vi.fn(async () => {}),
    info: vi.fn(async () => {}),
    ...overrides,
  } satisfies CliCommandHandlers;
}

function expectNoHandlerCalls(handlers: CliCommandHandlers) {
  expect(handlers.init).not.toHaveBeenCalled();
  expect(handlers.validate).not.toHaveBeenCalled();
  expect(handlers.prompt).not.toHaveBeenCalled();
  expect(handlers.run).not.toHaveBeenCalled();
  expect(handlers.mcpServe).not.toHaveBeenCalled();
  expect(handlers.info).not.toHaveBeenCalled();
}

describe('CLI command router', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('prints the injected version without running command handlers', async () => {
    const handlers = createHandlerSpies();
    const program = createCliProgram({ version: '1.2.3', handlers });

    const { stdout, stderr } = await parseWithCapturedOutput(program, ['--version']);

    expect(stdout.trim()).toBe('1.2.3');
    expect(stderr).toBe('');
    expectNoHandlerCalls(handlers);
  });

  it('prints the injected version from the version subcommand', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    const handlers = createHandlerSpies();
    const program = createCliProgram({ version: '1.2.3', handlers });

    await program.parseAsync(['node', 'fa', 'version'], { from: 'node' });

    expect(consoleLog).toHaveBeenCalledWith('1.2.3');
    expectNoHandlerCalls(handlers);
  });

  it('prints help for the root command without running command handlers', async () => {
    const handlers = createHandlerSpies();
    const program = createCliProgram({ version: '1.2.3', handlers });

    const { stdout, stderr } = await parseWithCapturedOutput(program, ['--help']);

    expect(stdout).toContain('FrontAgent');
    expect(stdout).toContain('run [options] [task]');
    expect(stderr).toBe('');
    expectNoHandlerCalls(handlers);
  });

  it('parses representative run flags before delegating to the run handler', async () => {
    const run = vi.fn(async (_task: string, _options: Record<string, unknown>) => {});
    const handlers = createHandlerSpies({ run });
    const program = createCliProgram({
      version: '1.2.3',
      handlers,
    });

    await program.parseAsync(
      [
        'node',
        'fa',
        'run',
        'ship it',
        '--type',
        'debug',
        '--files',
        'src/a.ts',
        'src/b.ts',
        '--model',
        'gpt-test',
        '--disable-rag',
        '--no-run-log',
        '--security-mode',
        'strict',
        '--rag-max-results',
        '7',
      ],
      { from: 'node' },
    );

    expect(run).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledWith('ship it', expect.any(Object));
    expect(run.mock.calls[0]?.[1]).toMatchObject({
      type: 'debug',
      files: ['src/a.ts', 'src/b.ts'],
      model: 'gpt-test',
      disableRag: true,
      runLog: false,
      securityMode: 'strict',
      ragMaxResults: '7',
    });
    expect(handlers.init).not.toHaveBeenCalled();
    expect(handlers.validate).not.toHaveBeenCalled();
    expect(handlers.prompt).not.toHaveBeenCalled();
    expect(handlers.mcpServe).not.toHaveBeenCalled();
    expect(handlers.info).not.toHaveBeenCalled();
  });

  it('keeps production version and help paths cheap after extension command registration', async () => {
    const handlers = createHandlerSpies();
    const versionProgram = await createProductionCliProgram({ version: '1.2.3', handlers });
    const helpProgram = await createProductionCliProgram({ version: '1.2.3', handlers });

    const versionOutput = await parseWithCapturedOutput(versionProgram, ['--version']);
    const helpOutput = await parseWithCapturedOutput(helpProgram, ['--help']);

    expect(versionOutput.stdout.trim()).toBe('1.2.3');
    expect(helpOutput.stdout).toContain('rag');
    expect(helpOutput.stdout).toContain('skill');
    expect(commandModuleMocks.registerRagCommand).toHaveBeenCalledTimes(2);
    expect(commandModuleMocks.registerSkillCommand).toHaveBeenCalledTimes(2);
    expectNoHandlerCalls(handlers);
  });
});
