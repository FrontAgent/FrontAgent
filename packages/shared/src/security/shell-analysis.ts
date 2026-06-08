export interface ShellCommandAnalysis {
  command: string;
  structurallyTrusted: boolean;
  needsShell: boolean;
  argv: string[];
  commandName?: string;
  reasonCode?: string;
  reason?: string;
}

export interface DangerousShellCommandResult {
  dangerous: boolean;
  reasonCode?: string;
  reason?: string;
}

const SHELL_OPERATOR_PATTERNS: Array<{ pattern: RegExp; reasonCode: string; reason: string }> = [
  {
    pattern: /\|\|?/,
    reasonCode: 'shell_operator',
    reason: 'Shell pipes require full-command review.',
  },
  {
    pattern: /&&/,
    reasonCode: 'shell_operator',
    reason: 'Compound shell operators require full-command review.',
  },
  {
    pattern: /[<>]/,
    reasonCode: 'shell_redirect',
    reason: 'Shell redirects can read or write paths outside argument parsing.',
  },
  {
    pattern: /;/,
    reasonCode: 'shell_sequence',
    reason: 'Command sequences are context-coupled and require review.',
  },
  {
    pattern: /\r|\n/,
    reasonCode: 'shell_multiline',
    reason: 'Multiline shell commands require review.',
  },
  {
    pattern: /\$\(/,
    reasonCode: 'shell_substitution',
    reason: 'Command substitution requires review.',
  },
  {
    pattern: /`/,
    reasonCode: 'shell_substitution',
    reason: 'Backtick command substitution requires review.',
  },
];

function splitSimpleShellCommand(command: string): { tokens: string[]; error?: string } {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | undefined;
  let escaping = false;

  for (const char of command) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === '\\' && quote !== "'") {
      escaping = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = undefined;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (escaping) {
    current += '\\';
  }

  if (quote) {
    return { tokens: [], error: 'Unclosed shell quote.' };
  }

  if (current) {
    tokens.push(current);
  }

  return { tokens };
}

export function analyzeShellCommand(command: string): ShellCommandAnalysis {
  const trimmed = command.trim();
  if (!trimmed) {
    return {
      command,
      structurallyTrusted: false,
      needsShell: false,
      argv: [],
      reasonCode: 'empty_command',
      reason: 'Command is empty.',
    };
  }

  for (const operator of SHELL_OPERATOR_PATTERNS) {
    if (operator.pattern.test(trimmed)) {
      return {
        command,
        structurallyTrusted: false,
        needsShell: true,
        argv: [],
        reasonCode: operator.reasonCode,
        reason: operator.reason,
      };
    }
  }

  const parsed = splitSimpleShellCommand(trimmed);
  if (parsed.error) {
    return {
      command,
      structurallyTrusted: false,
      needsShell: true,
      argv: [],
      reasonCode: 'shell_parse_error',
      reason: parsed.error,
    };
  }

  const [commandName, ...rest] = parsed.tokens;
  if (!commandName) {
    return {
      command,
      structurallyTrusted: false,
      needsShell: false,
      argv: [],
      reasonCode: 'empty_command',
      reason: 'Command is empty.',
    };
  }

  if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(commandName)) {
    return {
      command,
      structurallyTrusted: false,
      needsShell: true,
      argv: parsed.tokens,
      reasonCode: 'shell_env_assignment',
      reason: 'Inline environment assignments require shell semantics.',
    };
  }

  return {
    command,
    structurallyTrusted: true,
    needsShell: false,
    argv: [commandName, ...rest],
    commandName,
  };
}

function commandIncludesPipeToInterpreter(command: string): boolean {
  return /\b(curl|wget)\b[\s\S]*\|[\s\S]*\b(sh|bash|zsh|node|python|python3|ruby|perl)\b/i.test(
    command,
  );
}

function hasRecursiveFlag(argv: string[]): boolean {
  return argv.some((arg) => /^-[A-Za-z]*[Rr][A-Za-z]*$/.test(arg) || arg === '--recursive');
}

export function detectDangerousShellCommand(
  command: string,
  analysis: ShellCommandAnalysis = analyzeShellCommand(command),
): DangerousShellCommandResult {
  const normalized = command.trim();

  if (commandIncludesPipeToInterpreter(normalized)) {
    return {
      dangerous: true,
      reasonCode: 'shell_pipe_to_interpreter',
      reason: 'Piping downloaded content into an interpreter is blocked.',
    };
  }

  const commandName = analysis.commandName ?? analysis.argv[0];
  if (!commandName) {
    return { dangerous: false };
  }

  const base = commandName.split('/').pop() ?? commandName;
  const args = analysis.argv.slice(1);

  if (['sudo', 'su', 'doas'].includes(base)) {
    return {
      dangerous: true,
      reasonCode: 'shell_privilege_escalation',
      reason: 'Privilege escalation commands are blocked.',
    };
  }

  if (
    base === 'rm' &&
    args.some((arg) =>
      /^-[A-Za-z]*r[A-Za-z]*f[A-Za-z]*$|^-[A-Za-z]*f[A-Za-z]*r[A-Za-z]*$/i.test(arg),
    )
  ) {
    return {
      dangerous: true,
      reasonCode: 'shell_dangerous_delete',
      reason: 'Recursive forced deletion is blocked.',
    };
  }

  if (base === 'rm' && args.some((arg) => arg === '/' || arg === '~' || arg === '$HOME')) {
    return {
      dangerous: true,
      reasonCode: 'shell_dangerous_delete',
      reason: 'Deletion targeting a root or home directory is blocked.',
    };
  }

  if (['chmod', 'chown', 'chgrp'].includes(base) && hasRecursiveFlag(args)) {
    return {
      dangerous: true,
      reasonCode: 'shell_recursive_permission_change',
      reason: 'Recursive permission or ownership changes are blocked.',
    };
  }

  if (base === 'find' && args.includes('-delete')) {
    return {
      dangerous: true,
      reasonCode: 'shell_find_delete',
      reason: 'find -delete is blocked.',
    };
  }

  return { dangerous: false };
}

export function isCommonValidationCommand(analysis: ShellCommandAnalysis): boolean {
  if (!analysis.structurallyTrusted) return false;

  const [commandName, firstArg] = analysis.argv;
  const base = commandName?.split('/').pop();
  if (!base) return false;

  if (base === 'git') {
    return ['status', 'diff', 'show', 'log', 'rev-parse'].includes(firstArg ?? '');
  }

  if (['pnpm', 'npm', 'yarn', 'bun'].includes(base)) {
    return ['test', 'typecheck', 'build', 'lint'].includes(firstArg ?? '');
  }

  return false;
}

export function isInstallCommand(analysis: ShellCommandAnalysis): boolean {
  if (!analysis.structurallyTrusted) return false;

  const [commandName, firstArg] = analysis.argv;
  const base = commandName?.split('/').pop();
  if (!base) return false;

  if (base === 'npx') return true;
  if (base === 'npm') return ['install', 'i', 'add'].includes(firstArg ?? '');
  if (base === 'pnpm') return ['install', 'i', 'add'].includes(firstArg ?? '');
  if (base === 'yarn') return ['install', 'add'].includes(firstArg ?? '');
  if (base === 'bun') return ['install', 'add'].includes(firstArg ?? '');

  return false;
}
