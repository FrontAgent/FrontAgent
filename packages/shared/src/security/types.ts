export type SecurityMode = 'balanced' | 'strict' | 'developer';

export type SecurityDecisionOutcome = 'allow' | 'ask' | 'deny';

export type SecurityRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type SecurityRuleSource = 'builtin' | 'sdd' | 'runtime';

export interface SecurityRuleProvenance {
  source: SecurityRuleSource;
  ruleId: string;
  mutable?: boolean;
  details?: string;
}

export interface SecurityConfig {
  mode?: SecurityMode;
  interactive?: boolean;
  auditEnabled?: boolean;
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
