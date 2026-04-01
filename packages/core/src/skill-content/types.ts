export type SkillSource = 'project' | 'user' | 'builtin';

export interface SkillTriggerConfig {
  explicit: string[];
  keywords: string[];
  negative: string[];
}

export interface SkillManifest {
  name: string;
  description: string;
  license?: string;
  source: SkillSource;
  rootDir: string;
  skillFilePath: string;
  body: string;
  triggers: SkillTriggerConfig;
  referencedFiles: string[];
}

export interface SkillContentLoaderConfig {
  projectRoot: string;
  builtInSkillRoots?: string[];
  userSkillRoots?: string[];
}

export interface SkillMatch {
  name: string;
  description: string;
  source: SkillSource;
  matchType: 'explicit' | 'keyword';
  score: number;
  matchedTerms: string[];
  loadedFiles: string[];
  promptContext: string;
}

export interface SkillResolution {
  sanitizedTaskDescription: string;
  matchedSkills: SkillMatch[];
  promptContext?: string;
}

export interface SkillContentResolverConfig {
  maxImplicitMatches?: number;
  maxExplicitMatches?: number;
  maxReferenceFiles?: number;
  maxCharsPerFile?: number;
}
