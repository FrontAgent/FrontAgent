export type TaskType = 'create' | 'modify' | 'debug' | 'query' | 'refactor' | 'test';

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'rolled_back';

export type ViolationSeverity = 'error' | 'warning' | 'info';

export type ActionType =
  | 'read_file'
  | 'list_directory'
  | 'write_file'
  | 'apply_patch'
  | 'create_file'
  | 'delete_file'
  | 'search_code'
  | 'get_ast'
  | 'run_command'
  | 'browser_navigate'
  | 'browser_click'
  | 'browser_type'
  | 'browser_screenshot'
  | 'get_page_structure'
  | 'filesense_sync_and_summarize'
  | 'filesense_query'
  | 'filesense_navigate';

export type ValidationType =
  | 'file_exists'
  | 'syntax_valid'
  | 'lint_pass'
  | 'type_check_pass'
  | 'tests_pass'
  | 'sdd_compliant';

export interface AgentTask {
  id: string;
  type: TaskType;
  description: string;
  context?: TaskContext;
  constraints?: string[];
}

export interface TaskContext {
  workingDirectory: string;
  relevantFiles?: string[];
  browserUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface ExecutionPlan {
  taskId: string;
  summary: string;
  steps: ExecutionStep[];
  phases?: ExecutionPhase[];
  estimatedDuration?: number;
  rollbackStrategy: RollbackStrategy;
}

export interface ExecutionPhase {
  phaseId: string;
  name: string;
  description: string;
  stepIndices: number[];
}

export interface ExecutionStep {
  stepId: string;
  description: string;
  action: ActionType;
  tool: string;
  params: Record<string, unknown>;
  dependencies: string[];
  validation: ValidationRule[];
  status: StepStatus;
  result?: StepResult;
  phase?: string;
}

export interface StepResult {
  success: boolean;
  output?: unknown;
  error?: string;
  duration: number;
  snapshotId?: string;
}

export interface RollbackStrategy {
  enabled: boolean;
  snapshotBeforeExecution: boolean;
  rollbackOnFailure: boolean;
  maxRollbackSteps: number;
}

export interface ValidationRule {
  type: ValidationType;
  params?: Record<string, unknown>;
  required: boolean;
}

export interface ConstraintViolation {
  type: ViolationSeverity;
  rule: string;
  message: string;
  location?: string;
  suggestion?: string;
}
