export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, MCPPropertySchema>;
    required?: string[];
  };
}

export interface MCPPropertySchema {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
  items?: MCPPropertySchema;
  properties?: Record<string, MCPPropertySchema>;
}

export interface FilePatch {
  operation: 'replace' | 'insert' | 'delete';
  startLine: number;
  endLine?: number;
  content?: string;
}

export interface PatchResult {
  success: boolean;
  diff: string;
  validation: {
    syntaxValid: boolean;
    lintErrors: LintError[];
    typeErrors: TypeError[];
  };
  snapshotId: string;
  error?: string;
}

export interface LintError {
  line: number;
  column: number;
  message: string;
  rule: string;
  severity: 'error' | 'warning';
}

export interface TypeError {
  line: number;
  column: number;
  message: string;
  code: number;
}
