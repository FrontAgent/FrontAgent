/**
 * SDD 合规性检查
 * 验证 Agent 操作是否符合 SDD 约束
 */

import { SDDValidator, type AgentAction } from '@frontagent/sdd';
import type { SDDConfig, HallucinationCheckResult } from '@frontagent/shared';

export interface SDDComplianceCheckInput {
  action: AgentAction;
  sddConfig: SDDConfig;
}

/**
 * 检查操作是否符合 SDD 约束
 */
export async function checkSDDCompliance(
  input: SDDComplianceCheckInput
): Promise<HallucinationCheckResult> {
  const { action, sddConfig } = input;

  const validator = new SDDValidator(sddConfig);
  const result = validator.validate(action);

  // 收集所有错误级别的违规
  const errors = result.violations.filter(v => v.type === 'error');
  const warnings = result.violations.filter(v => v.type === 'warning');

  if (errors.length > 0) {
    return {
      pass: false,
      type: 'sdd_compliance',
      severity: 'block',
      message: `SDD compliance violations: ${errors.map(e => e.message).join('; ')}`,
      details: {
        errors,
        warnings,
        requiresApproval: result.requiresApproval,
        approvalReasons: result.approvalReasons
      }
    };
  }

  if (result.requiresApproval) {
    return {
      pass: false,
      type: 'sdd_compliance',
      severity: 'warn',
      message: `Action requires approval: ${result.approvalReasons.join('; ')}`,
      details: {
        warnings,
        requiresApproval: true,
        approvalReasons: result.approvalReasons
      }
    };
  }

  if (warnings.length > 0) {
    return {
      pass: true,
      type: 'sdd_compliance',
      severity: 'warn',
      message: `SDD compliance warnings: ${warnings.map(w => w.message).join('; ')}`,
      details: { warnings }
    };
  }

  return {
    pass: true,
    type: 'sdd_compliance',
    severity: 'info',
    message: 'Action is SDD compliant'
  };
}

/**
 * 批量检查多个操作的 SDD 合规性
 */
export async function checkActionsCompliance(
  actions: AgentAction[],
  sddConfig: SDDConfig
): Promise<HallucinationCheckResult[]> {
  return Promise.all(
    actions.map(action => checkSDDCompliance({ action, sddConfig }))
  );
}

