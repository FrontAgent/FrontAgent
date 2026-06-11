import type { SecurityPermissionRules } from './types.js';

/**
 * 声明式权限规则匹配引擎
 *
 * 规则语法："toolName" 匹配该工具的任意调用；"toolName(pattern)" 进一步用
 * pattern 匹配主参数，* 为通配符。deny 永远优先于 allow。
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

function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, (char) =>
    char === '*' ? '.*' : `\\${char}`,
  );
  return new RegExp(`^${escaped}$`);
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

/** 从一次已批准的调用派生精确 allow 规则（用于"始终允许"持久化） */
export function deriveAllowRule(toolName: string, args: Record<string, unknown>): string {
  const primaryArg = extractPrimaryArg(args);
  return primaryArg === undefined ? toolName : `${toolName}(${primaryArg})`;
}
