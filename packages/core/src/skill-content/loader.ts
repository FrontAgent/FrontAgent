import { Dirent, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type {
  SkillContentLoaderConfig,
  SkillManifest,
  SkillSource,
  SkillTriggerConfig,
} from './types.js';

interface ParsedFrontmatter {
  name?: string;
  description?: string;
  license?: string;
  triggers?: Partial<SkillTriggerConfig>;
}

function stripQuotes(input: string): string {
  const trimmed = input.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function extractFrontmatter(raw: string): { metadata: ParsedFrontmatter; body: string } {
  const match = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/);
  if (!match) {
    return { metadata: {}, body: raw.trim() };
  }

  return {
    metadata: parseFrontmatter(match[1]),
    body: raw.slice(match[0].length).trim(),
  };
}

function parseFrontmatter(frontmatter: string): ParsedFrontmatter {
  const metadata: ParsedFrontmatter = {};
  let currentSection: 'triggers' | null = null;
  let currentArrayKey: keyof SkillTriggerConfig | null = null;

  for (const rawLine of frontmatter.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, '  ');
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    if (/^triggers:\s*$/.test(trimmed)) {
      metadata.triggers = metadata.triggers ?? {};
      currentSection = 'triggers';
      currentArrayKey = null;
      continue;
    }

    const topLevelMatch = line.match(/^([A-Za-z_][\w-]*):\s*(.+?)\s*$/);
    if (topLevelMatch && !line.startsWith(' ')) {
      const [, key, value] = topLevelMatch;
      currentSection = null;
      currentArrayKey = null;

      if (key === 'name') {
        metadata.name = stripQuotes(value);
      } else if (key === 'description') {
        metadata.description = stripQuotes(value);
      } else if (key === 'license') {
        metadata.license = stripQuotes(value);
      }
      continue;
    }

    if (currentSection !== 'triggers') {
      continue;
    }

    const nestedKeyMatch = line.match(/^\s{2}([A-Za-z_][\w-]*):\s*(.*?)\s*$/);
    if (nestedKeyMatch) {
      const [, key, value] = nestedKeyMatch;
      if (key === 'explicit' || key === 'keywords' || key === 'negative') {
        metadata.triggers = metadata.triggers ?? {};
        const typedKey = key as keyof SkillTriggerConfig;

        if (!value) {
          metadata.triggers[typedKey] = [];
          currentArrayKey = typedKey;
        } else {
          metadata.triggers[typedKey] = value
            .replace(/^\[/, '')
            .replace(/\]$/, '')
            .split(',')
            .map((item) => stripQuotes(item))
            .filter(Boolean);
          currentArrayKey = null;
        }
      }
      continue;
    }

    const arrayItemMatch = line.match(/^\s{4}-\s*(.+?)\s*$/);
    if (arrayItemMatch && currentArrayKey) {
      metadata.triggers = metadata.triggers ?? {};
      const currentValues = metadata.triggers[currentArrayKey] ?? [];
      currentValues.push(stripQuotes(arrayItemMatch[1]));
      metadata.triggers[currentArrayKey] = currentValues;
    }
  }

  return metadata;
}

function normalizeTriggers(
  name: string,
  description: string,
  triggers?: Partial<SkillTriggerConfig>,
): SkillTriggerConfig {
  const explicit = [...new Set([`$${name}`, name, ...(triggers?.explicit ?? [])])];
  const keywords = [...new Set(triggers?.keywords ?? [])];
  const negative = [...new Set(triggers?.negative ?? [])];

  if (keywords.length === 0 && description) {
    keywords.push(name);
  }

  return { explicit, keywords, negative };
}

function extractReferencedFiles(body: string): string[] {
  const matches = body.matchAll(/`((?:references|assets)\/[^`]+)`/g);
  const paths = new Set<string>();

  for (const match of matches) {
    if (match[1]) {
      paths.add(match[1]);
    }
  }

  return Array.from(paths);
}

export class SkillContentLoader {
  private readonly config: SkillContentLoaderConfig;
  private cachedSkills?: SkillManifest[];

  constructor(config: SkillContentLoaderConfig) {
    this.config = config;
  }

  listSkills(): SkillManifest[] {
    if (this.cachedSkills) {
      return this.cachedSkills;
    }

    const manifests = new Map<string, SkillManifest>();

    for (const root of this.resolveSearchRoots()) {
      if (!existsSync(root.path)) {
        continue;
      }

      let entries: Dirent[] = [];
      try {
        entries = readdirSync(root.path, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const skillFilePath = join(root.path, entry.name, 'SKILL.md');
        if (!existsSync(skillFilePath)) {
          continue;
        }

        const manifest = this.loadSkill(skillFilePath, root.source);
        if (!manifest || manifests.has(manifest.name)) {
          continue;
        }

        manifests.set(manifest.name, manifest);
      }
    }

    this.cachedSkills = Array.from(manifests.values());
    return this.cachedSkills;
  }

  private resolveSearchRoots(): Array<{ path: string; source: SkillSource }> {
    const roots: Array<{ path: string; source: SkillSource }> = [];
    const seen = new Set<string>();

    const registerRoot = (path: string | undefined, source: SkillSource) => {
      if (!path) {
        return;
      }
      const normalized = resolve(path);
      if (seen.has(normalized)) {
        return;
      }
      seen.add(normalized);
      roots.push({ path: normalized, source });
    };

    registerRoot(join(this.config.projectRoot, 'skills'), 'project');

    if (process.env.CODEX_HOME) {
      registerRoot(join(process.env.CODEX_HOME, 'skills'), 'user');
    }

    for (const root of this.config.userSkillRoots ?? []) {
      registerRoot(root, 'user');
    }

    for (const root of this.config.builtInSkillRoots ?? []) {
      registerRoot(root, 'builtin');
    }

    return roots;
  }

  private loadSkill(skillFilePath: string, source: SkillSource): SkillManifest | null {
    try {
      const raw = readFileSync(skillFilePath, 'utf-8');
      const { metadata, body } = extractFrontmatter(raw);
      const name = metadata.name?.trim();

      if (!name) {
        return null;
      }

      const description = metadata.description?.trim() ?? '';

      return {
        name,
        description,
        license: metadata.license?.trim(),
        source,
        rootDir: resolve(join(skillFilePath, '..')),
        skillFilePath: resolve(skillFilePath),
        body,
        triggers: normalizeTriggers(name, description, metadata.triggers),
        referencedFiles: extractReferencedFiles(body),
      };
    } catch {
      return null;
    }
  }
}
