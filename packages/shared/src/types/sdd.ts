export interface SDDConfig {
  version: string;
  project: ProjectConfig;
  techStack: TechStackConfig;
  directoryStructure: DirectoryStructureConfig;
  moduleBoundaries: ModuleBoundary[];
  namingConventions: NamingConventions;
  codeQuality: CodeQualityConfig;
  modificationRules: ModificationRules;
}

export interface ProjectConfig {
  name: string;
  type: string;
  description?: string;
}

export interface TechStackConfig {
  framework: string;
  version: string;
  language: string;
  styling?: string;
  stateManagement?: string;
  forbiddenPackages: string[];
  requiredPackages?: string[];
  uiLibrary?: string;
  uiLibraryVersion?: string;
  routing?: string;
  buildTool?: string;
}

export interface DirectoryStructureConfig {
  [path: string]: DirectoryRule;
}

export interface DirectoryRule {
  pattern?: string;
  maxLines?: number;
  requiredExports?: string[];
  forbidden?: string[];
  mustBePure?: boolean;
}

export interface ModuleBoundary {
  from: string;
  canImport: string[];
  cannotImport: string[];
}

export interface NamingConventions {
  components: string;
  hooks: string;
  utils: string;
  constants: string;
  types: string;
}

export interface CodeQualityConfig {
  maxFunctionLines: number;
  maxFileLines: number;
  maxParameters: number;
  requireJsdoc: boolean;
  forbiddenPatterns: string[];
}

export interface ModificationRules {
  protectedFiles: string[];
  protectedDirectories: string[];
  requireApproval: ApprovalRule[];
}

export interface ApprovalRule {
  pattern: string;
  reason: string;
}
