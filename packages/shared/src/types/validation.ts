export interface HallucinationCheckResult {
  pass: boolean;
  type: string;
  severity: 'block' | 'warn' | 'info';
  message?: string;
  details?: unknown;
}

export interface ValidationResult {
  pass: boolean;
  results: HallucinationCheckResult[];
  blockedBy?: string[];
  warnings?: string[];
}
