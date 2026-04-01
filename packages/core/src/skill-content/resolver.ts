import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SkillContentLoader } from './loader.js';
import type {
  SkillContentResolverConfig,
  SkillManifest,
  SkillMatch,
  SkillResolution,
} from './types.js';

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeText(input: string): string {
  return input.toLowerCase().replace(/\s+/g, ' ').trim();
}

function containsAlias(haystack: string, alias: string): boolean {
  const normalizedAlias = normalizeText(alias);
  if (!normalizedAlias) {
    return false;
  }

  const pattern = new RegExp(
    `(^|[\\s"'([{])${escapeRegExp(normalizedAlias)}(?=$|[\\s"')}\\].,!?;:])`,
    'i',
  );

  return pattern.test(haystack);
}

function summarizeMatch(match: SkillMatch): string {
  const terms = match.matchedTerms.join(', ');
  return `- ${match.name} (${match.matchType}; matched: ${terms || 'n/a'})`;
}

export class SkillContentResolver {
  private readonly loader: SkillContentLoader;
  private readonly config: Required<SkillContentResolverConfig>;

  constructor(
    loader: SkillContentLoader,
    config: SkillContentResolverConfig = {},
  ) {
    this.loader = loader;
    this.config = {
      maxImplicitMatches: config.maxImplicitMatches ?? 1,
      maxExplicitMatches: config.maxExplicitMatches ?? 3,
      maxReferenceFiles: config.maxReferenceFiles ?? 4,
      maxCharsPerFile: config.maxCharsPerFile ?? 2200,
    };
  }

  resolveForTask(taskDescription: string): SkillResolution {
    const manifests = this.loader.listSkills();
    if (manifests.length === 0) {
      return {
        sanitizedTaskDescription: taskDescription.trim(),
        matchedSkills: [],
      };
    }

    const normalizedTask = normalizeText(taskDescription);
    const explicitMatches = manifests
      .map((manifest) => this.resolveExplicitMatch(manifest, normalizedTask))
      .filter((match): match is SkillMatch => match !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxExplicitMatches);

    const matchedSkills =
      explicitMatches.length > 0
        ? explicitMatches
        : manifests
            .map((manifest) => this.resolveKeywordMatch(manifest, normalizedTask))
            .filter((match): match is SkillMatch => match !== null)
            .sort((a, b) => b.score - a.score)
            .slice(0, this.config.maxImplicitMatches);

    const sanitizedTaskDescription = this.sanitizeTaskDescription(taskDescription, explicitMatches);
    if (matchedSkills.length === 0) {
      return {
        sanitizedTaskDescription,
        matchedSkills: [],
      };
    }

    const promptContext = [
      '## Activated Content Skills',
      'Apply the following matched skill instructions alongside SDD and project constraints.',
      'Matched skills:',
      ...matchedSkills.map((match) => summarizeMatch(match)),
      '',
      ...matchedSkills.map((match) => match.promptContext),
    ].join('\n');

    return {
      sanitizedTaskDescription,
      matchedSkills,
      promptContext,
    };
  }

  private resolveExplicitMatch(manifest: SkillManifest, normalizedTask: string): SkillMatch | null {
    const matchedTerms = manifest.triggers.explicit.filter((alias) => containsAlias(normalizedTask, alias));
    if (matchedTerms.length === 0) {
      return null;
    }

    return this.buildMatch(manifest, 'explicit', matchedTerms, 1000 + matchedTerms.length * 50);
  }

  private resolveKeywordMatch(manifest: SkillManifest, normalizedTask: string): SkillMatch | null {
    const matchedTerms: string[] = [];
    let score = 0;

    if (containsAlias(normalizedTask, manifest.name)) {
      matchedTerms.push(manifest.name);
      score += 40;
    }

    for (const keyword of manifest.triggers.keywords) {
      const normalizedKeyword = normalizeText(keyword);
      if (!normalizedKeyword || !normalizedTask.includes(normalizedKeyword)) {
        continue;
      }
      matchedTerms.push(keyword);
      score += normalizedKeyword.includes(' ') || /[^\x00-\x7F]/.test(normalizedKeyword) ? 18 : 10;
    }

    for (const negative of manifest.triggers.negative) {
      const normalizedNegative = normalizeText(negative);
      if (!normalizedNegative || !normalizedTask.includes(normalizedNegative)) {
        continue;
      }
      score -= 60;
    }

    if (score <= 0 || matchedTerms.length === 0) {
      return null;
    }

    return this.buildMatch(manifest, 'keyword', matchedTerms, score);
  }

  private buildMatch(
    manifest: SkillManifest,
    matchType: SkillMatch['matchType'],
    matchedTerms: string[],
    score: number,
  ): SkillMatch {
    const uniqueTerms = [...new Set(matchedTerms)];
    const loadedFiles = [manifest.skillFilePath];
    const promptSections = [
      `### Skill: ${manifest.name}`,
      `Description: ${manifest.description || '(no description)'}`,
      `Matched by: ${matchType} (${uniqueTerms.join(', ')})`,
      '',
      manifest.body.trim(),
    ];

    const referencedFiles = manifest.referencedFiles
      .map((relativePath) => resolve(manifest.rootDir, relativePath))
      .filter((absolutePath) => existsSync(absolutePath))
      .slice(0, this.config.maxReferenceFiles);

    for (const referencePath of referencedFiles) {
      const raw = readFileSync(referencePath, 'utf-8').trim();
      const truncated = raw.length > this.config.maxCharsPerFile
        ? `${raw.slice(0, this.config.maxCharsPerFile)}\n...`
        : raw;
      loadedFiles.push(referencePath);
      promptSections.push(`### Reference: ${referencePath}`);
      promptSections.push(truncated);
    }

    return {
      name: manifest.name,
      description: manifest.description,
      source: manifest.source,
      matchType,
      score,
      matchedTerms: uniqueTerms,
      loadedFiles,
      promptContext: promptSections.join('\n\n'),
    };
  }

  private sanitizeTaskDescription(taskDescription: string, explicitMatches: SkillMatch[]): string {
    if (explicitMatches.length === 0) {
      return taskDescription.trim();
    }

    let sanitized = taskDescription;
    for (const match of explicitMatches) {
      for (const term of match.matchedTerms) {
        if (!term.startsWith('$')) {
          continue;
        }
        sanitized = sanitized.replace(new RegExp(escapeRegExp(term), 'gi'), ' ');
      }
    }

    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    return sanitized || taskDescription.trim();
  }
}
