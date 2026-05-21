import { isAbsolute, relative, resolve } from 'node:path';
import { SDDValidator } from '@frontagent/sdd';
import {
  type ApprovalRequest,
  analyzeShellCommand,
  detectDangerousShellCommand,
  generateId,
  isCommonValidationCommand,
  isInstallCommand,
  type SDDConfig,
  type SecurityConfig,
  type SecurityDecision,
  type SecurityMode,
  type SecurityRiskLevel,
  type SecurityRuleProvenance,
} from '@frontagent/shared';

export interface SecurityEvaluationInput {
  toolName: string;
  args: Record<string, unknown>;
  projectRoot: string;
  sddConfig?: SDDConfig;
  security?: SecurityConfig;
  currentBrowserUrl?: string;
}

export interface NormalizedSecurityConfig {
  mode: SecurityMode;
  interactive: boolean;
  auditEnabled: boolean;
}

const READ_TOOLS = new Set([
  'read_file',
  'list_directory',
  'search_code',
  'get_ast',
  'get_snapshots',
  'get_page_structure',
  'get_accessibility_tree',
  'get_interactive_elements',
  'browser_screenshot',
  'screenshot',
  'rag_query',
  'filesense_navigate',
  'filesense_query',
]);

const WRITE_TOOLS = new Set(['create_file', 'apply_patch']);

const PACKAGE_OR_LOCK_FILES = new Set([
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
]);

function normalizeSecurityConfig(config?: SecurityConfig): NormalizedSecurityConfig {
  return {
    mode: config?.mode ?? 'balanced',
    interactive: config?.interactive ?? false,
    auditEnabled: config?.auditEnabled ?? true,
  };
}

function builtin(ruleId: string, details?: string): SecurityRuleProvenance {
  return { source: 'builtin', ruleId, mutable: false, details };
}

function sdd(ruleId: string, details?: string): SecurityRuleProvenance {
  return { source: 'sdd', ruleId, mutable: true, details };
}

function runtime(ruleId: string, details?: string): SecurityRuleProvenance {
  return { source: 'runtime', ruleId, mutable: false, details };
}

function summarizeArgs(toolName: string, args: Record<string, unknown>): string {
  const path = typeof args.path === 'string' ? args.path : undefined;
  const command = typeof args.command === 'string' ? args.command : undefined;
  const url = typeof args.url === 'string' ? args.url : undefined;
  const selector = typeof args.selector === 'string' ? args.selector : undefined;

  const raw =
    command ??
    url ??
    path ??
    selector ??
    JSON.stringify(args, (_key, value) =>
      typeof value === 'string' && value.length > 160 ? `${value.slice(0, 160)}...` : value,
    );

  const summary = `${toolName}: ${raw}`;
  return summary.length > 220 ? `${summary.slice(0, 220)}...` : summary;
}

function decision(input: {
  decision: SecurityDecision['decision'];
  riskLevel: SecurityRiskLevel;
  reasonCode: string;
  message: string;
  toolName: string;
  args: Record<string, unknown>;
  provenance: SecurityRuleProvenance[];
  approvalId?: string;
}): SecurityDecision {
  return {
    decision: input.decision,
    riskLevel: input.riskLevel,
    reasonCode: input.reasonCode,
    message: input.message,
    toolName: input.toolName,
    argsSummary: summarizeArgs(input.toolName, input.args),
    provenance: input.provenance,
    approvalId: input.approvalId,
  };
}

function isInsidePath(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function normalizeRelativePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '');
}

function resolveToolPath(
  projectRoot: string,
  path: string,
): { ok: boolean; absolutePath: string; relativePath: string; error?: string } {
  const absoluteProjectRoot = resolve(projectRoot);
  const absolutePath = resolve(absoluteProjectRoot, path);
  if (!isInsidePath(absolutePath, absoluteProjectRoot)) {
    return {
      ok: false,
      absolutePath,
      relativePath: normalizeRelativePath(relative(absoluteProjectRoot, absolutePath)),
      error: 'Path resolves outside the project root.',
    };
  }

  return {
    ok: true,
    absolutePath,
    relativePath: normalizeRelativePath(relative(absoluteProjectRoot, absolutePath)),
  };
}

function isSensitiveWritePath(relativePath: string): boolean {
  const normalized = normalizeRelativePath(relativePath);
  const segments = normalized.split('/');
  const basename = segments[segments.length - 1] ?? normalized;

  if (segments.includes('.git')) return true;
  if (segments[0] === '.frontagent' && segments[1] === 'snapshots') return true;
  if (basename === '.env' || basename.startsWith('.env.')) return true;
  if (/\.(pem|key|p12|pfx)$/i.test(basename)) return true;
  if (
    /(^|[-_.])(secret|secrets|credential|credentials|private-key|id_rsa|id_ed25519)([-_.]|$)/i.test(
      basename,
    )
  ) {
    return true;
  }

  return false;
}

function isDependencyManifest(relativePath: string): boolean {
  const normalized = normalizeRelativePath(relativePath);
  const basename = normalized.split('/').pop() ?? normalized;
  return PACKAGE_OR_LOCK_FILES.has(basename);
}

function isLocalBrowserUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function isBrowserMutationTool(toolName: string): boolean {
  return [
    'browser_navigate',
    'navigate',
    'browser_click',
    'click',
    'browser_type',
    'type',
  ].includes(toolName);
}

function askDecision(
  toolName: string,
  args: Record<string, unknown>,
  riskLevel: SecurityRiskLevel,
  reasonCode: string,
  message: string,
  provenance: SecurityRuleProvenance[],
): SecurityDecision {
  return decision({
    decision: 'ask',
    riskLevel,
    reasonCode,
    message,
    toolName,
    args,
    provenance,
    approvalId: generateId('approval'),
  });
}

export function toApprovalRequest(decisionValue: SecurityDecision): ApprovalRequest {
  if (decisionValue.decision !== 'ask') {
    throw new Error('Only ask decisions can be converted to approval requests');
  }

  return {
    ...decisionValue,
    decision: 'ask',
    approvalId: decisionValue.approvalId ?? generateId('approval'),
    createdAt: new Date().toISOString(),
  };
}

export class SecurityManager {
  evaluate(input: SecurityEvaluationInput): SecurityDecision {
    const config = normalizeSecurityConfig(input.security);
    const { toolName, args } = input;

    if (WRITE_TOOLS.has(toolName)) {
      return this.evaluateFileWrite(input, config);
    }

    if (toolName === 'rollback') {
      return askDecision(
        toolName,
        args,
        'high',
        'snapshot_rollback_requires_approval',
        'Rolling back snapshots mutates files and requires approval.',
        [builtin('file.rollback.ask')],
      );
    }

    if (toolName === 'run_command') {
      return this.evaluateShell(input, config);
    }

    if (isBrowserMutationTool(toolName)) {
      return this.evaluateBrowserMutation(input, config);
    }

    if (toolName === 'rag_query') {
      if ('repoUrl' in args || 'baseURL' in args || 'apiKey' in args) {
        return decision({
          decision: 'deny',
          riskLevel: 'high',
          reasonCode: 'rag_runtime_config_only',
          message: 'RAG queries must use runtime-configured repository and endpoint settings.',
          toolName,
          args,
          provenance: [builtin('rag.runtime-config-only')],
        });
      }
      return this.allow(
        toolName,
        args,
        'low',
        'rag_runtime_query_allowed',
        'RAG query uses runtime configuration.',
        [runtime('rag.runtime-config')],
      );
    }

    if (READ_TOOLS.has(toolName)) {
      return this.allow(
        toolName,
        args,
        'low',
        'read_tool_allowed',
        'Read-only tool request allowed.',
        [builtin('tool.read.allow')],
      );
    }

    return askDecision(
      toolName,
      args,
      'medium',
      'unknown_tool_requires_approval',
      `Tool ${toolName} is not classified and requires approval.`,
      [builtin('tool.unknown.ask')],
    );
  }

  private evaluateFileWrite(
    input: SecurityEvaluationInput,
    config: NormalizedSecurityConfig,
  ): SecurityDecision {
    const { toolName, args, projectRoot, sddConfig } = input;
    const path = typeof args.path === 'string' ? args.path : undefined;
    if (!path) {
      return decision({
        decision: 'deny',
        riskLevel: 'medium',
        reasonCode: 'file_path_missing',
        message: `${toolName} requires a path before it can be authorized.`,
        toolName,
        args,
        provenance: [builtin('file.path.required')],
      });
    }

    const pathResult = resolveToolPath(projectRoot, path);
    if (!pathResult.ok) {
      return decision({
        decision: 'deny',
        riskLevel: 'critical',
        reasonCode: 'file_path_outside_project',
        message: pathResult.error ?? 'File path is outside the project root.',
        toolName,
        args,
        provenance: [builtin('file.project-root.deny')],
      });
    }

    if (isSensitiveWritePath(pathResult.relativePath)) {
      return decision({
        decision: 'deny',
        riskLevel: 'critical',
        reasonCode: 'sensitive_file_write_blocked',
        message: `Writing ${pathResult.relativePath} is blocked by a non-bypassable file boundary.`,
        toolName,
        args,
        provenance: [builtin('file.sensitive-write.deny')],
      });
    }

    if (sddConfig) {
      const validator = new SDDValidator(sddConfig);
      const sddResult = validator.validate({
        type: toolName === 'create_file' ? 'create_file' : 'apply_patch',
        targetPath: pathResult.relativePath,
      });
      const errors = sddResult.violations.filter((violation) => violation.type === 'error');
      if (errors.length > 0) {
        return decision({
          decision: 'deny',
          riskLevel: 'high',
          reasonCode: 'sdd_protected_path_denied',
          message: errors.map((error) => error.message).join('; '),
          toolName,
          args,
          provenance: errors.map((error) => sdd(error.rule, error.message)),
        });
      }

      if (sddResult.requiresApproval) {
        return askDecision(
          toolName,
          args,
          'high',
          'sdd_requires_approval',
          `SDD requires approval: ${sddResult.approvalReasons.join('; ')}`,
          sddResult.approvalReasons.map((reason) => sdd('requireApproval', reason)),
        );
      }
    }

    const overwrite = Boolean(args.overwrite);
    if (overwrite) {
      return askDecision(
        toolName,
        args,
        'high',
        'file_overwrite_requires_approval',
        'Overwriting an existing file requires approval.',
        [builtin('file.overwrite.ask')],
      );
    }

    if (isDependencyManifest(pathResult.relativePath)) {
      return askDecision(
        toolName,
        args,
        'high',
        'dependency_file_requires_approval',
        `Changing ${pathResult.relativePath} can affect installs or supply-chain behavior and requires approval.`,
        [builtin('file.dependency-manifest.ask')],
      );
    }

    if (config.mode === 'strict') {
      return askDecision(
        toolName,
        args,
        'medium',
        'strict_file_write_requires_approval',
        'Strict security mode requires approval for file writes.',
        [builtin('mode.strict.file-write.ask')],
      );
    }

    return this.allow(
      toolName,
      args,
      'medium',
      'project_file_write_allowed',
      `Project-local ${toolName} request allowed by ${config.mode} mode.`,
      [builtin('file.project-write.allow')],
    );
  }

  private evaluateShell(
    input: SecurityEvaluationInput,
    config: NormalizedSecurityConfig,
  ): SecurityDecision {
    const { toolName, args } = input;
    const command = typeof args.command === 'string' ? args.command : '';
    const analysis = analyzeShellCommand(command);
    const dangerous = detectDangerousShellCommand(command, analysis);

    if (dangerous.dangerous) {
      return decision({
        decision: 'deny',
        riskLevel: 'critical',
        reasonCode: dangerous.reasonCode ?? 'dangerous_shell_command',
        message: dangerous.reason ?? 'Dangerous shell command blocked.',
        toolName,
        args,
        provenance: [builtin('shell.dangerous.deny')],
      });
    }

    if (!analysis.structurallyTrusted) {
      return askDecision(
        toolName,
        args,
        'high',
        analysis.reasonCode ?? 'shell_structural_review_required',
        analysis.reason ?? 'Shell command is too complex for automatic authorization.',
        [builtin('shell.structure.ask')],
      );
    }

    if (isInstallCommand(analysis)) {
      return askDecision(
        toolName,
        args,
        'high',
        'install_command_requires_approval',
        'Install or package execution commands require approval.',
        [builtin('shell.install.ask')],
      );
    }

    if (isCommonValidationCommand(analysis)) {
      if (config.mode === 'strict') {
        return askDecision(
          toolName,
          args,
          'medium',
          'strict_shell_requires_approval',
          'Strict security mode requires approval for shell commands.',
          [builtin('mode.strict.shell.ask')],
        );
      }

      return this.allow(
        toolName,
        args,
        'medium',
        'validation_command_allowed',
        'Common validation command allowed.',
        [builtin('shell.validation.allow')],
      );
    }

    return askDecision(
      toolName,
      args,
      'medium',
      'shell_command_requires_approval',
      'Shell commands outside the known validation allowlist require approval.',
      [builtin('shell.default.ask')],
    );
  }

  private evaluateBrowserMutation(
    input: SecurityEvaluationInput,
    config: NormalizedSecurityConfig,
  ): SecurityDecision {
    const { toolName, args, currentBrowserUrl } = input;
    const url = typeof args.url === 'string' ? args.url : currentBrowserUrl;

    if (typeof args.url === 'string' && args.url.startsWith('file:')) {
      return decision({
        decision: 'deny',
        riskLevel: 'high',
        reasonCode: 'browser_file_url_denied',
        message: 'file:// browser navigation is blocked for model-triggered browser actions.',
        toolName,
        args,
        provenance: [builtin('browser.file-url.deny')],
      });
    }

    if (url && isLocalBrowserUrl(url) && config.mode !== 'strict') {
      return this.allow(
        toolName,
        args,
        'medium',
        'local_browser_action_allowed',
        'Localhost browser interaction allowed for development testing.',
        [builtin('browser.localhost.allow')],
      );
    }

    return askDecision(
      toolName,
      args,
      'high',
      'external_browser_action_requires_approval',
      'External or unknown browser interactions require approval.',
      [builtin('browser.external.ask')],
    );
  }

  private allow(
    toolName: string,
    args: Record<string, unknown>,
    riskLevel: SecurityRiskLevel,
    reasonCode: string,
    message: string,
    provenance: SecurityRuleProvenance[],
  ): SecurityDecision {
    return decision({
      decision: 'allow',
      riskLevel,
      reasonCode,
      message,
      toolName,
      args,
      provenance,
    });
  }
}

export function normalizeSecurity(config?: SecurityConfig): NormalizedSecurityConfig {
  return normalizeSecurityConfig(config);
}
