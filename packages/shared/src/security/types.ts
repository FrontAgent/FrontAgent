export type SecurityMode = 'balanced' | 'strict' | 'developer';

export type SecurityDecisionOutcome = 'allow' | 'ask' | 'deny';

export type SecurityRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type SecurityRuleSource = 'builtin' | 'sdd' | 'runtime' | 'user';

export interface SecurityRuleProvenance {
  source: SecurityRuleSource;
  ruleId: string;
  mutable?: boolean;
  details?: string;
}

/**
 * 声明式权限规则（.frontagent/settings.json 的 permissions 段）
 *
 * 规则形如 "toolName" 或 "toolName(pattern)"，pattern 用 * 通配，
 * 匹配工具的主参数（run_command 的 command、文件工具的 path、浏览器工具的 url）。
 */
export interface SecurityPermissionRules {
  allow?: string[];
  deny?: string[];
}

export interface SecurityConfig {
  mode?: SecurityMode;
  interactive?: boolean;
  auditEnabled?: boolean;
  permissions?: SecurityPermissionRules;
}

/** 审批响应；alwaysAllow 表示同时把本次调用持久化为 allow 规则 */
export interface SecurityApprovalResponse {
  approved: boolean;
  alwaysAllow?: boolean;
}

export interface SecurityDecision {
  decision: SecurityDecisionOutcome;
  riskLevel: SecurityRiskLevel;
  reasonCode: string;
  message: string;
  toolName: string;
  argsSummary: string;
  provenance: SecurityRuleProvenance[];
  approvalId?: string;
}

export interface ApprovalRequest extends SecurityDecision {
  decision: 'ask';
  approvalId: string;
  createdAt: string;
}
