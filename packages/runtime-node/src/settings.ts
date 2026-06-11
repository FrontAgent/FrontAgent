import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { SecurityPermissionRules } from '@frontagent/shared';

/**
 * 项目级设置（.frontagent/settings.json）
 *
 * 目前承载声明式权限规则；保留未知字段以便向前兼容。
 */

export interface ProjectSettings {
  permissions?: SecurityPermissionRules;
  [key: string]: unknown;
}

export function getProjectSettingsPath(projectRoot: string): string {
  return join(projectRoot, '.frontagent', 'settings.json');
}

function sanitizeRuleList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const rules = value.filter(
    (item): item is string => typeof item === 'string' && item.trim() !== '',
  );
  return rules.length > 0 ? rules : undefined;
}

/** 读取项目设置；文件缺失或损坏时返回空设置，不阻塞任务 */
export function loadProjectSettings(projectRoot: string): ProjectSettings {
  const settingsPath = getProjectSettingsPath(projectRoot);
  try {
    if (!existsSync(settingsPath)) return {};
    const parsed = JSON.parse(readFileSync(settingsPath, 'utf-8')) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};

    const settings = parsed as ProjectSettings;
    const permissionsRaw = settings.permissions as Record<string, unknown> | undefined;
    const permissions: SecurityPermissionRules | undefined =
      typeof permissionsRaw === 'object' && permissionsRaw !== null
        ? {
            allow: sanitizeRuleList(permissionsRaw.allow),
            deny: sanitizeRuleList(permissionsRaw.deny),
          }
        : undefined;

    return { ...settings, permissions };
  } catch {
    return {};
  }
}

/** 把一次"始终允许"决策追加为持久 allow 规则（去重） */
export function appendAllowRuleToSettings(projectRoot: string, rule: string): void {
  const settingsPath = getProjectSettingsPath(projectRoot);
  const settings = loadProjectSettings(projectRoot);
  const allow = settings.permissions?.allow ?? [];
  if (allow.includes(rule)) return;

  const next: ProjectSettings = {
    ...settings,
    permissions: {
      ...settings.permissions,
      allow: [...allow, rule],
    },
  };

  mkdirSync(dirname(settingsPath), { recursive: true });
  writeFileSync(settingsPath, `${JSON.stringify(next, null, 2)}\n`, 'utf-8');
}
