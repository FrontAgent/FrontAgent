import type { SecurityPermissionRules } from './types.js';

/**
 * 声明式权限规则匹配引擎
 *
 * 规则语法："toolName" 匹配该工具的任意调用；"toolName(pattern)" 进一步用
 * pattern 匹配主参数，* 为通配符，\* 与 \\ 为字面量转义（供系统派生的
 * 精确规则使用，避免一次批准被扩大成通配授权）。deny 永远优先于 allow。
 */

export interface ParsedPermissionRule {
  toolName: string;
  pattern?: string;
}

export function parsePermissionRule(rule: string): ParsedPermissionRule | undefined {
  const trimmed = rule.trim();
  if (!trimmed) return undefined;

  const match = trimmed.match(/^([A-Za-z0-9_-]+)(?:\((.*)\))?$/);
  if (!match) return undefined;

  const [, toolName, pattern] = match;
  return { toolName, pattern: pattern === undefined ? undefined : pattern };
}

/** 提取用于规则匹配的主参数（与审批摘要保持一致的优先级） */
export function extractPrimaryArg(args: Record<string, unknown>): string | undefined {
  for (const key of ['command', 'url', 'path', 'selector']) {
    const value = args[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}

function escapeRegExpChar(char: string): string {
  return /[.*+?^${}()|[\]\\]/.test(char) ? `\\${char}` : char;
}

function patternToRegExp(pattern: string): RegExp {
  let source = '';
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === '\\' && i + 1 < pattern.length) {
      // \* 与 \\ 是字面量转义；其余保留反斜杠本身
      const next = pattern[i + 1];
      if (next === '*' || next === '\\') {
        source += escapeRegExpChar(next);
        i += 1;
        continue;
      }
      source += '\\\\';
      continue;
    }
    source += char === '*' ? '.*' : escapeRegExpChar(char);
  }
  return new RegExp(`^${source}$`);
}

/** 把主参数转义为字面量 pattern（* 和 \ 不再具有元字符含义） */
export function escapePatternLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\*/g, '\\*');
}

export function matchesPermissionRule(
  rule: string,
  toolName: string,
  args: Record<string, unknown>,
): boolean {
  const parsed = parsePermissionRule(rule);
  if (!parsed || parsed.toolName !== toolName) return false;
  if (parsed.pattern === undefined) return true;

  const primaryArg = extractPrimaryArg(args);
  if (primaryArg === undefined) return false;
  return patternToRegExp(parsed.pattern).test(primaryArg);
}

export interface PermissionRuleMatch {
  outcome: 'allow' | 'deny';
  rule: string;
}

/** deny 优先；无命中返回 undefined，由原有安全管线决策 */
export function evaluatePermissionRules(
  rules: SecurityPermissionRules | undefined,
  toolName: string,
  args: Record<string, unknown>,
): PermissionRuleMatch | undefined {
  if (!rules) return undefined;

  for (const rule of rules.deny ?? []) {
    if (matchesPermissionRule(rule, toolName, args)) {
      return { outcome: 'deny', rule };
    }
  }

  for (const rule of rules.allow ?? []) {
    if (matchesPermissionRule(rule, toolName, args)) {
      return { outcome: 'allow', rule };
    }
  }

  return undefined;
}

/**
 * 从一次已批准的调用派生精确 allow 规则（用于"始终允许"持久化）。
 * 主参数做字面量转义：包含 * 的命令不会被扩大成通配授权。
 * 无法提取主参数时返回 undefined——不能从一次具体审批派生
 * "允许该工具所有调用"的裸规则，这类授权必须由用户显式书写。
 */
export function deriveAllowRule(
  toolName: string,
  args: Record<string, unknown>,
): string | undefined {
  const primaryArg = extractPrimaryArg(args);
  if (primaryArg === undefined) return undefined;
  return `${toolName}(${escapePatternLiteral(primaryArg)})`;
}
